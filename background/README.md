# background — 배경 에셋 파이프라인

사이트 배경에 쓰는 `public/bg/bg.mp4` + `bg.json`을 만든다. 오프라인 전용이고 사이트 빌드에는 안 들어간다.

## 왜 이런 구조인가

배경은 두 가지를 동시에 해야 한다.

1. 스크롤하면 영상 프레임이 넘어감 (anantagame.com 방식)
2. 각 챕터에서 멈춘 채로 홀로그램처럼 회전 (endfield.gryphline.com 방식)

평면 영상은 회전이 안 되고, endfield처럼 순수 3D 모델을 쓰면 영상 질감이 안 나온다.
그래서 **영상에서 깊이를 추정해 픽셀을 3D로 밀어낸 점구름**으로 간다.
시점이 하나뿐이라 크게 돌리면 가려졌던 뒷면에 구멍이 보이므로, 회전은 ±20°로 제한했다.

## 에셋 형식

컬러와 깊이를 **한 파일에 위아래로** 넣는다. 두 파일로 나누면 스크럽 중 싱크가 어긋난다.

```
┌──────────┐
│  COLOR   │  640×360
├──────────┤
│  DEPTH   │  640×360   흰색이 가까움
└──────────┘
```

`bg.json`이 해상도/프레임수/길이를 들고 있고, 런타임이 이걸 읽는다.

같이 나오는 정지 이미지 두 장이 있다.

| 파일 | 내용 | 용도 |
|---|---|---|
| `bg-poster.webp` | 첫 프레임 컬러+깊이 | 영상 받기 전에 점구름을 즉시 그린다 |
| `bg-still.webp` | 첫 프레임 컬러만 | WebGL을 못 쓰는 기기 폴백. 이 경로는 mp4를 안 받는다 |

## 인코딩이 all-intra인 이유

`video.currentTime`으로 탐색하면 브라우저는 직전 키프레임으로 간다.
일반 인코딩(GOP 250)이면 탐색 단위가 몇 초라 스크럽이 뚝뚝 끊긴다.
그래서 `-g 1`로 전 프레임을 키프레임으로 만든다. 용량은 늘지만 640×360 기준 감당 가능하다.

측정값 (합성 영상 8초 기준):

| GOP | 용량 | 초당 |
|---|---|---|
| 1 (all-intra) | 1.71 MB | 0.21 MB/s |
| 6 | 0.59 MB | 0.07 MB/s |
| 12 | 0.44 MB | 0.06 MB/s |
| 30 | 0.35 MB | 0.04 MB/s |

실사 영상은 이보다 압축이 덜 되므로 2~4배로 잡아야 한다.

## 환경

시스템 ffmpeg에 libx264가 없어서(MediaFoundation 인코더는 `-g`를 무시함) 격리 환경에 따로 넣는다.

```bash
cd background
uv venv .venv --python 3.12
uv pip install --python .venv/Scripts/python.exe imageio-ffmpeg numpy
```

깊이 추정까지 돌리려면 추가로 필요하다. torch는 용량이 크다.

```bash
uv pip install --python .venv/Scripts/python.exe torch --index-url https://download.pytorch.org/whl/cu124
uv pip install --python .venv/Scripts/python.exe transformers pillow
```

## 사용법

실제 영상으로:

```bash
cd background/src
../.venv/Scripts/python.exe depth.py ../input/source.mp4
../.venv/Scripts/python.exe pack.py
```

개발용 합성 영상으로 (torch 불필요):

```bash
cd background/src
../.venv/Scripts/python.exe make_placeholder.py
../.venv/Scripts/python.exe pack.py
```

`pack.py --compare`를 붙이면 GOP별 용량을 비교해준다. `--gop 6`으로 용량을 1/3로 줄일 수도 있다.

ema만 다시 잡고 싶을 때는 추론을 건너뛴다. 원시 깊이가 240프레임 기준 221MB라 다 쓰면 지울 것.

```bash
../.venv/Scripts/python.exe depth.py ../input/source.mp4 --keep-raw
../.venv/Scripts/python.exe depth.py ../input/source.mp4 --reuse --ema 0.7
```

## 파일

| 파일 | 역할 |
|---|---|
| `src/make_placeholder.py` | 깊이를 아는 합성 장면 생성. 런타임 검증용 |
| `src/depth.py` | Depth Anything V2로 깊이 추정. 전역 정규화 + 시간 EMA로 떨림을 잡는다 |
| `src/pack.py` | 컬러/깊이를 붙여 all-intra mp4로 인코딩, `bg.json` 생성 |
| `src/fftool.py` | 번들 ffmpeg 경로 |
| `src/compare_depth.py` | 추정 깊이를 정답과 비교. 합성 장면 검증 전용 |
| `input/` | 원본 영상 (gitignore) |
| `work/` | 중간 산출물 (gitignore) |

## 깊이 떨림에 대해

프레임마다 독립적으로 추정하면 깊이가 흔들리고, 점구름에서는 Z축 지터로 아주 잘 보인다.
`depth.py`가 거는 대응은 두 가지다.

- **전역 정규화**: 프레임별로 min/max를 잡으면 밝기 변화만으로 장면 전체가 앞뒤로 출렁인다.
  클립 전체에서 1~99 퍼센타일을 한 번만 구해 고정한다.
- **시간 EMA**: 기본 0.6.

합성 장면(정답 깊이를 아는 240프레임)으로 잰 값이다. `compare_depth.py`로 재현할 수 있다.

| ema | 시간변화 / 정답 대비 | 정지 영역 떨림 | 정답 상관 |
|---|---|---|---|
| 0.0 | 2.66x | 1.85 단계/프레임 | 0.882 |
| 0.35 | 2.04x | 1.28 | 0.879 |
| **0.6** | **1.65x** | **0.91** | **0.872** |
| 0.8 | 1.29x | 0.62 | 0.851 |

0.6까지는 떨림이 절반으로 주는데 상관은 1%만 떨어져서 거의 공짜다.
0.8부터는 지연 때문에 상관이 3.5% 빠진다. 움직임이 느린 영상이면 더 올려도 된다.

## 어두운 영역 아티팩트

텅 빈 검은 영역은 깊이 단서가 없어서 모델이 "가깝다"고 헛짚는다.
합성 장면 테스트에서 프레임 가장자리에 밝은 후광이 생겼고, 점구름에서는 테두리를 따라
카메라 쪽으로 튀어나온 점 벽이 된다.

런타임 셰이더에서 루미넌스로 걸러낸다(`HologramBackground.js`의 `vAlpha *= smoothstep(0.02, 0.12, ...)`).
정보가 없는 곳은 아예 안 그린다. 실사 영상은 대부분 밝아서 걸러지는 비율이 훨씬 낮다.
