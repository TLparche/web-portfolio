"""Extract deterministic morph endpoints from an existing packed RGB/depth video.

No depth inference. Run with the existing background Python environment.
"""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image
from fftool import ffmpeg


def crop_rect(image, rect):
    w, h = image.size
    return image.crop(tuple(round(v * (w if i % 2 == 0 else h)) for i, v in enumerate(rect)))


def point_order(image, manifest, width, height):
    # Nearest sampling at cell centres matches the shader's point grid.
    depth = np.asarray(crop_rect(image, manifest['depthRect']).resize((width, height), Image.Resampling.NEAREST))[:, :, 0]
    color = np.asarray(crop_rect(image, manifest['colorRect']).resize((width, height), Image.Resampling.NEAREST))
    visible = (depth > 5) & (color.max(axis=2) > 12)
    y, x = np.indices((height, width), dtype=np.uint32)
    morton = np.zeros_like(x)
    for bit in range(10):
        morton |= ((x >> bit) & 1) << (2 * bit)
        morton |= ((y >> bit) & 1) << (2 * bit + 1)
    order = np.lexsort((morton.ravel(), ~visible.ravel())).astype('<u4')
    return order, int(visible.sum())


def prepare(manifest_path, output, limit=None, color_mode='duotone'):
    manifest = json.loads(manifest_path.read_text())
    public = Path('public').resolve()
    output_url = '/' + output.resolve().relative_to(public).as_posix()
    video_url = '/' + (manifest_path.parent / manifest['video']).resolve().relative_to(public).as_posix()
    output.mkdir(parents=True, exist_ok=True)
    scenes = []
    for index, chapter in enumerate(manifest['chapters'][:limit]):
        scene = {'id': f'scene-{index + 1:02}', 'startFrame': chapter['in'],
                 'endFrame': chapter['out'] - 1, 'fps': manifest['fps'],
                 'video': video_url, 'colorRect': manifest['colorRect'],
                 'depthRect': manifest['depthRect'], 'aspect': manifest['width'] / manifest['height'],
                 'colorMode': color_mode}
        for endpoint, frame in [('entry', chapter['in']), ('exit', chapter['out'] - 1)]:
            name = f"{scene['id']}-{endpoint}"
            path = output / f'{name}.webp'
            subprocess.run([ffmpeg(), '-loglevel', 'error', '-y', '-i', str(manifest_path.parent / manifest['video']),
                            '-vf', f'select=eq(n\\,{frame})', '-frames:v', '1', '-lossless', '1', str(path)], check=True)
            with Image.open(path) as source:
                image = source.convert('RGB')
            endpoint_data = {'texture': f'{output_url}/{path.name}', 'tiers': {}}
            for width, height in [(320, 180), (160, 90)]:
                order, count = point_order(image, manifest, width, height)
                order_file = f'{name}-{width}.bin'
                order.tofile(output / order_file)
                endpoint_data['tiers'][str(width)] = {'order': f'{output_url}/{order_file}', 'visibleCount': count,
                                                      'width': width, 'height': height}
            scene[endpoint] = endpoint_data
            if endpoint == 'entry':
                color = np.asarray(crop_rect(image, manifest['colorRect']), dtype=np.float32) / 255
                depth = np.asarray(crop_rect(image, manifest['depthRect']))[:, :, 0]
                mask = (depth > 5) & (color.max(axis=2) > 12.5 / 255)
                # The same cyan/blue photographic duotone used by the live shader.
                luminance = color.max(axis=2, keepdims=True)
                ink = color * 255 if color_mode == 'source' else np.array([34, 109, 255]) * (.55 + .45 * luminance)
                background = np.full_like(color, [245, 248, 252])
                # Source posters must match the full video surface at startup.
                still = (ink if color_mode == 'source' else np.where(mask[:, :, None], ink, background)).astype('uint8')
                still_name = f"{scene['id']}-still.webp"
                Image.fromarray(still).save(output / still_name, quality=90)
                scene['still'] = f'{output_url}/{still_name}'
        scenes.append(scene)
        print(f"Prepared {scene['id']}: frames {scene['startFrame']}–{scene['endFrame']}")
    (output / 'scenes.json').write_text(json.dumps(scenes, indent=2) + '\n')
    return scenes


def validate(output):
    scenes = json.loads((output / 'scenes.json').read_text())
    for scene in scenes:
        assert scene['endFrame'] >= scene['startFrame']
        for endpoint in ['entry', 'exit']:
            for tier in scene[endpoint]['tiers'].values():
                order = np.fromfile(output / Path(tier['order']).name, dtype='<u4')
                count = tier['width'] * tier['height']
                assert len(order) == count
                assert np.array_equal(np.sort(order), np.arange(count))
                assert 0 <= tier['visibleCount'] <= count
            with Image.open(output / Path(scene[endpoint]['texture']).name) as image:
                for width, tier in scene[endpoint]['tiers'].items():
                    expected, visible = point_order(image.convert('RGB'), scene, int(width), tier['height'])
                    assert visible == tier['visibleCount']
                    assert np.array_equal(expected, np.fromfile(output / Path(tier['order']).name, dtype='<u4'))
        assert (output / Path(scene['still']).name).is_file()
        if scene.get('colorMode') == 'source':
            with Image.open(output / Path(scene['entry']['texture']).name) as image:
                expected = np.asarray(crop_rect(image.convert('RGB'), scene['colorRect']), dtype=np.float32)
            with Image.open(output / Path(scene['still']).name) as image:
                actual = np.asarray(image.convert('RGB'), dtype=np.float32)
            assert actual.shape == expected.shape
            assert np.abs(actual - expected).mean() < 5, 'Source poster differs from the complete first video frame'
    print(f'Validated {len(scenes)} scenes, both tiers and all endpoint permutations.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=Path('public/bg/bg.json'))
    parser.add_argument('--output', type=Path, default=Path('public/bg/morph'))
    parser.add_argument('--limit', type=int)
    parser.add_argument('--color-mode', choices=['duotone', 'source'], default='duotone')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if not args.check:
        prepare(args.manifest, args.output, args.limit, args.color_mode)
    validate(args.output)
