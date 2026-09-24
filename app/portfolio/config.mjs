/**
 * @typedef {Object} SectionConfig
 * @property {string} id Stable hash anchor; independent of array position.
 * @property {string} title Korean navigation title.
 * @property {string} display Large English display title.
 * @property {'intro'|'interests'|'projects'|'experience'|'credentials'|'education'|'awards'|'publications'|'skills'|'activities'|'contact'} kind
 * @property {boolean} enabled
 * @property {string} [mergeInto] Parent chapter; records remain independently editable.
 * @property {string} [groupTitle] Navigation title when chapters are combined.
 * @property {string[]} [chapterOrder] Explicit child-tab order, independent of scroll order.
 * @property {string} sceneId References SceneAsset.id.
 * @property {string} headline
 * @property {string} body Replaceable draft, never a claimed credential.
 * @property {{side:'left'|'right'}} framing Text placement.
 * @property {ContentItem[]} items
 * @property {ContentItem[]} [showcaseItems] Separate display drafts; original items remain unchanged.
 * @property {string[]} [featuredItemIds] Shared gallery representatives, referencing child showcase item IDs.
 * @property {Array<{label:string,value:string}>} [facts]
 * @property {Array<{title:string,items:ContentItem[]}>} [groups]
 * @property {Array<{label:string,value:string,suffix?:string}>} [stats]
 * @property {string[]} [toolbox]
 *
 * @typedef {Object} ContentItem
 * @property {string} id Stable selection/detail key.
 * @property {string} title
 * @property {string} description
 * @property {string} [label] Short tab label.
 * @property {string} [displayName] Short localized name for the selected interest.
 * @property {string} [tag]
 * @property {string} [meta]
 * @property {string} [period]
 * @property {string} [image] Existing background-selection image path.
 * @property {{src:string,thumbnail?:string,alt:string,temporary:boolean,hero?:{position:string,scale:number},card?:{position:string,scale:number},backdrop?:{position:string,scale:number}}} [artwork] Replaceable illustration and optional crop settings.
 * @property {string} [approach] Authored interest exploration method.
 * @property {string} [question] Authored research question.
 * @property {string} [backgroundId] Optional BackgroundTrack; active only in this section.
 * @property {Array<{title:string,body:string}>} [detailSections] Authored reading sections.
 * @property {Array<{label:string,url:string}>} [links]
 * @property {string} [role]
 * @property {string} [result]
 * @property {string[]} [tags]
 * @property {string} [detail]
 * @property {string[]} [bullets]
 * @property {string} [why]
 * @property {string} [where]
 * @property {string} [summary]
 * @property {string} [accent]
 * @property {string} [badge]
 * @property {number|null} [level] Optional authored value, never inferred proficiency.
 * @property {boolean} [placeholder]
 *
 * @typedef {{order:string, visibleCount:number, width:number, height:number}} PointTier
 * @typedef {{texture:string, tiers:Record<string,PointTier>}} SceneEndpoint
 *
 * @typedef {Object} SceneAsset
 * @property {string} id
 * @property {string} video Packed color/depth video URL.
 * @property {number} startFrame Inclusive.
 * @property {number} endFrame Inclusive last valid frame.
 * @property {number} fps
 * @property {number[]} colorRect Normalized top-left texture rectangle.
 * @property {number[]} depthRect
 * @property {number} aspect
 * @property {'duotone'|'source'} [colorMode]
 * @property {string} still
 * @property {SceneEndpoint} entry
 * @property {SceneEndpoint} exit
 */

