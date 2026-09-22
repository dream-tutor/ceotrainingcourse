export const meta = {
  name: 'review-carnegie-site2',
  description: '데일카네기 2번째 사이트(55페이지) 다차원 리뷰 + 검증',
  phases: [
    { title: 'Review', detail: '차원별 리뷰어가 각자 관점으로 결함을 찾는다' },
    { title: 'Verify', detail: '발견된 결함마다 반박 시도 — 살아남은 것만 보고' },
  ],
}

const ROOT = 'C:/Users/goodj/Desktop/AI/기타(etc)/카네기/site2'
const SRC = 'C:/Users/goodj/Desktop/AI/기타(etc)/카네기/site'

const COMMON = `
프로젝트: ${ROOT} (데일카네기 공개과정 두 번째 홍보 사이트, 정적 사이트 생성기)
- 소스: build.js(생성기), content.js/content-courses.js/content-concerns.js/content-pages.js(문구), src/style.css + src/pages.css(디자인), src/app.js(동작)
- 데이터 원본: ${SRC}/data.js (일정·지역·과정·후기), ${SRC}/ceo-content.js (추천의 글)
- 출력: ${ROOT}/docs 에 55개 html
- 첫 사이트(${SRC})는 이미 운영 중인 별도 사이트다. 두 사이트는 같은 데이터를 쓰지만 문장은 달라야 한다(중복 콘텐츠 방지).
- 사용자 톤 규칙: AI 말투 금지, 과장 표현 금지("가장/예외 없이/절반/정말" 류), 과정 설명보다 문제 설명.

읽기 전용으로 조사하라. 파일을 고치지 마라.
반드시 실제 파일을 읽고 근거를 확인한 것만 보고하라. 추측 금지.
각 결함은 file(저장소 상대경로), line(1-based), summary(한 문장), evidence(실제 코드/텍스트 인용), why(왜 문제인지 구체적으로) 를 채워라.
사소한 취향 문제, 단순 제안은 제외하고 실제 결함만 보고하라. 없으면 빈 배열.
`

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          summary: { type: 'string' },
          evidence: { type: 'string' },
          why: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['file', 'line', 'severity', 'summary', 'evidence', 'why', 'fix'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    real: { type: 'boolean' },
    reason: { type: 'string' },
    correctedSeverity: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['real', 'reason'],
}

