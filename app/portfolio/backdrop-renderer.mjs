export function createBackdropRenderer(canvas) {
  const gl = canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,failIfMajorPerformanceCaveat:true});
  if (!gl) return null;
  const shaders = [];
  const shader = (type,source) => {
    const value = gl.createShader(type); gl.shaderSource(value,source); gl.compileShader(value); shaders.push(value);
    if (!gl.getShaderParameter(value,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value));
    return value;
  };
  const program = gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 position; varying vec2 uv; void main(){uv=(position+1.)*.5;gl_Position=vec4(position,0.,1.);}'));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
    precision highp float;
    varying vec2 uv;
    uniform sampler2D imageA,imageB,fieldImage;
    uniform vec2 viewport,aspect,progress;
    uniform vec4 positions;
    uniform vec2 contain;
    uniform float dissolve,reduced,fieldReady,ambient,clock;
    float random(vec2 p){p=fract(p*vec2(.1031,.11369));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(random(i),random(i+vec2(1.,0.)),f.x),mix(random(i+vec2(0.,1.)),random(i+1.),f.x),f.y);}
    vec4 sampleImage(sampler2D image,float ratio,float p,vec2 focus,float fit,vec2 screenPoint){
      float screen=viewport.x/viewport.y;
      vec2 crop=fit>.5?vec2(max(1.,screen/ratio),max(1.,ratio/screen)):vec2(min(1.,screen/ratio),min(1.,ratio/screen));
      float cycle=clock*6.2831853/18.;
      float zoom=mix(1.04,1.12,p)*(1.-reduced)+reduced+ambient*.008*(1.-cos(cycle));
      vec2 point=(screenPoint-.5)*crop/zoom+vec2(focus.x,1.-focus.y)*(1.-crop/zoom)+.5*crop/zoom;
      point.y += (p-.5)*.025*(1.-reduced);
      point+=ambient*vec2(sin(cycle)*.002,(1.-cos(cycle))*.0015);
      if(point.x<0.||point.x>1.||point.y<0.||point.y>1.) return vec4(.961,.957,.973,1.);
      vec4 color=texture2D(image,point);
      float light=max(0.,1.-length((screenPoint-vec2(.75-p*.35,.8))*vec2(1.,1.5)))*.035*(1.-reduced);
      light+=ambient*.035*pow(max(0.,sin(screenPoint.x*9.+screenPoint.y*3.+sin(cycle)*.22)),10.);
      return vec4(mix(color.rgb,vec3(1.,.97,.91),light),1.);
    }
    vec3 linearRGB(vec3 color){
      return mix(color/12.92,pow((color+.055)/1.055,vec3(2.4)),step(vec3(.04045),color));
    }
    float luma(vec3 color){return dot(linearRGB(color),vec3(.299,.587,.114));}
    vec3 etched(sampler2D image,float ratio,float p,vec2 focus,float fit,vec3 color,float threshold,bool outgoing){
      float weight=outgoing?pow(smoothstep(0.,.5,dissolve),2.):pow(smoothstep(.2,.8,1.-dissolve),2.);
      float dark=outgoing?min(dissolve*.6,.32):0.;
      float proximity=1.-smoothstep(0.,.3,abs(dissolve-threshold));
      float glow=(1.-smoothstep(0.,.003,abs(dissolve-threshold)))
        *smoothstep(.01,.08,dissolve)*(1.-smoothstep(.92,1.,dissolve));
      float gain=outgoing?(5.+5.*dissolve)/10.:(5.-2.*dissolve)/10.;
      float outline=min(1.,proximity*(proximity*weight*(1.-dark)+.1*dark)*gain*(1.+9.*glow));
      vec3 shaded=color*(1.-.78*(dark+(1.-dark)*weight*proximity));
      if(outline>.001){
        float center=luma(color);
        float left=luma(sampleImage(image,ratio,p,focus,fit,uv-vec2(1./viewport.x,0.)).rgb);
        float above=luma(sampleImage(image,ratio,p,focus,fit,uv+vec2(0.,1./viewport.y)).rgb);
        float edge=clamp(10.*(abs(center-left)+abs(center-above)),0.,1.);
        edge=edge<=.0031308?12.92*edge:1.055*pow(edge,1./2.4)-.055;
        float light=edge*outline;
        shaded=shaded+vec3(light)-shaded*light;
      }
      return shaded;
    }
    void main(){
      vec3 a=sampleImage(imageA,aspect.x,progress.x,positions.xy,contain.x,uv).rgb;
      vec3 b=sampleImage(imageB,aspect.y,progress.y,positions.zw,contain.y,uv).rgb;
      if(dissolve<=0.){gl_FragColor=vec4(a,1.);return;}
      if(dissolve>=1.){gl_FragColor=vec4(b,1.);return;}
      vec3 field=texture2D(fieldImage,uv).rgb;
      float threshold=fieldReady>.5?clamp(2.*field.r-.075*field.b-.4625,0.,1.):
        clamp(.7*noise(uv*vec2(9.,6.))+.3*noise(uv*vec2(90.,60.)),0.,1.);
      float incoming=1.-smoothstep(dissolve-.008,dissolve+.008,threshold);
      a=etched(imageA,aspect.x,progress.x,positions.xy,contain.x,a,threshold,true);
      b=etched(imageB,aspect.y,progress.y,positions.zw,contain.y,b,threshold,false);
      gl_FragColor=vec4(mix(a,b,incoming),1.);
    }`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Background shader failed');
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program,'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const uniforms = Object.fromEntries(['imageA','imageB','viewport','aspect','progress','positions','contain','dissolve','reduced','fieldImage','fieldReady','ambient','clock'].map(name=>[name,gl.getUniformLocation(program,name)]));
  gl.uniform1i(uniforms.imageA,0); gl.uniform1i(uniforms.imageB,1); gl.uniform1i(uniforms.fieldImage,2);
  const fieldTexture=gl.createTexture();
  let fieldSource=null;
  gl.activeTexture(gl.TEXTURE0+2); gl.bindTexture(gl.TEXTURE_2D,fieldTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,128,255]));
  const textures = new Map();
  let used = 0;
  function bind(entry, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    let record = textures.get(entry);
    if (!record) {
      record = { texture: gl.createTexture(), source: null, revision: -1 };
      textures.set(entry, record);
      gl.bindTexture(gl.TEXTURE_2D, record.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else gl.bindTexture(gl.TEXTURE_2D, record.texture);
    record.used = ++used;
    if (record.source !== entry.source || record.revision !== entry.revision) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.source);
      record.source = entry.source;
      record.revision = entry.revision;
    }
  }
  return {
    setDissolveField(image) {
      if(fieldSource===image)return;
      gl.activeTexture(gl.TEXTURE0+2);gl.bindTexture(gl.TEXTURE_2D,fieldTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      fieldSource=image;gl.uniform1f(uniforms.fieldReady,1);
    },
    draw(a,b,blend,reduced,width,height,{time=0,ambient=0}={}) {
      const density = Math.min(devicePixelRatio || 1,width<700?1:1.5);
      const w=Math.round(width*density), h=Math.round(height*density);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      bind(a, 0); bind(b, 1);
      while (textures.size > 3) {
        const [entry, record] = [...textures].filter(([entry]) => entry !== a && entry !== b).sort(([,a],[,b]) => a.used - b.used)[0];
        gl.deleteTexture(record.texture); textures.delete(entry);
      }
      gl.uniform2f(uniforms.viewport,width,height);gl.uniform2f(uniforms.aspect,a.aspect,b.aspect);
      gl.uniform2f(uniforms.progress,a.progress,b.progress);gl.uniform4f(uniforms.positions,...a.position,...b.position);
      gl.uniform2f(uniforms.contain,Number(a.contain),Number(b.contain));gl.uniform1f(uniforms.dissolve,blend);gl.uniform1f(uniforms.reduced,Number(reduced));
      gl.uniform1f(uniforms.ambient,ambient);gl.uniform1f(uniforms.clock,time);
      gl.drawArrays(gl.TRIANGLES,0,6);
    },
    dispose(){gl.deleteTexture(fieldTexture);textures.forEach(record=>gl.deleteTexture(record.texture));textures.clear();gl.deleteBuffer(buffer);gl.deleteProgram(program);shaders.forEach(value=>gl.deleteShader(value));},
  };
}