// Edit this array to remove, disable or reorder sections. Scene IDs stay stable.
const still = (number) => `/bg/morph/scene-${String(number).padStart(2, '0')}-still.webp`;
const concept = (name, alt) => ({ src: '/art/concepts/' + name + '.webp', alt, temporary: true });
const workCharacter = (number) => ({ src: `/art/works/character-${String(number).padStart(2, '0')}.webp`, alt: `작업·경험을 표현하는 임시 성인 여성 캐릭터 일러스트 ${String(number).padStart(2, '0')}`, temporary: true });
const interestCrop = { hero: { position: '50% 0%', scale: 1 }, card: { position: '50% 0%', scale: 3 }, backdrop: { position: '50% 0%', scale: 3.2 } };
const draftDetail = '배경과 목표, 담당 역할, 작업 과정과 결과를 작성할 공간입니다. 실제 이력과 수치는 아직 입력하지 않았습니다.';
const showcaseDraft = {
  placeholder:true, period:'기간 입력 예정', role:'담당 역할 입력 예정', result:'결과 입력 예정',
  description:'기록의 배경과 주요 내용을 입력하세요.', detail:'목표, 직접 수행한 역할, 진행 과정과 확인한 결과를 입력하세요. 실제 이력과 성과는 아직 입력하지 않았습니다.',
};
const projectDraft = {
  role:'담당 역할 입력 예정', result:'검증 결과 입력 예정',
  detailSections:[
    {title:'문제',body:'누구의 어떤 문제를 해결했는지 작성하세요.'},
    {title:'접근',body:'비교한 방법과 선택의 이유를 작성하세요.'},
    {title:'구현',body:'핵심 구현과 직접 기여한 부분을 작성하세요.'},
    {title:'검증',body:'검증 방법과 관찰한 결과를 작성하세요.'},
    {title:'회고',body:'배운 점과 다음 개선 방향을 작성하세요.'},
  ],
};
/** @type {SectionConfig[]} */
export const sections = [
  {
    id: 'about', title: '소개', display: 'Ideas into\nexperiences.', kind: 'intro', enabled: true, sceneId: 'scene-01', framing: { side: 'left' },
    headline: '생각을 움직이는 경험으로.', body: '아이디어가 화면 위에서 살아나는 순간을 탐구합니다. 작은 인터랙션부터 하나의 세계까지, 이곳에 나의 작업과 관점을 담아갑니다.',
    facts: [{ label: 'BASED IN', value: '지역 입력 예정' }, { label: 'FOCUS', value: '관심 주제 입력 예정' }, { label: 'STATUS', value: '계속 만들어가는 중' }], items: [],
  },
  {
    id: 'interests', artwork: concept('interest-observatory', '신호와 관측 장비가 연결된 하늘 위 연구 관측소'), title: '관심분야', display: 'Follow the curiosity.', kind: 'interests', enabled: true, sceneId: 'scene-02', framing: { side: 'left' },
    headline: '다음 질문은 어디에서 시작될까.', body: '마음을 붙잡는 다섯 가지 질문. 주제를 선택해 탐구 방향을 살펴보세요.',
    items: [
      { id: 'bci', displayName: 'BCI', artwork: { ...interestCrop, src: '/art/interests/bci.webp', thumbnail: '/art/interests/bci.thumb.webp', alt: '뇌-컴퓨터 인터페이스를 연구하는 성인 여성 캐릭터', temporary: false }, accent: '#e564c8', summary: '신경 신호를 해석하고, 이를 소통과 상호작용으로 연결하는 주제를 탐구합니다.', label: 'BCI', title: '뇌와 컴퓨터 사이', tag: 'BRAIN–COMPUTER INTERFACE', description: '신경 신호가 새로운 소통의 방식이 될 수 있을까.', tags: ['EEG', 'Decoding', 'Interaction'], why: '신호에서 의미를 읽고, 그 의미를 실제 상호작용으로 연결하는 과정에 관한 관심을 기록합니다.', where: '연구 질문 · 신호 해석 · 인터페이스 실험', image: still(2) },
      { id: 'eeg-fmri', displayName: 'EEG·fMRI', artwork: { ...interestCrop, src: '/art/interests/eeg-fmri.webp', thumbnail: '/art/interests/eeg-fmri.thumb.webp', alt: 'EEG와 fMRI 신경 신호를 분석하는 성인 여성 캐릭터', temporary: false }, accent: '#b56de0', summary: '시간의 변화와 공간의 구조를 함께 살펴보는 다중 모달 분석에 관한 관심입니다.', label: 'EEG / fMRI', title: '서로 다른 해상도의 시선', tag: 'MULTIMODAL NEUROSCIENCE', description: '시간과 공간의 단서를 함께 읽으면 무엇이 보일까.', tags: ['EEG', 'fMRI', 'Multimodal'], why: '서로 다른 측정 방식이 담는 정보를 어떻게 연결할지 탐구 방향을 작성할 공간입니다.', where: '다중 모달 분석 · 신경과학', image: still(5) },
      { id: 'alignment', displayName: 'AI 정렬', artwork: { ...interestCrop, src: '/art/interests/alignment.webp', thumbnail: '/art/interests/alignment.thumb.webp', alt: '사람과 AI의 의도 정렬을 탐구하는 성인 여성 캐릭터', temporary: false }, accent: '#f07ab0', summary: '사람과 모델이 목표를 이해하는 방식, 그 차이를 확인하는 방법을 생각합니다.', label: 'ALIGNMENT', title: '사람의 의도에 가까이', tag: 'AI ALIGNMENT', description: '모델의 목표를 사람의 의도와 어떻게 연결할까.', tags: ['Evaluation', 'Human feedback'], why: '사람과 모델의 판단이 만나는 지점, 그 차이를 확인하는 방법에 관한 질문을 기록합니다.', where: '모델 평가 · 사람과 AI의 상호작용', image: still(7) },
      { id: 'representation', displayName: '표현 학습', artwork: { ...interestCrop, src: '/art/interests/representation.webp', thumbnail: '/art/interests/representation.thumb.webp', alt: '데이터의 학습 표현을 탐구하는 성인 여성 캐릭터', temporary: false }, accent: '#9184d9', summary: '데이터에서 학습된 표현을 관찰하고 그 안의 구조와 의미를 해석합니다.', label: 'REPRESENTATION', title: '표현 속에 담긴 구조', tag: 'REPRESENTATION LEARNING', description: '좋은 표현은 복잡한 데이터에서 무엇을 남길까.', tags: ['Embeddings', 'Learning'], why: '학습한 표현의 구조를 살펴보고 해석하는 실험을 정리할 공간입니다.', where: '표현 학습 · 시각화 · 해석', image: still(9) },
      { id: 'speech', displayName: '음성·언어', artwork: { ...interestCrop, src: '/art/interests/speech.webp', thumbnail: '/art/interests/speech.thumb.webp', alt: '음성과 언어 신호를 탐구하는 성인 여성 캐릭터', temporary: false }, accent: '#d95fa8', summary: '목소리의 신호적 특성과 언어적 의미가 만나는 지점을 살펴봅니다.', label: 'SPEECH', title: '목소리에서 의미까지', tag: 'SPEECH & LANGUAGE', description: '소리와 언어의 경계에서 어떤 정보를 발견할까.', tags: ['Audio', 'Language', 'Signals'], why: '음성의 신호적 특성과 언어적 의미를 연결하는 관심 주제를 기록합니다.', where: '음성 처리 · 언어 모델 · 신호 분석', image: still(10) },
    ],
  },
  {
    id: 'projects', title: '프로젝트', groupTitle: '작업·경험', chapterOrder: ['experience','publications','activities'], display: 'Made to be explored.', kind: 'projects', enabled: true, sceneId: 'scene-03', framing: { side: 'left' },
    featuredItemIds: ['showcase-project-01','showcase-experience-01','showcase-research-01','showcase-activity-01','showcase-project-02','showcase-research-02'],
    headline: '문제를 발견하고, 직접 만들어보기.', body: '결과물과 그 뒤의 선택을 함께 기록합니다. 프로젝트 정보는 교체 가능한 초안입니다.',
    showcaseItems: [
      { ...showcaseDraft, id:'showcase-project-01', title:'프로젝트 01', artwork:workCharacter(1), image:'/art/concepts/project-portfolio.webp' },
      { ...showcaseDraft, id:'showcase-project-02', title:'프로젝트 02', artwork:workCharacter(5), image:'/art/concepts/project-experiment.webp' },
      { ...showcaseDraft, id:'showcase-project-03', title:'프로젝트 03', artwork:workCharacter(2), image:'/art/concepts/project-observation.webp' },
      { ...showcaseDraft, id:'showcase-project-04', title:'프로젝트 04', artwork:workCharacter(3), image:'/art/concepts/project-next.webp' },
      { ...showcaseDraft, id:'showcase-project-05', title:'프로젝트 05', artwork:workCharacter(4), image:'/art/concepts/project-portfolio.webp' },
      { ...showcaseDraft, id:'showcase-project-06', title:'프로젝트 06', artwork:workCharacter(6), image:'/art/concepts/project-experiment.webp' },
    ],
    items: [
      { ...projectDraft, id: 'portfolio', artwork: concept('project-portfolio', '푸른 포털과 흰 다리가 이어지는 하늘 위 아카이브'), label: 'PORTFOLIO', title: '인터랙티브 포트폴리오', tag: 'WEB EXPERIENCE', meta: '개인 프로젝트 · 제작 중', description: '흐르는 점과 공간으로 연결하는 개인 아카이브.', tags: ['Next.js', 'R3F', 'GLSL', 'Motion'], image: still(3), detail: draftDetail, bullets: ['스크롤과 함께 재조립되는 점구름', '콘텐츠와 장면을 독립적으로 구성', '작은 화면에서는 정지 이미지로 탐색'] },
      { ...projectDraft, id: 'project-02', artwork: concept('project-experiment', '프리즘과 렌즈로 빛의 경로를 비교하는 실험실'), label: 'EXPERIMENT', title: '질문에서 시작한 실험', tag: 'PROJECT 02 · 초안', meta: '기간 · 역할 입력 예정', description: '문제를 정의하고 접근 방법을 비교한 과정을 기록하세요.', tags: ['분야 입력 예정'], image: still(4), detail: draftDetail, bullets: ['해결하려던 문제', '선택한 접근과 검증 방법'] },
      { ...projectDraft, id: 'project-03', artwork: concept('project-observation', '섬 사이 관측 장비와 신호가 연결된 해안 연구소'), label: 'RESEARCH', title: '관찰을 연결하는 작업', tag: 'PROJECT 03 · 초안', meta: '기간 · 역할 입력 예정', description: '데이터와 관찰에서 얻은 발견을 정리할 공간입니다.', tags: ['분야 입력 예정'], image: still(6), detail: draftDetail, bullets: ['핵심 질문과 데이터', '과정에서 배운 점'] },
      { ...projectDraft, id: 'project-04', artwork: concept('project-next', '구름 위 활주로와 열린 문을 향하는 하늘색 종이비행기'), label: 'NEXT', title: '다음 가능성을 위한 자리', tag: 'PROJECT 04 · 초안', meta: '기간 · 역할 입력 예정', description: '다음 작업의 결과와 선택을 이곳에 이어갑니다.', tags: ['분야 입력 예정'], image: still(8), detail: draftDetail },
    ],
  },
  {
    id: 'experience', mergeInto: 'projects', title: '경험', display: 'Learn by doing.', kind: 'experience', enabled: true, sceneId: 'scene-04', framing: { side: 'left' },
    headline: '함께 만들며 배운 것들.', body: '역할과 책임, 그리고 협업 속에서 얻은 배움을 기록합니다.',
    showcaseItems: [
      { ...showcaseDraft, id:'showcase-experience-01', title:'경험 01', artwork:workCharacter(2), image:'/art/concepts/project-observation.webp' },
      { ...showcaseDraft, id:'showcase-experience-02', title:'경험 02', artwork:workCharacter(1), image:'/art/concepts/project-experiment.webp' },
      { ...showcaseDraft, id:'showcase-experience-03', title:'경험 03', artwork:workCharacter(3), image:'/art/concepts/project-next.webp' },
      { ...showcaseDraft, id:'showcase-experience-04', title:'경험 04', artwork:workCharacter(4), image:'/art/concepts/project-portfolio.webp' },
      { ...showcaseDraft, id:'showcase-experience-05', title:'경험 05', artwork:workCharacter(5), image:'/art/concepts/project-observation.webp' },
      { ...showcaseDraft, id:'showcase-experience-06', title:'경험 06', artwork:workCharacter(6), image:'/art/concepts/project-next.webp' },
    ],
    items: [
      { id: 'experience-01', title: '함께 만든 경험', tag: 'EXPERIENCE 01', period: '기간 입력 예정', description: '소속 · 담당 역할 · 기여를 입력하세요.', meta: '소속과 역할 입력 예정', detail: draftDetail, image: still(4), bullets: ['담당한 일과 협업 방식', '기여한 내용과 배운 점'] },
      { id: 'experience-02', title: '배움을 확장한 경험', tag: 'EXPERIENCE 02', period: '기간 입력 예정', description: '참여한 과정과 새롭게 얻은 관점을 입력하세요.', meta: '소속과 역할 입력 예정', detail: draftDetail, image: still(5) },
      { id: 'experience-next', title: '다음 경험을 기다리는 자리', description: '새로운 이야기는 계속됩니다.', placeholder: true },
    ],
  },
  {
    id: 'certifications', mergeInto: 'education', title: '자격', display: 'Build a foundation.', kind: 'credentials', enabled: true, sceneId: 'scene-05', framing: { side: 'left' },
    headline: '배움을 확인하는 이정표.', body: '보유 자격과 어학 정보를 구분해 정리합니다.', items: [],
    groups: [
      { title: 'PROFESSIONAL', items: [{ id: 'cert-01', title: '전문 자격 01', description: '발급 기관 · 취득일 입력 예정', badge: '입력 전' }, { id: 'cert-02', title: '전문 자격 02', description: '발급 기관 · 취득일 입력 예정', badge: '입력 전' }] },
      { title: 'LANGUAGE PROFICIENCY', items: [{ id: 'language-01', title: '어학 평가 01', description: '평가명 · 유효 기간', badge: '—' }, { id: 'language-02', title: '어학 평가 02', description: '평가명 · 유효 기간', badge: '—' }, { id: 'language-03', title: '어학 평가 03', description: '평가명 · 유효 기간', badge: '—' }] },
    ],
  },
  {
    id: 'education', title: '학력', groupTitle: '이력·역량', chapterOrder: ['certifications','awards','skills'], display: 'Stay curious.', kind: 'education', enabled: true, sceneId: 'scene-06', framing: { side: 'right' },
    headline: '질문하는 태도를 쌓아가는 과정.', body: '교육 과정과 그 안에서 깊이 탐구한 주제를 기록합니다.',
    items: [{ id: 'education-01', title: '학교 · 교육기관', tag: 'EDUCATION', period: '입학 — 졸업 · 입력 예정', description: '전공과 교육 과정, 관심 연구 주제를 입력하세요.' }],
    stats: [{ label: 'TOTAL GPA', value: '—', suffix: '입력 전' }, { label: 'MAJOR GPA', value: '—', suffix: '입력 전' }, { label: 'CREDITS', value: '—', suffix: '입력 전' }],
  },
  {
    id: 'awards', mergeInto: 'education', title: '수상', display: 'Moments that matter.', kind: 'awards', enabled: true, sceneId: 'scene-07', framing: { side: 'left' },
    headline: '노력의 의미를 되짚는 순간.', body: '수상 기록과 그 밖의 성취를 함께 정리합니다.', items: [],
    groups: [
      { title: 'AWARDS', items: [{ id: 'award-01', title: '수상 기록 01', description: '대회 · 주최 기관 · 연도', badge: '입력 전' }, { id: 'award-02', title: '수상 기록 02', description: '대회 · 주최 기관 · 연도', badge: '입력 전' }] },
      { title: 'HONORS', items: [{ id: 'honor-01', title: '선정 · 성취 기록 01', description: '내용 입력 예정', badge: '—' }, { id: 'honor-02', title: '선정 · 성취 기록 02', description: '내용 입력 예정', badge: '—' }, { id: 'honor-03', title: '선정 · 성취 기록 03', description: '내용 입력 예정', badge: '—' }, { id: 'honor-04', title: '선정 · 성취 기록 04', description: '내용 입력 예정', badge: '—' }] },
    ],
  },
  {
    id: 'publications', mergeInto: 'projects', title: '연구', display: 'Ask. Explore. Understand.', kind: 'publications', enabled: true, sceneId: 'scene-08', framing: { side: 'left' },
    headline: '하나의 질문을 더 깊이.', body: '연구의 질문, 접근 방법과 결과를 연결해 기록합니다.',
    showcaseItems: [
      { ...showcaseDraft, id:'showcase-research-01', title:'연구 01', artwork:workCharacter(3), image:'/art/concepts/paper-research.webp' },
      { ...showcaseDraft, id:'showcase-research-02', title:'연구 02', artwork:workCharacter(6), image:'/art/concepts/project-experiment.webp' },
      { ...showcaseDraft, id:'showcase-research-03', title:'연구 03', artwork:workCharacter(1), image:'/art/concepts/project-observation.webp' },
      { ...showcaseDraft, id:'showcase-research-04', title:'연구 04', artwork:workCharacter(2), image:'/art/concepts/paper-research.webp' },
      { ...showcaseDraft, id:'showcase-research-05', title:'연구 05', artwork:workCharacter(4), image:'/art/concepts/project-experiment.webp' },
      { ...showcaseDraft, id:'showcase-research-06', title:'연구 06', artwork:workCharacter(5), image:'/art/concepts/project-observation.webp' },
    ],
    items: [{ id: 'mmn-study', artwork: concept('paper-research', '빈 연구 노트와 EEG 센서 캡, 헤드폰이 놓인 연구 책상'), detailSections: [{ title: '초록', body: '연구 배경과 목적, 핵심 질문을 작성할 공간입니다.' }, { title: '방법', body: '재현할 연구, 사용할 데이터와 분석 절차를 작성할 공간입니다.' }, { title: '기여', body: '직접 수행한 작업과 기존 연구와의 차이를 작성할 공간입니다.' }, { title: '검증', body: '비교 기준, 검증 절차와 확인된 결과를 작성할 공간입니다. 연구 결과는 아직 입력하지 않았습니다.' }], title: 'MMN-based machine learning for adult ADHD (reproduction study)', tag: 'IN PREPARATION', description: '연구 질문과 재현 과정, 접근 방법을 기록할 공간입니다.', meta: '연구 정보 입력 예정', tags: ['MMN', 'Machine learning', 'Reproduction'], image: still(8), detail: '기존 페이지의 준비 중인 연구 제목입니다. 저자, 초록, 연구 진행 상황과 기여 내용을 작성하세요.', bullets: ['재현할 연구와 핵심 질문', '분석 방법과 검증 과정'] }, { id: 'paper-next', title: 'NEXT PAPER', description: '다음 질문을 위한 빈 페이지.', placeholder: true }],
  },
  {
    id: 'skills', mergeInto: 'education', title: '스킬', display: 'Tools for possibility.', kind: 'skills', enabled: true, sceneId: 'scene-09', framing: { side: 'left' },
    headline: '도구보다, 도구로 만드는 가능성.', body: '분야별 도구와 적용 경험을 기록합니다. 숙련도는 아직 입력하지 않았습니다.',
    items: [{ id: 'machine-learning', label: 'ML', image: still(3), accent: '#8DE5EF', title: 'MACHINE LEARNING', description: 'PyTorch · Braindecode · scikit-learn', level: null }, { id: 'signal-processing', label: 'SIGNAL', image: still(2), accent: '#AAA4EA', title: 'SIGNAL PROCESSING', description: 'MNE · SciPy · NumPy', level: null }, { id: 'development', label: 'DEV', image: still(9), accent: '#78ACEF', title: 'DEVELOPMENT', description: 'React · Next.js · FastAPI · Unity', level: null }, { id: 'languages', label: 'LANGUAGES', image: still(11), accent: '#A2DBBC', title: 'LANGUAGES', description: 'Python · TypeScript · C# · SQL', level: null }],
    toolbox: ['PyTorch', 'Braindecode', 'scikit-learn', 'MNE', 'SciPy', 'NumPy', 'React', 'Next.js', 'FastAPI', 'Unity', 'Python', 'TypeScript', 'C#', 'SQL'],
  },
  {
    id: 'activities', mergeInto: 'projects', title: '활동', display: 'Beyond the screen.', kind: 'activities', enabled: true, sceneId: 'scene-10', framing: { side: 'left' },
    headline: '화면 밖에서도 이어지는 호기심.', body: '배움을 나누고 새로운 관점을 만난 순간들을 기록합니다.',
    showcaseItems: [
      { ...showcaseDraft, id:'showcase-activity-01', title:'활동 01', artwork:workCharacter(4), image:'/art/concepts/project-portfolio.webp' },
      { ...showcaseDraft, id:'showcase-activity-02', title:'활동 02', artwork:workCharacter(1), image:'/art/concepts/project-next.webp' },
      { ...showcaseDraft, id:'showcase-activity-03', title:'활동 03', artwork:workCharacter(2), image:'/art/concepts/project-observation.webp' },
      { ...showcaseDraft, id:'showcase-activity-04', title:'활동 04', artwork:workCharacter(3), image:'/art/concepts/project-experiment.webp' },
      { ...showcaseDraft, id:'showcase-activity-05', title:'활동 05', artwork:workCharacter(5), image:'/art/concepts/project-portfolio.webp' },
      { ...showcaseDraft, id:'showcase-activity-06', title:'활동 06', artwork:workCharacter(6), image:'/art/concepts/project-next.webp' },
    ],
    items: [{ id: 'seminars', tag: 'SEMINARS', title: '함께 나누는 배움', period:'기간 입력 예정', image:still(4), description: '세미나 · 발표 · 커뮤니티 참여 내용을 입력하세요.' }, { id: 'entrepreneurship', tag: 'ENTREPRENEURSHIP', title: '아이디어를 현실로', period:'기간 입력 예정', image:still(6), description: '창업 · 기획 활동과 그 과정의 배움을 입력하세요.' }, { id: 'exchange', tag: 'EXCHANGE', title: '낯선 관점과의 만남', period:'기간 입력 예정', image:still(10), description: '교류 · 협업 · 대외 활동을 입력하세요.' }],
  },
  {
    id: 'contact', title: '연락처', display: '다음 이야기를\n함께.', kind: 'contact', enabled: true, sceneId: 'scene-11', framing: { side: 'right' },
    headline: '다음 이야기를 위한 열린 공간.', body: '연락 정보는 준비 중입니다. 공개할 이메일과 채널이 정해지면 이곳에서 연결할 수 있습니다.', items: [],
  },
];

