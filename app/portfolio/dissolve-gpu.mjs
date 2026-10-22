import { clamp, smooth } from './timeline.mjs';
import { dissolveEase } from './dissolve.mjs';

const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = vec2(position.x * .5 + .5, .5 - position.y * .5);
  gl_Position = vec4(position, 0., 1.);
}`;

const fragmentSource = `
precision highp float;
varying vec2 uv;
uniform sampler2D baseImage;
uniform sampler2D contentImage;
uniform sampler2D artImage;
uniform sampler2D fieldImage;
uniform sampler2D bodyImage;
uniform vec2 viewport;
uniform vec2 pivot;
uniform vec4 fieldMatrix;
uniform vec3 transform;
uniform vec3 transfer;
uniform vec3 appearance;
uniform bool outgoing;
uniform bool settled;
uniform bool separateBody;

float inside(vec2 point) {
  return step(0., point.x) * step(point.x, 1.) * step(0., point.y) * step(point.y, 1.);
}
vec4 over(vec4 front, vec4 back) {
  return front + back * (1. - front.a);
}
vec4 edgeSource(vec2 point) {
  return over(texture2D(artImage, point), texture2D(baseImage, point)) * inside(point);
}
vec3 linearRGB(vec3 color) {
  return mix(color / 12.92, pow((color + .055) / 1.055, vec3(2.4)), step(vec3(.04045), color));
}
float luma(vec2 point) {
  vec4 source = edgeSource(point);
  return dot(linearRGB(source.rgb / max(source.a, .00001)), vec3(.299, .587, .114));
}
float edge(vec2 point) {
  float center = luma(point);
  float value = clamp(10. * (abs(center - luma(point - vec2(1. / viewport.x, 0.)))
    + abs(center - luma(point - vec2(0., 1. / viewport.y)))), 0., 1.);
  return value <= .0031308 ? 12.92 * value : 1.055 * pow(value, 1. / 2.4) - .055;
}