const DIMENSIONS = [
  {
    key: 'data-accuracy',
    prompt: `${COMMON}
관점: 데이터 정확성. 생성된 HTML이 원본 데이터(${SRC}/data.js)와 어긋나는 곳을 찾아라.
- 일정 15~25건의 개강일·요일·기수·수강료·지역·강의장이 data.js SCHEDULE/REGIONS와 일치하는가 (docs/schedule.html, docs/index.html, docs/region-*.html, docs/course-*.html 표본 대조)
- 과정 코드·이름·기간·대상이 data.js COURSES와 일치하는가
- content-courses.js의 커리큘럼·모집요강·특전이 ${SRC}/build.js DETAIL 및 ${SRC}/ceo-content.js ADMISSION과 사실관계가 같은가 (문장은 달라도 되지만 사실은 같아야 함)
- 동문 활동(ALUMNI)이 지역 페이지에 옳은 지역으로 붙는가
- 숫자 주장(900만, 90개국, 400개, 연 5000명, 3만 명, 150여 개 모듈, 250시간, ISO 9001)이 첫 사이트의 근거와 일치하는가`,
  },
  {
    key: 'build-logic',
    prompt: `${COMMON}
관점: build.js 생성 로직의 버그. 실제로 잘못된 출력을 만드는 코드를 찾아라.
- 날짜/상태 계산(schedDate, schedStatus, isActive, bySchedule)의 경계 조건 — 연도 넘김(01.11 같은 내년 날짜), 수료일 없는 행, "MM.DD" 아닌 값
- groupsOf / GROUPS 필터에서 빠지거나 중복되는 과정 (특히 tla의 CEO 대상 처리, variant 필드)
- esc() 누락으로 HTML이 깨지거나 속성이 탈출되는 곳 (특히 data-preset-course, aria-label, title, meta description 안의 따옴표)
- LIVE 통계(byGroup/byCourse/byRegion/next)가 실제 목록과 어긋나는 경우
- courseCard/regionCard/concernCard가 데이터 없는 경우(모집 0건, ALUMNI 없음, 일정 없는 지역) 이상한 문구를 내는지
- PAGE_LIST/파일명 생성, docs의 기존 html 삭제 로직에 위험이 있는지
실제로 docs/ 출력 파일을 열어 결과를 확인하고 보고하라.`,
  },
  {
    key: 'app-js',
    prompt: `${COMMON}
관점: src/app.js 런타임 버그. 55개 페이지 중 요소가 없는 페이지에서 에러가 나거나 동작이 어긋나는 곳을 찾아라.
- 홈에만 있는 요소(#heroBar, #rvDialog, #schList, #schTools, [role=tab])를 하위 페이지에서 참조할 때 null 접근
- 일정 필터 apply()의 limit/더보기/과거보기 상태 조합에서 어긋나는 경우 (예: 필터 바꿨는데 all이 true로 남아있음, nActive<=limit인데 더보기 문구가 이상함)
- 여러 .sch-list가 있는 페이지(과정/지역 페이지)에서 정렬·상태 재계산이 올바른지
- FAQ 탭 select()가 페이지에 탭이 없을 때, 또는 .qa 아코디언이 여러 묶음일 때 (faq.html은 묶음이 4개)
- 폼 제출 btn.firstChild.textContent 조작이 안전한지, 실패 시 버튼이 영영 잠기는지
- ?group=/?region= 파라미터 처리, matchMedia change 리스너 구형 브라우저
- inert 속성 미지원 브라우저 대응
docs/*.html에서 해당 요소 유무를 실제로 확인하라.`,
  },
  {
    key: 'css-layout',
    prompt: `${COMMON}
관점: CSS/레이아웃 결함. src/style.css 와 src/pages.css를 읽고 실제로 깨지는 곳을 찾아라.
- 두 파일이 이어 붙여지므로 pages.css가 style.css의 규칙을 의도치 않게 덮어쓰는 곳 (특히 .sec-head, .hero-sm, .card, 미디어쿼리 순서)
- style.css의 미디어쿼리(@media max-width:980/760/640) 뒤에 pages.css의 기본 규칙이 오면 모바일에서 데스크톱 규칙이 되살아나는 문제 — 실제로 그런 선택자가 있는지 확인
- 좁은 화면에서 넘치거나 겹치는 요소 (hero-meta, crumbs 긴 제목, cur/dl 2열, callout, chips-lg 긴 문장, 일정 행)
- .sol-live 위치, .story-fig border-radius, .rv-grid 가로 스크롤 등 이전에 고친 부분의 회귀
- 다크 섹션(.hero, .stats, .voices, .ft)에서 pages.css 흰 배경 카드(.card, .o-grid li, .venue)가 잘못 쓰이는 곳
- 접근성: 색 대비가 낮은 조합, 포커스 표시가 사라지는 곳`,
  },
  {
    key: 'copy-tone',
    prompt: `${COMMON}
관점: 한국어 문구 품질과 톤 규칙 위반. content.js, content-courses.js, content-concerns.js, content-pages.js를 정독하라.
- 사용자 톤 규칙 위반: AI 말투("~할 수 있습니다" 남발, "돕습니다", "제공합니다" 류 상투어), 과장("가장", "최고의", "반드시", "정말", "예외 없이"), 근거 없는 효과 약속
- 어색한 한국어, 비문, 조사 오류, 띄어쓰기 오류, 맞춤법
- 사실과 다르거나 과장된 주장 (교육 효과를 단정하는 문장)
- 첫 사이트(${SRC}/build.js, ${SRC}/ceo-content.js, ${SRC}/guides-*.js)의 문장을 그대로 복사한 곳 — 인용문(추천의 글, 수강 후기)은 예외로 허용
- 같은 표현이 여러 페이지에서 반복되어 지루한 곳
- 고민별 안내 12편의 "교육으로 풀리지 않는 부분"이 진짜로 솔직한지, 아니면 형식적인지`,
  },
  {
    key: 'seo-a11y',
    prompt: `${COMMON}
관점: SEO와 접근성. docs/*.html 실제 출력을 표본으로 열어 확인하라.
- title/description 중복이나 과도한 길이, 지역 24개·고민 12개 페이지의 description이 천편일률인지
- 제목 계층(h1→h2→h3) 건너뜀, 섹션에 접근 가능한 이름이 없는 경우
- JSON-LD 유효성 (Course/FAQPage/BreadcrumbList/Person/WebPage 필수 속성, BASE_URL 비었을 때 url 누락 처리)
- 이미지 alt — 장식용인데 alt가 있거나, 의미 있는데 비어 있는 경우
- 키보드 접근: details/summary, dialog, 탭, 가로 스크롤 영역, 모바일 메뉴 포커스 트랩
- aria-current, aria-live, aria-pressed 사용이 맞는지
- 우클릭·F12·텍스트선택 차단 스크립트가 접근성/사용성에 주는 실제 피해 (사용자가 요구한 기능이므로 제거 제안은 하지 말고, 부작용만 지적)
- 내부 링크 구조: 55페이지가 서로 잘 연결되는지, 고아 페이지가 있는지`,
  },
]

phase('Review')
const results = await pipeline(
  DIMENSIONS,
  (d) => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS, effort: 'high' }),
  (res, d) => {
    const found = (res && res.findings) || []
    if (!found.length) return []
    return parallel(found.slice(0, 14).map((f) => () =>
      agent(`${COMMON}
다음 결함 주장을 적대적으로 검증하라. 기본 입장은 "반박"이다. 실제 파일을 열어 확인하고, 근거가 확실할 때만 real=true로 하라.

주장 출처: ${d.key}
파일: ${f.file}:${f.line}
요약: ${f.summary}
근거로 제시된 것: ${f.evidence}
왜 문제라는가: ${f.why}
제안된 수정: ${f.fix}

확인할 것:
1. 인용된 코드/텍스트가 그 파일 그 위치에 실제로 존재하는가?
2. 주장하는 결과가 실제로 발생하는가? (조건문·CSS 우선순위·실행 순서를 따져보라. 필요하면 docs/ 출력물을 읽어 확인)
3. 다른 코드가 이미 막고 있지는 않은가?
4. 심각도가 부풀려지지 않았는가?
하나라도 확인되지 않으면 real=false.`,
        { label: `verify:${d.key}:${f.file.split('/').pop()}:${f.line}`, phase: 'Verify', schema: VERDICT, effort: 'high' })
        .then((v) => (v && v.real ? { ...f, severity: v.correctedSeverity || f.severity, verdict: v.reason, dimension: d.key } : null))
    ))
  }
)

const confirmed = results.flat().filter(Boolean)
const rank = { high: 0, medium: 1, low: 2 }
confirmed.sort((a, b) => rank[a.severity] - rank[b.severity])
log(`확인된 결함 ${confirmed.length}건`)
return { confirmed }