// The opening name card displays placeholders until profile fields are filled in.
export const profile = { name: '', role: '', tagline: '', affiliation: '', email: '', cv: '', links: [] };
/**
 * @typedef {Object} BackgroundTrack
 * @property {string} id
 * @property {string} video Public-relative video URL; frames follow page scroll.
 * @property {string} poster
 * @property {number[]} colorRect Normalized top-left rectangle.
 * @property {number[]} [depthRect] Legacy source metadata; ignored by the video renderer.
 * @property {number} aspect Color frame aspect ratio.
 * @property {number} [fps] Source frame rate; defaults to 30 for optional videos.
 */
/** @type {BackgroundTrack[]} Add optional item videos here and reference their ID. */
export const backgroundTracks = [];
export const assetUrl = (path) => `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${path}`;
export function activeSections(items) {
  const enabled = items.filter(item => item.enabled);
  return enabled.filter(item => !enabled.some(parent => parent.id === item.mergeInto)).map(parent => {
    const children = enabled.filter(item => item.mergeInto === parent.id);
    if (parent.chapterOrder) children.sort((a,b) => {
      const rank = item => { const index = parent.chapterOrder.indexOf(item.id); return index < 0 ? parent.chapterOrder.length : index; };
      return rank(a) - rank(b);
    });
    return children.length ? {...parent, title:parent.groupTitle || parent.title, chapters:[parent,...children]} : parent;
  });
}

export const sectionForAnchor = (items, id) => items.find(section => section.id === id || section.chapters?.some(chapter => chapter.id === id));