// The SVG used a 256-entry feFuncA table rounded to four decimal places.
// Evaluate its two neighboring entries rather than replacing it with a curve.
vec3 tableEntry(float threshold) {
  float travel = transfer.x, eased = transfer.y;
  float weight = appearance.x, dark = appearance.y, gain = appearance.z;
  float blend = smoothstep(eased - .008, eased + .008, threshold);
  float proximity = 1. - smoothstep(0., .3, abs(eased - threshold));
  float glow = (1. - smoothstep(0., .003, abs(eased - threshold)))
    * smoothstep(.01, .08, travel) * (1. - smoothstep(.92, 1., travel));
  vec3 value = vec3(outgoing ? blend : 1. - blend,
    1. - (1. - dark) * (1. - weight * proximity),
    min(1., proximity * (proximity * weight * (1. - dark) + .1 * dark) * gain * (1. + 9. * glow)));
  return floor(value * 10000. + .5) / 10000.;
}
void main() {
  vec4 base = texture2D(baseImage, uv);
  if (settled) {
    gl_FragColor = over(texture2D(contentImage, uv), base);
    return;
  }

  // CSS scale(s) translateY(t), with the copy element's transform origin.
  vec2 point = ((uv * viewport - pivot) / transform.x + pivot
    - vec2(0., transform.y)) / viewport;
  vec4 copy;
  if (transform.z <= 0.) copy = texture2D(artImage, point) * inside(point);
  else if (transform.z >= 1.) copy = texture2D(contentImage, point) * inside(point);
  else if (separateBody) {
    vec2 bodyPoint = point - vec2(0., (1. - transform.z) * 4.5 / viewport.y);
    vec4 body = texture2D(bodyImage, bodyPoint) * inside(bodyPoint) * transform.z;
    copy = over(body, texture2D(artImage, point) * inside(point));
  } else copy = mix(texture2D(artImage, point), texture2D(contentImage, point), transform.z) * inside(point);
  vec4 source = over(copy, base);

  float threshold = clamp(dot(texture2D(fieldImage, uv).rgb, fieldMatrix.xyz) + fieldMatrix.w, 0., 1.);
  float position = threshold * 255.;
  float first = floor(position);
  vec3 masks = mix(tableEntry(first / 255.), tableEntry(min(first + 1., 255.) / 255.), fract(position));

  // Black shade is an actual .78-alpha layer, including over transparent pixels.
  float shade = .78 * masks.y;
  vec3 color = source.rgb * (1. - shade);
  float alpha = source.a + shade * (1. - source.a);

  // The old linearRGB luma filter is converted to sRGB before CSS screen blend.
  float outline = masks.z * inside(point);
  float light = edge(point) * outline;
  color = color + vec3(light) - color * light;
  alpha = alpha + outline * (1. - alpha);
  gl_FragColor = vec4(color, alpha) * masks.x;
}`;

const blurSource = `
precision highp float;
varying vec2 uv;
uniform sampler2D image;
uniform vec2 direction;
uniform vec2 dimensions;
uniform vec2 taps[32];
uniform int count;
void main() {
  vec4 color = vec4(0.);
  for (int index = 0; index < 32; index++) {
    if (index >= count) break;
    vec2 point = uv + direction * taps[index].x;
    vec2 coverage = clamp(point * dimensions + .5, 0., 1.) * clamp((1. - point) * dimensions + .5, 0., 1.);
    color += texture2D(image, point) * coverage.x * coverage.y * taps[index].y;
  }
  gl_FragColor = color;
}`;

// Pair adjacent Gaussian weights so one bilinear fetch evaluates two taps.
function gaussian(sigma) {
  // ponytail: 31 pixels cover 3 sigma for the current capture scale; larger
  // cached images shrunk below one fifth size would need a longer kernel.
  const radius = Math.min(31, Math.ceil(sigma * 3));
  const weights = Array.from({ length: radius * 2 + 1 }, (_, index) => Math.exp(-.5 * ((index - radius) / sigma) ** 2));
  const total = weights.reduce((sum, value) => sum + value, 0), taps = [];
  for (let index = 0; index < weights.length; index += 2) {
    const next = weights[index + 1] || 0, weight = weights[index] + next;
    if (!weight) continue;
    taps.push(index - radius + next / weight, weight / total);
  }
  return new Float32Array(taps);
}

const cubic = value => value < .5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;

/**
 * Draw the original dissolve with premultiplied textures and no DOM filters.
 * Render sizes and captured scene sizes/pivots are CSS pixels; time is elapsed ms.
 * Scene canvases share one pixel size, which sets the drawing-buffer resolution.
 * An optional isolated body layer restores its Gaussian blur and translation.
 * Canvas contents are immutable until that canvas is replaced in setPair().
 */
export function createDissolveRenderer(canvas, { forwardImage, reverseImage }) {
  const gl = canvas.getContext('webgl', {
    alpha: true, premultipliedAlpha: true, antialias: false,
    // WebKit can discard the first frame while this canvas becomes visible.
    depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL is unavailable for the dissolve renderer.');

  const shaders = [], textures = [], programs = [];
  let program, blurProgram, buffer, framebuffer, pair, disposed = false, width = 1, height = 1;
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    textures.forEach(texture => gl.deleteTexture(texture));
    shaders.forEach(shader => gl.deleteShader(shader));
    if (buffer) gl.deleteBuffer(buffer);
    programs.forEach(value => gl.deleteProgram(value));
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    pair = null;
  };

  try {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Dissolve shader: ${gl.getShaderInfoLog(shader)}`);
      return shader;
    };
    const link = fragment => {
      const value = gl.createProgram();
      programs.push(value);
      gl.attachShader(value, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(value, compile(gl.FRAGMENT_SHADER, fragment));
      gl.bindAttribLocation(value, 0, 'position');
      gl.linkProgram(value);
      if (!gl.getProgramParameter(value, gl.LINK_STATUS)) {
        throw new Error(`Dissolve program: ${gl.getProgramInfoLog(value)}`);
      }
      return value;
    };
    program = link(fragmentSource);
    blurProgram = link(blurSource);
    gl.useProgram(program);
    const uniforms = Object.fromEntries([
      'baseImage', 'contentImage', 'artImage', 'fieldImage', 'bodyImage', 'viewport', 'pivot',
      'fieldMatrix', 'transform', 'transfer', 'appearance', 'outgoing', 'settled', 'separateBody',
    ].map(name => [name, gl.getUniformLocation(program, name)]));
    ['baseImage', 'contentImage', 'artImage', 'fieldImage', 'bodyImage'].forEach((name, unit) => gl.uniform1i(uniforms[name], unit));
    const blurUniforms = Object.fromEntries(['image', 'direction', 'dimensions', 'taps[0]', 'count'].map(name => [name, gl.getUniformLocation(blurProgram, name)]));

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.DITHER);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

    const texture = () => {
      const value = gl.createTexture();
      textures.push(value);
      gl.bindTexture(gl.TEXTURE_2D, value);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return value;
    };
    const upload = (target, source, premultiplied) => {
      const w = source.naturalWidth || source.width, h = source.naturalHeight || source.height;
      if (!w || !h || w > maxTextureSize || h > maxTextureSize) throw new Error(`Invalid dissolve texture size: ${w}×${h}.`);
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplied);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    };
    const fields = [texture(), texture()];
    upload(fields[0], forwardImage, false);
    upload(fields[1], reverseImage, false);
    const scenes = [0, 1].map(() => {
      const layers = [texture(), texture(), texture(), texture()];
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      return { textures: layers, sources: [] };
    });
    const scratch = [texture(), texture()];
    framebuffer = gl.createFramebuffer();
    let scratchWidth = 0, scratchHeight = 0;

    const blurBody = (source, sigma) => {
      const pixelWidth = canvas.width, pixelHeight = canvas.height;
      gl.activeTexture(gl.TEXTURE4);
      if (scratchWidth !== pixelWidth || scratchHeight !== pixelHeight) {
        for (const target of scratch) {
          gl.bindTexture(gl.TEXTURE_2D, target);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pixelWidth, pixelHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }
        scratchWidth = pixelWidth; scratchHeight = pixelHeight;
      }
      gl.useProgram(blurProgram);
      gl.uniform1i(blurUniforms.image, 4);
      gl.uniform2f(blurUniforms.dimensions, pixelWidth, pixelHeight);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      for (let axis = 0; axis < 2; axis++) {
        const taps = gaussian(sigma * (axis ? pixelHeight / height : pixelWidth / width));
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scratch[axis], 0);
        gl.bindTexture(gl.TEXTURE_2D, axis ? scratch[0] : source);
        gl.uniform2f(blurUniforms.direction, axis ? 0 : 1 / pixelWidth, axis ? 1 / pixelHeight : 0);
        gl.uniform2fv(blurUniforms['taps[0]'], taps);
        gl.uniform1i(blurUniforms.count, taps.length / 2);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.enable(gl.BLEND);
      gl.useProgram(program);
      return scratch[1];
    };

    const resize = (nextWidth, nextHeight) => {
      if (disposed) return;
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      const pixelWidth = pair ? pair[0].base.width : Math.round(width);
      const pixelHeight = pair ? pair[0].base.height : Math.round(height);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.viewport, width, height);
    };

    const setPair = (lower, upper) => {
      if (disposed) return;
      const next = [lower, upper];
      const expected = [lower.base.width, lower.base.height];
      // Adjacent pairs share a scene, even when that scene changes drawing order.
      const matches = (scene, slot) => ['base', 'content', 'art', 'body'].every((key, index) => scene[key] === slot.sources[index]);
      if (matches(lower, scenes[1]) || matches(upper, scenes[0])) scenes.reverse();
      for (let side = 0; side < 2; side++) {
        const sources = ['base', 'content', 'art', 'body'].map(key => next[side][key]);
        if (sources.some(source => source && (source.width !== expected[0] || source.height !== expected[1]))) {
          throw new Error('Dissolve scene canvases must have equal pixel dimensions.');
        }
        for (let layer = 0; layer < 4; layer++) {
          if (sources[layer] && sources[layer] !== scenes[side].sources[layer]) upload(scenes[side].textures[layer], sources[layer], true);
        }
        scenes[side].sources = sources;
      }
      pair = next;
      resize(width, height);
    };

    const draw = (side, progress, reverse, isSettled) => {
      const incoming = side === 1, outgoing = incoming === reverse;
      const distance = incoming ? 1 - progress : progress;
      const travel = reverse ? 1 - progress : progress, eased = dissolveEase(travel);
      const weight = outgoing ? smooth(0, .5, eased) ** 2 : smooth(.2, .8, 1 - eased) ** 2;
      const dark = outgoing ? Math.min(travel * .6, .32) : 0;
      const gain = (outgoing ? 5 + 5 * eased : 5 - 2 * eased) / 10;
      const copyOpacity = incoming ? smooth(.82, 1, progress) : 1 - smooth(0, .18, progress);
      const scene = pair[side];
      const body = scene.body && !isSettled && copyOpacity > 0 && copyOpacity < 1
        ? blurBody(scenes[side].textures[3], (1 - copyOpacity) * 2.25) : scenes[side].textures[3];
      scenes[side].textures.slice(0, 3).forEach((value, unit) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, value);
      });
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, body);
      // Keep a cached pivot at the same normalized position until recapture.
      gl.uniform2f(uniforms.pivot, scene.pivot[0] * width / (scene.width || width),
        scene.pivot[1] * height / (scene.height || height));
      gl.uniform3f(uniforms.transform, 1 + .3 * distance, (incoming ? 1 : -1) * cubic(distance) * .1 * height,
        copyOpacity);
      gl.uniform3f(uniforms.transfer, travel, eased, 0);
      gl.uniform3f(uniforms.appearance, weight, dark, gain);
      gl.uniform1i(uniforms.outgoing, outgoing);
      gl.uniform1i(uniforms.settled, isSettled);
      gl.uniform1i(uniforms.separateBody, Boolean(scene.body));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const render = ({ progress, reverse = false, time = 0, width: nextWidth = width, height: nextHeight = height }) => {
      if (disposed || !pair || gl.isContextLost()) return;
      resize(nextWidth, nextHeight);
      const p = clamp(progress), phase = time * .0006, sine = Math.sin(phase), cosine = Math.cos(phase);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, fields[reverse ? 1 : 0]);
      gl.uniform4f(uniforms.fieldMatrix, 2, .075 * sine, -.075 * cosine, -.5 + .0375 * (cosine - sine));
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (p <= 0 || p >= 1) draw(p >= 1 ? 1 : 0, p, reverse, true);
      else { draw(0, p, reverse, false); draw(1, p, reverse, false); }
    };
    return { setPair, render, resize, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
