// ============================================================
// 데일카네기 두 번째 사이트 — 정적 사이트 생성기
// 실행: node build.js  →  docs/ 에 전체 페이지 · style.css · app.js · assets/ 생성
//
// 페이지 구성
//   index.html            홈
//   courses.html          과정 안내 (교육 대상별 묶음)  +  course-<key>.html 과정별 상세 9개
//   schedule.html         개강 일정 전체
//   regions.html          지역별 안내                  +  region-<slug>.html 지역별 24개
//   concerns.html         고민별 안내                  +  concern-<slug>.html 12개
//   corporate.html        기업 맞춤 교육
//   reviews.html          추천의 글 · 수강 후기 전문
//   about.html            데일 카네기 소개
//   faq.html              자주 묻는 질문
//   404.html              없는 주소
//
// · 일정·지역·과정·후기는 첫 사이트(../site/data.js)와 같은 데이터를 쓴다.
//   일정이 바뀌면 그 파일만 고치고 두 사이트를 각각 다시 빌드하면 된다.
// · 문구는 content*.js, 디자인은 src/style.css, 동작은 src/app.js
// ============================================================
const fs = require("fs");
const path = require("path");
const { YEAR_LABEL, FORM_ENDPOINT, PHONE, SCHEDULE, REGIONS, BRANCH, COURSES, REVIEWS, ALUMNI } = require("../site/data.js");
const { ENDORSEMENTS } = require("../site/ceo-content.js"); // 추천의 글 — 공인의 발언이라 원문 인용
const C = require("./content.js");
const { COURSE_DETAIL, COURSE_GROUPS } = require("./content-courses.js");
const { CONCERNS } = require("./content-concerns.js");
const { ABOUT, CORPORATE, REGION, PAGES } = require("./content-pages.js");
const { TOPICS } = require("./content-topics.js");

// ------------------------------------------------------------
// 사이트 설정
// ------------------------------------------------------------
// IndexNow 공용 키 — 첫 사이트·드림과외 등과 같은 값을 쓴다
const INDEXNOW_KEY = "5e5ad86af25533efae3948773b676a6c";
const SUFFIX_MAX = 40; // 접미사까지 더한 최종 제목의 상한 (검색 결과에서 잘리지 않는 길이)
const SITE = {
  // 도메인이 정해지면 입력 (예: "https://example.co.kr"). 비어 있으면 canonical·og:url·sitemap을 빼고 noindex로 빌드한다
  BASE_URL: "https://ceotrainingcourse.com",
  NAME: "데일카네기 리더십 트레이닝",
  TAG: "리더십 트레이닝", // 헤더 로고 옆 한글 표기
  TITLE: `데일카네기 리더십 교육 | 최고경영자 코스·DCC·기업교육 ${YEAR_LABEL} 일정`,
  DESC: `데일카네기 최고경영자 코스, 데일카네기 코스(DCC), 리더십·프레젠테이션 과정과 기업 맞춤 교육 안내. ${YEAR_LABEL} 전국 개강 일정과 상담 신청.`,
  SUFFIX: " | 데일카네기 리더십 트레이닝",
  // 첫 사이트와 같은 규칙: 우클릭·F12·드래그·텍스트 선택 막기
  // 텍스트 선택·우클릭 막기는 전 사이트 규칙상 새 사이트에 넣지 않는다(2026-09-15 과외 계열에서 해제 —
  // 방문자가 번호·주소를 복사하지 못하는 부작용). 첫 사이트에는 아직 켜져 있다
  PROTECT: false,
  // 방문 분석 스크립트 (첫 사이트는 data-site="carnegie").
  // PC에서 전화 버튼을 누르면 번호 창을 띄우는 것도 이 스크립트가 전 사이트 공통으로 한다.
  // ⚠ 키는 sangsang-workers/src/analytics.js 의 SITES·SITE_ORDER·SITE_GROUPS 세 곳에
  //    모두 등록해야 한다. 빠뜨리면 /collect 가 400으로 버려 수집이 조용히 0건이 된다
  TRACKER: { src: "https://xn--vb0by3y5wigqb.com/t.js", site: "ceotraining" },
};

const OUT = path.join(__dirname, "docs"); // 첫 사이트와 같은 배포 구조 (GitHub Pages: main 브랜치 /docs)
const SRC = path.join(__dirname, "src");
const ASSET_FROM = path.join(__dirname, "..", "site", "assets"); // 얼굴 처리된 사진만 들어 있는 폴더 — 원본(교육과정사진)은 쓰지 않는다
// 이 사이트만의 자산은 여기에 둔다. 같은 이름이 있으면 이쪽이 이긴다.
// 공유 카드(og.png)처럼 사이트 이름이 박히는 것은 첫 사이트와 같은 파일을 쓸 수 없다
const ASSET_OWN = path.join(__dirname, "assets");
const ASSETS = ["dc-logo-white.png", "dc-logo-black.png", "class-001.jpg", "class-006.jpg", "class-007.jpg", "class-009.jpg", "dale-book.jpg", "og.png"];
const VER = Date.now().toString(36); // 빌드마다 갱신 — CSS·JS 캐시 어긋남 방지

const fee = (v) => (v == null ? "미정" : v.toLocaleString("ko-KR") + "원");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lines = (arr) => arr.map((t) => `<span class="ln">${esc(t)}</span>`).join(" ");
const tl = (t) => (Array.isArray(t) ? lines(t) : esc(t)); // 제목: 배열이면 줄 단위, 문자열이면 그대로
const R = (s, name) => s.replace(/\{R\}/g, name);


// 조사는 앞말 받침에 따라 갈린다 — 지역명·지사명·주제명이 값으로 들어오므로 고정할 수 없다.
// 괄호가 뒤에 붙어도 마지막 한글을 기준으로 읽는다 — "전북(전주)" 는 '주'로 본다
const jong = (w) => {
  const m = String(w).match(/[가-힣0-9](?=[^가-힣0-9]*$)/);
  if (!m) return 0; // 영문·기호로 끝나면 받침 없는 것으로 본다
  const c = m[0].charCodeAt(0);
  if (c >= 48 && c <= 57) return [21, 8, 0, 16, 0, 0, 1, 8, 8, 0][c - 48]; // 영 일 이 삼 사 오 육 칠 팔 구
  return (c - 0xac00) % 28;
};
const eun = (w) => (jong(w) ? "은" : "는");
const iga = (w) => (jong(w) ? "이" : "가");
const eul = (w) => (jong(w) ? "을" : "를");

// ------------------------------------------------------------
// 개강 상태 — 첫 사이트와 같은 기준. 페이지에서도 접속 시점 기준으로 다시 계산한다(app.js)
//   접수 중(open) → 개강 7일 이내(soon) → 개강 완료(past) → 수료일 경과(done) / "MM.DD"가 아니면 일정 문의(tba)
// ------------------------------------------------------------
const TODAY_KST = (() => { const d = new Date(Date.now() + 9 * 3600 * 1000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })();
// 날짜 해석은 lib-dates.js 한 곳에만 둔다 — test-dates.js가 같은 함수를 검사한다
const D = require("./lib-dates.js");
const schedDate = (mmdd, ref = TODAY_KST) => D.schedDate(mmdd, ref);
const closeDate = (r) => D.closeDate(r, TODAY_KST);
const schedStatus = (r) => D.schedStatus(r, TODAY_KST);
const isoDay = D.isoDay;
const TODAY = isoDay(TODAY_KST);
const ST_LABEL = { open: "접수 중", soon: "마감 임박", past: "개강 완료", done: "종료", tba: "일정 문의" };
const isActive = (r) => D.isActive(r, TODAY_KST);
const openKey = (r) => { const t = schedDate(r.open); return t == null ? "9999" : isoDay(t); };
const byOpen = (a, b) => openKey(a).localeCompare(openKey(b));
const bySchedule = (a, b) => (isActive(a) === isActive(b) ? byOpen(a, b) : isActive(a) ? -1 : 1);
const isDayCourse = (r) => /일$/.test(String(r.weeks || ""));
const nextOf = (rows) => rows.filter((r) => schedDate(r.open) != null).sort(byOpen)[0];
// "목·금" 같은 표기를 schema.org DayOfWeek로 — 구조화 데이터에 한글 요일을 그대로 넣으면 읽히지 않는다
const DAY_LD = { 월: "Monday", 화: "Tuesday", 수: "Wednesday", 목: "Thursday", 금: "Friday", 토: "Saturday", 일: "Sunday" };
const byDayLd = (day) => String(day || "").split(/[·,\s]+/).map((d) => DAY_LD[d.trim()]).filter(Boolean).map((d) => `https://schema.org/${d}`);
const nextLabel = (r) => (r ? `${r.open}(${r.day})` : "");

// 일정표 필터 = 교육 대상 01~03과 같은 묶음
const GROUPS = [
  { key: "ceo", label: "경영자", courses: ["ceo"] },
  { key: "leader", label: "리더 · 팀장", courses: ["tla", "lac", "ltm", "dylp"] },
  { key: "personal", label: "직장인 · 개인", courses: ["dcc", "hip", "dcs", "youth"] },
];
function groupsOf(r) {
  const g = GROUPS.filter((x) => x.courses.includes(r.course)).map((x) => x.key);
  // CEO 대상 기수는 경영자 필터에도 넣는다 — 과정 이름이 아니라 데이터의 variant로 판정한다
  if (!g.includes("ceo") && /CEO|경영자/.test(String(r.variant || ""))) g.push("ceo");
  return g;
}
const COURSE_ORDER = ["ceo", "dcc", "dcs", "lac", "ltm", "dylp", "hip", "tla", "youth"];
const BRANCH_ORDER = ["hq", "gyeonggi", "daejeon", "jeonbuk", "daegu", "busan", "changwon", "gwangju", "ulsan"];
const courseFile = (k) => `course-${k}.html`;
const regionFile = (s) => `region-${s}.html`;
const concernFile = (c) => `concern-${c.slug}.html`;
const topicFile = (t) => `topic-${t.slug}.html`;
const comboFile = (regionSlug, t) => `${regionSlug}-${t.slug}.html`;
const COMBO_TOPICS = TOPICS.filter((t) => t.combo);

// 빌드 시점의 모집 현황 (페이지에서 접속 시점 기준으로 다시 계산한다)
const ACTIVE = SCHEDULE.filter(isActive);
const LIVE = {
  count: ACTIVE.length,
  regions: new Set(ACTIVE.map((r) => r.region)).size,
  next: nextOf(ACTIVE),
  byGroup: Object.fromEntries(GROUPS.map((g) => [g.key, ACTIVE.filter((r) => groupsOf(r).includes(g.key)).length])),
  byCourse: Object.fromEntries(COURSE_ORDER.map((k) => [k, ACTIVE.filter((r) => r.course === k).length])),
  byRegion: Object.fromEntries(Object.keys(REGIONS).map((s) => [s, ACTIVE.filter((r) => r.region === s).length])),
};

// 모든 페이지에 싣는 일정 요약 — 일정표가 없는 페이지에서도 '모집 N개 기수' 같은 숫자를
// 접속 시점 기준으로 다시 계산할 수 있게 한다 (빌드 시점 값으로 굳으면 시간이 갈수록 어긋난다)
const SCHED_JSON = JSON.stringify(SCHEDULE.map((r) => ({
  o: isoDay(schedDate(r.open)),
  c: isoDay(closeDate(r)),
  d: r.open,
  w: r.day || "",
  r: r.region,
  k: r.course,
  g: groupsOf(r),
}))).replace(/</g, "\\u003c");

// ------------------------------------------------------------
// 조각
// ------------------------------------------------------------
const IC = {
  arrow: `<svg class="ic ic-arrow" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 10h11M10.5 5.5 15 10l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  prev: `<svg class="ic" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M12 5 7 10l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg class="ic" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pause: `<svg class="ic ic-pause" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M7 5v10M13 5v10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  play: `<svg class="ic ic-play" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M7.5 5.2v9.6L15 10z" fill="currentColor"/></svg>`,
  phone: `<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6.6 3.8h2.6l1.3 3.6-1.7 1.3a11.6 11.6 0 0 0 6.5 6.5l1.3-1.7 3.6 1.3v2.6a2 2 0 0 1-2.2 2A16.4 16.4 0 0 1 4.6 6a2 2 0 0 1 2-2.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  plus: `<svg class="ic ic-plus" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M10 4.5v11M4.5 10h11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  close: `<svg class="ic" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
};

const NAV = [
  ["과정 안내", "courses.html"],
  ["개강 일정", "schedule.html"],
  ["지역별 안내", "regions.html"],
  ["고민별 안내", "concerns.html"],
  ["기업교육", "corporate.html"],
  ["데일 카네기", "about.html"],
];
const NAV_MORE = [["주제별 안내", "topics.html"], ["수강 후기", "reviews.html"], ["자주 묻는 질문", "faq.html"]];

function headerHtml(file) {
  const cur = (h) => (file === h ? ' aria-current="page"' : "");
  const links = NAV.map(([t, h]) => `<a href="${h}"${cur(h)}>${t}</a>`).join("");
  return `<header class="hd" id="hd">
  <div class="wrap hd-in">
    <a class="hd-brand" href="index.html" aria-label="Dale Carnegie ${SITE.TAG} 홈으로">
      <img class="logo logo-w" src="assets/dc-logo-white.png" alt="Dale Carnegie" width="900" height="229">
      <img class="logo logo-b" src="assets/dc-logo-black.png" alt="" width="900" height="229" aria-hidden="true">
      <span class="hd-tag">${SITE.TAG}</span>
    </a>
    <nav class="hd-nav" aria-label="주요 메뉴">${links}</nav>
    <div class="hd-act">
      <a class="hd-pill hd-pill-new" href="schedule.html"><b>NEW</b>${YEAR_LABEL} 모집</a>
      <a class="hd-pill hd-pill-cta" href="#consult">상담 신청</a>
      <button type="button" class="hd-burger" id="burger" aria-label="메뉴 열기" aria-expanded="false" aria-controls="mnav"><span></span><span></span></button>
    </div>
  </div>
</header>
<div class="mnav" id="mnav" hidden>
  <nav class="mnav-in" aria-label="모바일 메뉴">
    ${[...NAV, ...NAV_MORE].map(([t, h], i) => `<a href="${h}"${cur(h)}><small>${String(i + 1).padStart(2, "0")}</small>${t}</a>`).join("\n    ")}
    <a class="mnav-cta" href="#consult">상담 신청 ${IC.arrow}</a>
  </nav>
</div>`;
}

// 브레드크럼 — trail: [["홈","index.html"], ["과정 안내","courses.html"], ["최고경영자 코스", null]]
const abs = (h) => `${SITE.BASE_URL}/${h === "index.html" ? "" : h}`;
function crumbsHtml(trail) {
  return `<nav class="crumbs-nav" aria-label="현재 위치"><ol class="crumbs">${trail.map(([t, h]) => `<li>${h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`}</li>`).join("")}</ol></nav>`;
}
function crumbsLd(trail) {
  if (!SITE.BASE_URL) return null;
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: trail.map(([t, h], i) => ({ "@type": "ListItem", position: i + 1, name: t, ...(h ? { item: abs(h) } : {}) })) };
}

// 하위 페이지 공통 히어로 (홈보다 낮은 어두운 띠)
function heroSm({ trail, badge, eyebrow, title, sub, extra = "", actions = null }) {
  const acts = actions ? `<div class="hero-actions">${actions.map(([t, h, primary]) => `<a class="btn ${primary ? "btn-white" : "btn-line"}" href="${h}">${esc(t)}${primary ? IC.arrow : ""}</a>`).join("")}</div>` : "";
  return `<section class="hero hero-sm" id="top">
  <div class="hero-bg" aria-hidden="true"><i class="glow g1"></i><i class="glow g2"></i><i class="grain"></i></div>
  <div class="wrap">
    ${trail ? crumbsHtml(trail) : ""}
    ${badge ? `<span class="hero-badge">${esc(badge)}</span>` : ""}
    ${eyebrow ? `<p class="hero-eyebrow">${esc(eyebrow)}</p>` : ""}
    <h1 class="hero-title">${Array.isArray(title) ? `<span class="ln">${esc(title[0])}</span> <span class="ln hl">${esc(title[1])}</span>` : esc(title)}</h1>
    ${sub ? `<p class="hero-sub">${esc(sub)}</p>` : ""}
    ${extra}
    ${acts}
  </div>
</section>`;
}

const secHead = ({ eyebrow, title, sub, dark = false, cls = "" }) =>
  `<div class="sec-head reveal${cls ? " " + cls : ""}">${eyebrow ? `<p class="eyebrow${dark ? " on-dark" : ""}">${esc(eyebrow)}</p>` : ""}<h2 class="h-xl${dark ? " on-dark" : ""}">${tl(title)}</h2>${sub ? `<p class="lead${dark ? " on-dark" : ""}">${esc(sub)}</p>` : ""}</div>`;

// 일정 행 — 수료일은 표기하지 않는다(첫 사이트와 같은 규칙). 이틀 과정만 교육일 전체를 적는다
function schedRow(r) {
  const st = schedStatus(r);
  const c = COURSES[r.course];
  const reg = REGIONS[r.region];
  const courseName = r.variant && !/대상$/.test(r.variant) ? r.variant : c.name;
  const period = isDayCourse(r) && r.close ? `${r.open}~${r.close} · ${r.weeks}` : `${r.weeks}${r.day ? ` · 매주 ${r.day}요일` : ""}${r.time ? ` ${r.time}` : ""}`;
  return `<li class="sch-row st-${st}" data-groups="${groupsOf(r).join(" ")}" data-region="${r.region}" data-open="${isoDay(schedDate(r.open))}" data-close="${isoDay(closeDate(r))}" data-day="${esc(r.day || "")}" data-label="${esc(r.open)}">
        <div class="sch-date"><strong>${esc(r.open)}</strong><span>${esc(r.day || "")}</span></div>
        <div class="sch-main"><h3><a href="${regionFile(r.region)}">${esc(r.name)}</a>${r.gi ? ` <em>${esc(r.gi)}기</em>` : ""}</h3><p><a href="${courseFile(r.course)}">${esc(courseName)}</a> · ${esc(period)}</p></div>
        <div class="sch-end">
          <div class="sch-fee">${fee(r.fee)}${r.includes ? `<button type="button" class="fee-note" aria-label="${esc(r.name)} 수강료 포함 항목" data-note="${esc(r.includes)}">포함 항목</button>` : ""}</div>
          <div class="sch-st"><span class="st-badge">${ST_LABEL[st]}</span></div>
          <a class="sch-cta" href="#consult" data-preset-course="${esc(c.name)}" data-preset-region="${esc(reg.name)}" aria-label="${esc(r.name)} 상담 신청">상담${IC.arrow}</a>
        </div>
      </li>`;
}
// tools: 대상·지역 필터가 있는 전체 목록(홈·일정 페이지) / 없으면 그대로 다 보여 주는 목록(과정·지역 페이지)
function schedListHtml(rows, { tools = false } = {}) {
  const items = rows.slice().sort(bySchedule).map(schedRow).join("\n      ");
  if (!tools) return `<ul class="sch-list reveal">\n      ${items}\n    </ul>`;
  const pills = [`<button type="button" class="pill is-on" role="radio" data-group="all" aria-checked="true">전체</button>`]
    .concat(GROUPS.map((g) => `<button type="button" class="pill" role="radio" data-group="${g.key}" aria-checked="false" tabindex="-1">${g.label}</button>`)).join("");
  const regionOpts = Object.entries(REGIONS).map(([slug, r]) => `<option value="${slug}">${r.name}</option>`).join("");
  return `<div class="sch-tools reveal" id="schTools">
      <div class="pills" role="radiogroup" aria-label="교육 대상으로 거르기">${pills}</div>
      <label class="sch-select"><span class="sr">지역 선택</span><select id="schRegion"><option value="all">전 지역</option>${regionOpts}</select></label>
    </div>
    <p class="sch-count reveal" id="schCount" aria-live="polite"></p>
    <ul class="sch-list reveal" id="schList">
      ${items}
    </ul>
    <p class="sch-empty" id="schEmpty" hidden>${esc(C.SCHEDULE_COPY.empty)} <a href="#consult">상담 신청하기</a></p>
    <div class="sch-foot">
      <button type="button" class="sch-more" id="schMore" aria-expanded="false" hidden><span></span>${IC.plus}</button>
      <button type="button" class="sch-past" id="schPast" aria-expanded="false" hidden>이미 개강한 기수 <b></b>개 <i>보기</i></button>
    </div>`;
}

// 카드 아래 '모집 현황' 줄 — 빌드 시점 값으로 찍되, app.js가 접속 시점 기준으로 다시 채운다.
// region을 주면 그 지역 기수만 센다 (지역 페이지에서 전국 숫자를 보여 주면 안 된다)
function liveFoot({ course = null, region = null, none }) {
  const rows = ACTIVE.filter((r) => (!course || r.course === course) && (!region || r.region === region));
  const next = nextOf(rows);
  const txt = rows.length
    ? `<i class="dot"></i>${rows.length}개 기수 모집 중${next ? ` · ${esc(next.open)} 개강` : ""}`
    : esc(none);
  const attrs = [course ? ` data-live-course="${course}"` : "", region ? ` data-live-region="${region}"` : "", ` data-live-none="${esc(none)}"`].join("");
  return `<span class="card-foot"${attrs}><span class="live-txt">${txt}</span><b>${IC.arrow}</b></span>`;
}

// 카드
function courseCard(k, region = null) {
  const c = COURSES[k];
  const none = region ? `${REGIONS[region].name} 개강 일정은 문의 시 안내` : "개강 일정은 문의 시 안내";
  return `<a class="card card-course reveal" href="${courseFile(k)}">
        <span class="card-code">${esc(c.code)}</span>
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.tag)}</p>
        <dl class="card-meta"><div><dt>기간</dt><dd>${esc(c.duration)}</dd></div><div><dt>대상</dt><dd>${esc(c.target)}</dd></div></dl>
        ${liveFoot({ course: k, region, none })}
      </a>`;
}
// 과정이 하나뿐인 묶음(경영자)은 카드 하나가 덩그러니 남으므로 사진을 쓴 가로형 카드로 낸다
function courseFeature(k) {
  const c = COURSES[k];
  const d = COURSE_DETAIL[k];
  return `<a class="feature reveal" href="${courseFile(k)}">
        <span class="feature-fig"><img src="assets/${d.img}" alt="" loading="lazy" decoding="async" aria-hidden="true"></span>
        <span class="feature-body">
          <span class="card-code">${esc(c.code)}</span>
          <strong>${esc(c.name)}</strong>
          <span class="feature-lead">${esc(d.lead)}</span>
          <span class="feature-meta"><i>${esc(c.duration)}</i><i>${esc(c.target)}</i></span>
          ${liveFoot({ course: k, none: "개강 일정은 문의 시 안내" })}
        </span>
      </a>`;
}
function corpCard() {
  return `<a class="card card-course reveal" href="corporate.html">
        <span class="card-code">Corporate</span>
        <h3>기업 맞춤 교육</h3>
        <p>사전 진단에서 시작해 회사마다 다르게 설계합니다</p>
        <dl class="card-meta"><div><dt>형태</dt><dd>사내·단체 과정 (4시간 특강부터 여러 회차까지)</dd></div><div><dt>대상</dt><dd>기업 · 기관 · 단체</dd></div></dl>
        <span class="card-foot">진행 방식 보기<b>${IC.arrow}</b></span>
      </a>`;
}
function regionCard(slug) {
  const r = REGIONS[slug];
  return `<a class="card card-region reveal" href="${regionFile(slug)}">
        <h3>${esc(r.name)}</h3>
        <p>${esc(BRANCH[r.branch].label)}</p>
        ${liveFoot({ region: slug, none: "다음 기수 준비 중" })}
      </a>`;
}
function concernCard(c) {
  return `<a class="card card-concern reveal" href="${concernFile(c)}">
        <span class="card-word">${esc(c.word)}</span>
        <h3>“${esc(c.quote)}”</h3>
        <p>${esc(c.one)}</p>
        <span class="card-foot">원인과 방법 보기<b>${IC.arrow}</b></span>
      </a>`;
}
// 그 지역에서만 참인 사실들 — 조합 페이지 본문을 지역마다 다르게 만드는 재료
function regionFacts(slug) {
  const r = REGIONS[slug];
  const br = BRANCH[r.branch];
  const all = SCHEDULE.filter((x) => x.region === slug);
  const act = all.filter(isActive);
  const courses = [...new Set(all.map((x) => x.course))];
  const gi = all.filter((x) => x.gi).map((x) => +x.gi).filter((n) => !isNaN(n));
  const sisters = Object.keys(REGIONS).filter((x) => x !== slug && REGIONS[x].branch === r.branch);
  const alum = ALUMNI.filter((a) => a.region === slug);
  const fees = [...new Set(act.map((x) => x.fee).filter(Boolean))].sort((a, b) => a - b);
  const out = [];
  if (gi.length) {
    const top = Math.max(...gi);
    out.push(top >= 5
      ? `${r.name}에서 열린 기수 가운데 가장 높은 기수는 ${top}기입니다. 한 지역에서 기수 번호가 이만큼 쌓였다는 것은 그동안 같은 과정이 반복해서 열렸다는 뜻입니다.`
      : `${r.name}은 기수 번호가 아직 ${top}기입니다. 이제 자리를 잡아 가는 지역이라 한 기수 인원이 적고, 그만큼 서로 이야기할 시간이 깁니다.`);
  }
  if (courses.length) out.push(`${YEAR_LABEL} 일정에 올라온 ${r.name} 과정은 ${courses.map((k) => COURSES[k].name).join(", ")}입니다.`);
  out.push(`${r.name} 기수는 ${br.label}${iga(br.label)} 운영합니다.`);
  if (sisters.length) out.push(`${br.label}${eun(br.label)} ${r.name} 외에 ${sisters.map((x) => REGIONS[x].name).join(", ")}도 함께 관할합니다. 이 지역에 기수가 열리지 않는 때에는 관할 안의 다른 지역 기수로 안내해 드립니다.`);
  else out.push(`${br.label}${eun(br.label)} ${r.name} 지역을 단독으로 맡고 있어, 일정이 이 지역 사정에 맞춰 잡힙니다.`);
  if (alum.length) out.push(`수료 후에는 ${alum[0].name} 동문회에 들어갑니다. ${alum[0].acts.slice(0, 3).join(", ")} 같은 모임이 운영되고 있습니다.`);
  if (fees.length) out.push(fees.length === 1 ? `현재 모집 중인 기수의 수강료는 ${fee(fees[0])}입니다.` : `현재 모집 중인 기수의 수강료는 ${fee(fees[0])}부터 ${fee(fees[fees.length - 1])}까지입니다.`);
  return out;
}

function topicCard(t, region = null) {
  const href = region ? comboFile(region, t) : topicFile(t);
  const name = region ? `${REGIONS[region].name} ${t.kw}` : t.kw;
  return `<a class="card card-topic reveal" href="${href}">
        <span class="card-word">${esc(t.word || t.kw)}</span>
        <h3>${esc(name)}</h3>
        <p>${esc(region ? R(t.regionLead, REGIONS[region].name) : t.lead)}</p>
        <span class="card-foot">자세히 보기<b>${IC.arrow}</b></span>
      </a>`;
}
const relatedCards = (keys) => keys.map((k) => (k === "corporate" ? corpCard() : courseCard(k))).join("\n      ");
const faqItem = (q, a, n, open = false) => `<details class="qa"${open ? " open" : ""}><summary><span class="qa-no">Q${String(n).padStart(2, "0")}</span><span class="qa-q">${esc(q)}</span>${IC.plus}</summary><div class="qa-a"><p>${esc(a)}</p></div></details>`;
const FAQ_FLAT = C.FAQ.flatMap((g) => g.items);

// 상담 신청 — 입력 항목·동의 방식은 첫 사이트와 같게 맞춘다 (같은 접수 시트(GAS)로 들어가기 때문)
function consultHtml(preset = {}) {
  const K = C.CONSULT;
  const sel = (v, p) => (p && v === p ? " selected" : "");
  const courseOpts = Object.values(COURSES).map((c) => `<option value="${esc(c.name)}"${sel(c.name, preset.course)}>${esc(c.name)} (${c.code})</option>`).join("")
    + `<option value="기업 맞춤 교육"${sel("기업 맞춤 교육", preset.course)}>기업 맞춤 교육 (사내·단체)</option><option value="기타 문의">기타 문의</option>`;
  const regionOpts = Object.values(REGIONS).map((r) => `<option value="${esc(r.name)}"${sel(r.name, preset.region)}>${esc(r.name)}</option>`).join("") + `<option value="기타/미정">기타/미정</option>`;
  return `<dialog class="consult-dlg" id="consult" aria-labelledby="consultT">
  <button type="button" class="dlg-x" data-close aria-label="닫기">${IC.close}</button>
  <div class="consult-in">
    <div class="consult-copy">
      <p class="eyebrow">${K.eyebrow}</p>
      <h2 class="h-xl" id="consultT">${lines(K.title)}</h2>
      <p class="lead">${esc(K.sub)}</p>
      <ul class="ticks">${K.points.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    </div>
    <form class="form" id="consultForm" novalidate>
      <div class="form-grid">
        <label class="fd"><span>이름 <b>*</b></span><input type="text" name="이름" required placeholder="성함" autocomplete="name"></label>
        <label class="fd"><span>연락처 <b>*</b></span><span class="fd-tel"><select name="연락처앞" aria-label="휴대전화 앞자리"><option value="010" selected>010</option><option value="011">011</option><option value="016">016</option><option value="017">017</option><option value="018">018</option><option value="019">019</option></select><input type="tel" name="연락처" required placeholder="1234-5678" inputmode="numeric" aria-label="휴대전화 뒷자리" autocomplete="tel-national"></span></label>
        <label class="fd"><span>소속 <b>*</b></span><input type="text" name="소속" required placeholder="예: OO전자 / 자영업" autocomplete="organization"></label>
        <label class="fd"><span>직급</span><input type="text" name="직급" placeholder="예: 대표 / 팀장" autocomplete="organization-title"></label>
        <label class="fd"><span>문의 과정 <b>*</b></span><select name="관심과정" required><option value="">선택해 주세요</option>${courseOpts}</select></label>
        <label class="fd"><span>문의 지역 <b>*</b></span><select name="지역" required><option value="">선택해 주세요</option>${regionOpts}</select></label>
        <label class="fd fd-wide"><span>문의 내용</span><textarea name="문의내용" rows="4" placeholder="문의하시게 된 계기, 지금 겪고 있는 상황, 궁금한 점을 편하게 적어 주세요"></textarea></label>
      </div>
      <div class="agree">
        <input type="checkbox" id="agree" name="동의" required checked>
        <label for="agree">개인정보 수집·이용에 동의합니다. <em>(필수)</em></label>
      </div>
      <details class="agree-more">
        <summary>수집 항목·이용 목적·보유 기간 보기</summary>
        <div>
          <b>수집 항목</b>: 이름, 연락처, 소속, 직급(적은 경우), 문의 과정, 문의 지역, 문의 내용(적은 경우). 신청 일시와 신청한 페이지 주소도 함께 저장됩니다.<br>
          <b>이용 목적</b>: 상담 연락과 과정 일정·수강료·접수 절차 안내<br>
          <b>보관</b>: 접수 내용은 운영자가 관리하는 구글 시트에 저장되고 담당자에게 메일로 전달됩니다. 서비스 서버가 국외에 있을 수 있습니다.<br>
          <b>보유 기간</b>: 상담 목적을 이루면 지체 없이 파기합니다. 법령에 보관 의무가 있으면 그 기간 동안만 보관합니다.<br>
          동의하지 않으실 수 있습니다. 동의하지 않으시면 온라인 상담 신청은 할 수 없고, 전화 상담은 그대로 이용하실 수 있습니다.
        </div>
      </details>
      <button type="submit" class="btn btn-ink form-submit">상담 신청하기${IC.arrow}</button>
      <p class="form-fine">남겨 주신 정보는 상담 목적으로만 사용합니다.</p>
      <div class="form-done" id="consultDone" hidden tabindex="-1">
        <strong>상담 신청이 접수되었습니다.</strong>
        <p>확인 후 순서대로 연락드리겠습니다. 감사합니다.</p>
      </div>
      <p class="form-fail" id="consultFail" hidden role="alert" data-msg="접수가 전달되지 않았습니다. 잠시 뒤 다시 시도하시거나 전화로 문의해 주시면 바로 도와드리겠습니다." data-tel="${PHONE.tel}" data-tel-label="전화 상담"></p>
    </form>
  </div>
</dialog>`;
}

// 모바일에서만 접는 목록(details.fold). 넓은 화면에서는 파싱 도중 바로 열어 예전 모습 그대로 둔다
const FOLD_OPEN = `<script>if(matchMedia("(min-width:900px)").matches)document.querySelectorAll("details.fold:not([open])").forEach(function(d){d.open=true})</script>`;

function footerHtml() {
  const regions = Object.entries(REGIONS).map(([slug, r]) => `<a href="${regionFile(slug)}">${esc(r.name)}</a>`).join("");
  const courses = COURSE_ORDER.map((k) => `<a href="${courseFile(k)}">${esc(COURSES[k].name)}</a>`).join("");
  const pages = [...NAV, ...NAV_MORE].map(([t, h]) => `<a href="${h}">${t}</a>`).join("");
  return `<footer class="ft">
  <div class="wrap">
    <div class="ft-top">
      <div class="ft-brand">
        <img src="assets/dc-logo-white.png" alt="Dale Carnegie" width="900" height="229" loading="lazy">
        <p>데일카네기 트레이닝 공개과정·기업교육 안내</p>
        <a class="btn btn-white" href="#consult">상담 신청${IC.arrow}</a>
      </div>
      <div class="ft-cols">
        <details class="ft-col fold"><summary>과정</summary><div>${courses}</div></details>
        <details class="ft-col fold"><summary>안내</summary><div>${pages}<a href="corporate.html#faq">기업교육 진행 방식</a></div></details>
      </div>
    </div>
    <details class="ft-regions fold">
      <summary>지역별 개강 일정</summary>
      <div>${regions}</div>
    </details>
    ${FOLD_OPEN}
    <p class="ft-fine">과정 일정과 수강료는 사정에 따라 바뀔 수 있습니다. 정확한 내용은 상담 신청으로 확인해 주세요.<span>정보 업데이트 ${TODAY.replace(/-/g, ".")}</span></p>
  </div>
</footer>
<div class="float" id="float">
  <a class="float-tel" href="tel:${PHONE.tel}" aria-label="전화 상담 ${PHONE.display}">${IC.phone}<span>전화 상담</span></a>
  <a class="float-cta" href="#consult">상담 신청</a>
</div>`;
}

// ------------------------------------------------------------
// 공통 틀
// ------------------------------------------------------------
function layout({ file, title, desc, body, hero, ld = [], trail = null }) {
  const url = SITE.BASE_URL ? abs(file) : "";
  // 404는 /a/b/c 같은 하위 주소에서도 뜨기 때문에 상대 경로로는 CSS·JS·링크가 전부 깨진다.
  // 도메인이 정해져 있으면 루트 기준 경로를 쓴다
  const ROOT = file === "404.html" && SITE.BASE_URL ? "/" : "";
  const ldAll = [...ld];
  const bl = trail && crumbsLd(trail);
  if (bl) ldAll.push(bl);
  const protect = SITE.PROTECT ? `<script>
(function(){
  function isFormEl(t){ return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'); }
  // 키보드로 연 컨텍스트 메뉴(Shift+F10 / 메뉴 키)는 막지 않는다 — 마우스를 못 쓰는 사용자의 유일한 복사 경로다
  document.addEventListener('contextmenu', function(e){ if(!isFormEl(e.target) && e.button !== -1 && !(e.clientX === 0 && e.clientY === 0)) e.preventDefault(); }, true);
  document.addEventListener('keydown', function(e){
    if(e.key === 'F12' || e.keyCode === 123 ||
       ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I','i','J','j','C','c'].indexOf(e.key) > -1) ||
       ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U'))){ e.preventDefault(); }
  }, true);
  document.addEventListener('dragstart', function(e){ if(!isFormEl(e.target)) e.preventDefault(); });
  // 캐럿 브라우징(F7)으로 읽는 사용자는 선택을 막지 않는다
  document.addEventListener('selectstart', function(e){ if(!isFormEl(e.target) && !document.body.hasAttribute('data-caret')) e.preventDefault(); });
  try { if(sessionStorage.getItem('caret')) document.body.setAttribute('data-caret',''); } catch(err) {}
  document.addEventListener('keydown', function(e){ if(e.key === 'F7'){ document.body.setAttribute('data-caret',''); try { sessionStorage.setItem('caret','1'); } catch(err) {} } });
})();
</script>` : "";
  const tracker = SITE.TRACKER ? `<script defer src="${SITE.TRACKER.src}" data-site="${SITE.TRACKER.site}"></script>` : "";
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(withSuffix(title))}</title>
<meta name="description" content="${esc(desc)}">
${url ? `${file === "404.html" && SITE.BASE_URL ? `<base href="${SITE.BASE_URL}/">
` : ""}<link rel="canonical" href="${url}">` : `<meta name="robots" content="noindex">`}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(withSuffix(title))}">
<meta property="og:description" content="${esc(desc)}">
${url ? `<meta property="og:url" content="${url}">` : ""}
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="${esc(SITE.NAME)}">
${SITE.BASE_URL ? `<meta property="og:image" content="${SITE.BASE_URL}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">` : `<meta property="og:image" content="assets/og.png">`}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0b0c10">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230b0c10'/%3E%3Cpath d='M14 50V14a36 36 0 0 1 36 36z' fill='%23ff5a2b'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap">
<link rel="stylesheet" href="${ROOT}style.css?v=${VER}">
<script>document.documentElement.className += ' js';</script>
${ldAll.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
${headerHtml(file)}
<main id="main">
${hero}
${body}
</main>
${footerHtml()}
<script type="application/json" id="schedData">${SCHED_JSON}</script>
<script>window.__FORM_ENDPOINT__ = ${JSON.stringify(FORM_ENDPOINT)};</script>
<script src="${ROOT}app.js?v=${VER}" defer></script>
${tracker}
${protect}
</body>
</html>`;
}
const HOME = ["홈", "index.html"];
// 짧은 제목에만 사이트명을 덧붙인다. 긴 제목에 붙이면 뒷부분이 잘려 접미사만 보인다
const withSuffix = (t) => (t.length + SITE.SUFFIX.length <= SUFFIX_MAX ? t + SITE.SUFFIX : t);
const webPageLd = (name, desc, file) => ({ "@context": "https://schema.org", "@type": "WebPage", name, description: desc, ...(SITE.BASE_URL ? { url: abs(file) } : {}), inLanguage: "ko-KR", dateModified: TODAY });

// ------------------------------------------------------------
// 홈
// ------------------------------------------------------------
function homeHero() {
  const fill = (s) => s
    .replace("{YEAR}", YEAR_LABEL)
    .replace("{REGIONS}", `<span data-live="regions">${LIVE.regions}</span>`)
    .replace("{COUNT}", `<span data-live="count">${LIVE.count}</span>`)
    .replace("{NEXT}", LIVE.next ? `가장 빠른 개강은 <span data-live="next">${nextLabel(LIVE.next)}</span>입니다.` : "");
  const slides = C.HERO.map((s, i) => {
    return `<div class="slide${i === 0 ? " is-on" : ""}" data-i="${i}"${i === 0 ? "" : ' aria-hidden="true"'}>
        <span class="hero-badge">${fill(esc(s.badge))}</span>
        <p class="hero-eyebrow">${fill(esc(s.eyebrow))}</p>
        <p class="hero-title"><span class="ln">${esc(s.title[0])}</span> <span class="ln hl">${esc(s.title[1])}</span></p>
        <p class="hero-sub">${fill(esc(s.sub))}</p>
        <div class="hero-actions">
          <a class="btn btn-white" href="${s.cta.href}">${s.cta.label}${IC.arrow}</a>
          <a class="btn btn-line" href="${s.cta2.href}">${s.cta2.label}</a>
        </div>
      </div>`;
  }).join("\n      ");
  const n = C.HERO.length;
  return `<section class="hero" id="top" data-slide="0">
  <div class="hero-bg" aria-hidden="true"><i class="glow g1"></i><i class="glow g2"></i><i class="grain"></i></div>
  <div class="wrap hero-in">
    <h1 class="sr">데일카네기 리더십 트레이닝 — 공개과정과 기업 맞춤 교육 안내</h1>
    <div class="hero-copy">
      ${slides}
    </div>
    <div class="mosaic" aria-hidden="true">
      <div class="tile t1 ph"><img src="assets/class-006.jpg" alt="" width="1200" height="757"></div>
      <div class="tile t2"></div>
      <div class="tile t3"><span>Since<br><b>1912</b></span></div>
      <div class="tile t4"><span>Human<br>Relations</span></div>
      <div class="tile t5 ph"><img src="assets/dale-book.jpg" alt="" width="1200" height="900"></div>
      <div class="tile t6 ph"><img src="assets/class-001.jpg" alt="" width="1200" height="900"></div>
      <div class="tile t7"><span>Learning<br>by Doing</span></div>
      <div class="tile t8"></div>
    </div>
  </div>
  <div class="wrap hero-ctrl">
    <div class="hero-count"><b id="heroNow">01</b><i>/</i><span>0${n}</span></div>
    <div class="hero-bar"><i id="heroBar"></i></div>
    <div class="hero-btns">
      <button type="button" id="heroPrev" aria-label="이전 슬라이드">${IC.prev}</button>
      <button type="button" id="heroPause" aria-label="자동 넘김 멈춤" aria-pressed="false">${IC.pause}${IC.play}</button>
      <button type="button" id="heroNext" aria-label="다음 슬라이드">${IC.next}</button>
    </div>
  </div>
  <a class="hero-scroll" href="#intro"><span>Scroll</span><i></i></a>
</section>`;
}

function introHtml() {
  // 흐르는 띠의 문장 하나하나가 고민별 안내 페이지로 이어진다
  const row = (arr, rev) => {
    const items = arr.map((c) => `<li><a href="${concernFile(c)}">${esc(c.quote)}</a></li>`).join("");
    // 복제 트랙은 끊김 없이 흐르게 하려고 둔 것 — 보조기술에서 숨기고 키보드 포커스도 받지 않게 한다
    return `<div class="mq${rev ? " mq-rev" : ""}"><ul class="mq-track">${items}</ul><ul class="mq-track" aria-hidden="true" inert>${items}</ul></div>`;
  };
  return `<section class="intro" id="intro">
  <div class="wrap intro-in reveal">
    <p class="eyebrow">${C.INTRO.eyebrow}</p>
    <h2 class="h-xl">${lines(C.INTRO.title)}</h2>
    <p class="lead">${esc(C.INTRO.sub)}</p>
  </div>
  <nav class="mq-wrap reveal" aria-label="상담에서 자주 듣는 말">
    ${row(CONCERNS.filter((c) => c.row === 0), false)}
    ${row(CONCERNS.filter((c) => c.row === 1), true)}
  </nav>
  <p class="intro-more reveal"><a class="btn btn-soft" href="concerns.html">고민별 안내 전체 보기${IC.arrow}</a></p>
</section>`;
}

// 교육 대상 블록의 과정 칩 → 과정 페이지 링크
const CHIP_LINK = [["최고경영자", "ceo"], ["차세대", "ceo"], ["TLA", "tla"], ["DYLP", "dylp"], ["LAC", "lac"], ["LTM", "ltm"], ["DCC", "dcc"], ["HIP", "hip"], ["DCS", "dcs"], ["청소년", "youth"]];
const chipHtml = (t) => { const hit = CHIP_LINK.find(([k]) => t.includes(k)); return hit ? `<li><a href="${courseFile(hit[1])}">${esc(t)}</a></li>` : `<li>${esc(t)}</li>`; };

function solutionsHtml() {
  const blocks = C.SOLUTIONS.map((s, i) => {
    const liveChip = s.cta.filter
      ? `<div class="sol-live" data-live-group="${s.cta.filter}"${LIVE.byGroup[s.cta.filter] ? "" : " hidden"}><i></i><span><b data-live-n>${LIVE.byGroup[s.cta.filter] || 0}</b>개 기수 모집 중</span></div>`
      : `<div class="sol-live"><i></i><span>150여 개 모듈 조합</span></div>`;
    const cta = s.cta.filter
      ? `<a class="btn btn-soft" href="#schedule" data-filter="${s.cta.filter}">${s.cta.label}${IC.arrow}</a>`
      : `<a class="btn btn-soft" href="corporate.html">${s.cta.label}${IC.arrow}</a>`;
    return `<article class="sol${i % 2 ? " sol-flip" : ""}" id="sol-${s.no}">
    <div class="wrap sol-in">
      <div class="sol-media reveal">
        <figure class="sol-fig">
          <img src="assets/${s.img}" alt="${esc(s.alt)}" loading="lazy" decoding="async">
          <figcaption>${esc(s.en)}</figcaption>
        </figure>
        ${liveChip}
      </div>
      <div class="sol-body reveal">
        <div class="sol-no"><strong>${s.no}</strong><span class="tag">${s.badge}</span></div>
        <h3 class="h-lg">${lines(s.title)}</h3>
        <p class="sol-desc">${esc(s.desc)}</p>
        <details class="sol-steps fold"><summary>진행 방식</summary>
        <ol class="steps" data-steps>
          ${s.steps.map(([t, d], k) => `<li><span class="step-n">${k + 1}</span><div><h4>${esc(t)}</h4><p>${esc(d)}</p></div></li>`).join("\n          ")}
        </ol>
        </details>${FOLD_OPEN}
        <ul class="chips">${s.chips.map(chipHtml).join("")}</ul>
        ${cta}
      </div>
    </div>
  </article>`;
  }).join("\n  ");
  return `<section class="sols" id="solutions" aria-label="교육 대상별 안내">
  ${blocks}
</section>`;
}

function statsHtml() {
  const S = C.STATS;
  return `<section class="stats" id="stats">
  <div class="stats-bg" aria-hidden="true"><i class="glow g1"></i><i class="glow g2"></i></div>
  <div class="wrap">
    <div class="stats-head reveal">
      <p class="eyebrow on-dark">${S.eyebrow}</p>
      <h2 class="h-xl on-dark">${lines(S.title)}</h2>
    </div>
    <dl class="stats-grid">
      ${S.items.map((it, i) => `<div class="stat reveal" style="--d:${i * 90}ms"><dt>${it.label}</dt><dd>${it.prefix ? `<small>${it.prefix}</small>` : ""}<b data-count="${it.n}">${it.n.toLocaleString("ko-KR")}</b><em>${it.suffix}</em></dd></div>`).join("\n      ")}
    </dl>
    <ul class="trust">
      ${S.trust.map(([t, d], i) => `<li class="reveal" style="--d:${i * 70}ms"><strong>${t}</strong><span>${d}</span></li>`).join("\n      ")}
    </ul>
    <p class="stats-more reveal"><a class="btn btn-line" href="about.html">데일 카네기 이야기${IC.arrow}</a></p>
  </div>
</section>`;
}

function homeScheduleHtml() {
  return `<section class="sch" id="schedule">
  <div class="wrap">
    ${secHead({ eyebrow: C.SCHEDULE_COPY.eyebrow, title: `${YEAR_LABEL} 개강 일정`, sub: C.SCHEDULE_COPY.sub })}
    ${schedListHtml(SCHEDULE, { tools: true })}
    <div class="regs-strip reveal">
      <h3>찾으시는 말로 보기</h3>
      <div class="chips-lg">${TOPICS.map((t) => `<a href="${topicFile(t)}">${esc(t.kw)}</a>`).join("")}</div>
    </div>
    <div class="regs-strip reveal">
      <h3>지역별로 보기</h3>
      <div class="chips-lg">${Object.entries(REGIONS).map(([slug, r]) => `<a href="${regionFile(slug)}" data-live-chip="${slug}">${esc(r.name)}<small${LIVE.byRegion[slug] ? "" : " hidden"}>${LIVE.byRegion[slug] || ""}</small></a>`).join("")}</div>
    </div>
  </div>
</section>`;
}

function voicesHtml() {
  const V = C.VOICES;
  const endorse = ENDORSEMENTS.map((e) => `<li class="vc"><blockquote><p>${esc(e.text)}</p><footer><strong>${esc(e.name)}</strong><span>${esc(e.title)}</span></footer></blockquote></li>`).join("\n        ");
  const reviews = REVIEWS.map((rv, i) => `<li><button type="button" class="rv" data-review="${i}">
          <span class="rv-no">${String(i + 1).padStart(2, "0")}</span>
          <strong>${esc(rv.title)}</strong>
          <span class="rv-ex">${esc(rv.excerpt)}</span>
          <span class="rv-by">${esc(rv.author)}<i>전문 보기${IC.arrow}</i></span>
        </button></li>`).join("\n        ");
  const data = JSON.stringify(REVIEWS.map((r) => ({ t: r.title, a: r.author, p: r.paras }))).replace(/</g, "\\u003c");
  return `<section class="voices" id="voices">
  <div class="wrap">
    <div class="voices-head reveal">
      <div>
        <p class="eyebrow on-dark">${V.eyebrow}</p>
        <h2 class="h-xl on-dark">${lines(V.title)}</h2>
      </div>
      <p class="lead on-dark">${esc(V.sub)}</p>
    </div>
  </div>
  <div class="vc-wrap reveal">
    <ul class="vc-track" id="vcTrack" tabindex="0" aria-label="추천의 글" data-hs data-hs-host=".vc-nav">
        ${endorse}
    </ul>
    <div class="wrap vc-nav">
      <button type="button" data-scroll="#vcTrack" data-dir="-1" aria-label="이전 추천의 글">${IC.prev}</button>
      <button type="button" data-scroll="#vcTrack" data-dir="1" aria-label="다음 추천의 글">${IC.next}</button>
    </div>
  </div>
  <div class="wrap">
    <h3 class="rv-title reveal">수료생이 남긴 후기</h3>
    <ul class="rv-grid reveal" data-hs>
        ${reviews}
    </ul>
    <p class="voices-more reveal"><a class="btn btn-line" href="reviews.html">후기 전체 보기${IC.arrow}</a></p>
  </div>
  <dialog class="rv-dialog" id="rvDialog" aria-labelledby="rvT">
    <button type="button" class="dlg-x" data-close aria-label="닫기">${IC.close}</button>
    <p class="eyebrow">수강 후기</p>
    <h3 id="rvT"></h3>
    <p class="rv-dialog-by" id="rvA"></p>
    <div id="rvP"></div>
  </dialog>
  <script type="application/json" id="rvData">${data}</script>
</section>`;
}

function storyHtml() {
  const S = C.STORY;
  return `<section class="story" id="story">
  <div class="wrap story-in">
    <figure class="story-fig reveal">
      <img src="assets/dale-book.jpg" alt="자신의 책 『인간관계론』을 읽고 있는 데일 카네기" loading="lazy" decoding="async" width="1200" height="900">
      <span class="story-year">1936</span>
    </figure>
    <div class="story-body reveal">
      <p class="eyebrow">${S.eyebrow}</p>
      <h2 class="h-xl">${lines(S.title)}</h2>
      ${S.paras.map((p) => `<p>${esc(p)}</p>`).join("\n      ")}
      <ol class="tl">
        ${S.timeline.map(([y, t]) => `<li><b>${y}</b><span>${esc(t)}</span></li>`).join("\n        ")}
      </ol>
      <p class="story-more"><a class="btn btn-ink" href="about.html">데일 카네기 소개 더 보기${IC.arrow}</a></p>
    </div>
  </div>
</section>`;
}

function homeFaqHtml() {
  const tabs = C.FAQ.map((g, i) => `<button type="button" role="tab" id="faqTab${i}" aria-controls="faqPanel${i}" aria-selected="${i === 0}" class="pill${i === 0 ? " is-on" : ""}"${i === 0 ? "" : ' tabindex="-1"'}>${g.tab}</button>`).join("");
  let n = 0;
  // 홈에는 묶음마다 앞 2개만 — 같은 Q&A 15쌍을 faq.html과 통째로 중복 출력하지 않는다
  const panels = C.FAQ.map((g, i) => `<div role="tabpanel" id="faqPanel${i}" aria-labelledby="faqTab${i}" class="faq-panel"${i === 0 ? "" : " hidden"}>
        ${g.items.slice(0, 2).map(([q, a], k) => { n += 1; return faqItem(q, a, n, i === 0 && k === 0); }).join("\n        ")}
        ${g.items.length > 2 ? `<p class="faq-rest"><a href="faq.html#faq-${i}">${esc(g.tab)} 질문 ${g.items.length}개 전체 보기 →</a></p>` : ""}
      </div>`).join("\n      ");
  return `<section class="faq" id="faq">
  <div class="wrap faq-in">
    <div class="faq-head reveal">
      <p class="eyebrow">${PAGES.faq.eyebrow}</p>
      <h2 class="h-xl">${lines(PAGES.faq.title)}</h2>
      <p class="lead">${esc(PAGES.faq.sub)}</p>
      <a class="btn btn-ink" href="#consult">상담 신청${IC.arrow}</a>
      <p class="faq-more"><a href="faq.html">질문 전체 보기 →</a></p>
    </div>
    <div class="faq-body reveal">
      <div class="pills" role="tablist" aria-label="질문 분류">${tabs}</div>
      ${panels}
    </div>
  </div>
</section>`;
}

function buildIndex() {
  const body = [introHtml(), solutionsHtml(), statsHtml(), homeScheduleHtml(), voicesHtml(), storyHtml(), homeFaqHtml(), consultHtml()].join("\n");
  return layout({
    file: "index.html", title: SITE.TITLE, desc: SITE.DESC, hero: homeHero(), body,
    ld: [{ "@context": "https://schema.org", "@type": "WebSite", name: SITE.NAME, ...(SITE.BASE_URL ? { url: abs("index.html") } : {}), inLanguage: "ko-KR", dateModified: TODAY }],
  });
}

// ------------------------------------------------------------
// 과정 안내 · 과정별 상세
// ------------------------------------------------------------
function buildCourses() {
  const P = PAGES.courses;
  const groups = COURSE_GROUPS.map((g, i) => `<section class="sec${i % 2 ? " sec-alt" : ""}" id="${g.key}">
  <div class="wrap">
    ${secHead({ eyebrow: g.en, title: g.title, sub: g.desc })}
    ${g.courses.length === 1 ? courseFeature(g.courses[0]) : `<div class="grid-3">
      ${g.courses.map((k) => courseCard(k)).join("\n      ")}
    </div>`}
  </div>
</section>`).join("\n");
  const body = `${groups}
<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "For Organizations", title: "기업 · 기관", sub: "사내 교육이 필요하다면 과정을 고르기 전에 상황부터 이야기해 주세요. 사전 진단에서 시작해 회사마다 다르게 설계합니다." })}
    <div class="grid-3">
      ${corpCard()}
    </div>
  </div>
</section>
${consultHtml()}`;
  const trail = [HOME, ["과정 안내", null]];
  return layout({
    file: "courses.html", title: "과정 안내 | 경영자·리더·직장인을 위한 데일카네기 과정",
    desc: "데일카네기 최고경영자 코스, 데일카네기 코스(DCC), 신임리더·팀장·임원 리더십 과정, 프레젠테이션·세일즈·청소년 과정을 교육 대상별로 안내합니다.",
    hero: heroSm({ trail, eyebrow: P.eyebrow, title: P.title, sub: P.sub, actions: [["상담 신청", "#consult", true], ["개강 일정 보기", "schedule.html"]] }),
    body, trail, ld: [webPageLd("과정 안내", "데일카네기 공개과정 안내", "courses.html")],
  });
}

function buildCourse(key) {
  const c = COURSES[key];
  const d = COURSE_DETAIL[key];
  const group = COURSE_GROUPS.find((g) => g.key === d.group);
  const rows = SCHEDULE.filter((r) => r.course === key);
  const active = rows.filter(isActive);
  const next = nextOf(active);
  const related = CONCERNS.filter((x) => x.courses.includes(key));
  const siblings = group.courses.filter((k) => k !== key);
  const trail = [HOME, ["과정 안내", "courses.html"], [c.name, null]];
  const meta = `<dl class="hero-meta">
      <div><dt>기간</dt><dd>${esc(c.duration)}</dd></div>
      <div><dt>대상</dt><dd>${esc(c.target)}</dd></div>
      <div><dt>모집</dt><dd data-live-course="${key}" data-live-none="개강 일정은 문의 시 안내"><span class="live-txt">${active.length ? `${active.length}개 기수 접수 중${next ? ` · 가장 빠른 개강 ${esc(next.open)}` : ""}` : "개강 일정은 문의 시 안내"}</span></dd></div>
    </dl>`;
  const body = `<section class="sec">
  <div class="wrap split">
    <div class="prose reveal">
      <p class="eyebrow">About</p>
      <h2 class="h-lg">${tl(d.aboutTitle)}</h2>
      ${d.intro.map((p) => `<p>${esc(p)}</p>`).join("\n      ")}
    </div>
    <figure class="split-fig reveal">
      <img src="assets/${d.img}" alt="${esc(c.name)} 교육 현장" loading="lazy" decoding="async">
      <figcaption>${esc(c.eng)}</figcaption>
    </figure>
  </div>
</section>

<section class="sec sec-alt">
  <div class="wrap">
    ${secHead({ eyebrow: "Who", title: ["이런 상황이라면", "맞는 과정입니다."] })}
    <ul class="ticks-2 reveal">${d.situations.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "Outcomes", title: ["과정을 마치면", "달라지는 것"] })}
    <ul class="o-grid reveal">
      ${d.outcomes.map(([t, p]) => `<li><strong>${esc(t)}</strong><p>${esc(p)}</p></li>`).join("\n      ")}
    </ul>
  </div>
</section>

<section class="sec sec-alt">
  <div class="wrap">
    ${secHead({ eyebrow: "Curriculum", title: "교육 내용", sub: c.duration })}
    <ol class="cur reveal">
      ${d.curriculum.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join("\n      ")}
    </ol>
    ${d.curriculumNote ? `<p class="note">${esc(d.curriculumNote)}</p>` : ""}
  </div>
</section>
${d.perks ? `
<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "Benefits", title: ["수료 후에", "이어지는 것"] })}
    <ul class="o-grid o-grid-4 reveal">
      ${d.perks.map(([t, p], i) => `<li><span class="n">0${i + 1}</span><strong>${esc(t)}</strong><p>${esc(p)}</p></li>`).join("\n      ")}
    </ul>
  </div>
</section>` : ""}
${d.admission ? `
<section class="sec sec-alt">
  <div class="wrap narrow">
    ${secHead({ eyebrow: "Admission", title: "모집 요강", sub: "서울 본원 기준 공통 안내입니다. 지역별 세부 조건은 각 지역 페이지와 상담에서 안내드립니다." })}
    <dl class="dl reveal">
      ${d.admission.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("\n      ")}
    </dl>
  </div>
</section>` : ""}

<section class="sec" id="schedule">
  <div class="wrap">
    ${secHead({ eyebrow: "Schedule", title: `${c.name} 개강 일정`, sub: active.length ? `${YEAR_LABEL} 일정입니다. 접수는 개강 일주일 전까지 받고, 정원이 차면 먼저 마감합니다.` : "지금 모집 중인 기수가 없습니다. 상담 신청에 지역을 적어 주시면 다음 기수 일정이 정해지는 대로 먼저 안내해 드립니다." })}
    ${rows.length ? schedListHtml(rows) : ""}
    <p class="sec-link reveal"><a href="schedule.html?group=${d.group}">전체 개강 일정 보기 →</a></p>
  </div>
</section>
${related.length ? `
<section class="sec sec-alt">
  <div class="wrap">
    ${secHead({ eyebrow: "Concerns", title: ["이 과정을 찾는", "이유"], sub: "상담에서 자주 듣는 말 가운데 이 과정과 이어지는 것들입니다." })}
    <div class="grid-3">
      ${related.map(concernCard).join("\n      ")}
    </div>
  </div>
</section>` : ""}
${siblings.length ? `
<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: group.en, title: `${group.title}${eul(group.title)} 위한 다른 과정` })}
    <div class="grid-3">
      ${siblings.map((k) => courseCard(k)).join("\n      ")}
    </div>
  </div>
</section>` : ""}
${consultHtml({ course: c.name })}`;
  return layout({
    file: courseFile(key),
    title: `${c.name}(${c.code}) | ${c.duration}`,
    desc: `${d.lead} 대상은 ${c.target}, 기간은 ${c.duration}입니다.${active.length ? ` ${YEAR_LABEL} ${active.length}개 기수를 모집합니다.` : ""}`,
    hero: heroSm({ trail, badge: c.code, eyebrow: c.eng, title: c.name, sub: d.lead, extra: meta, actions: [["상담 신청", "#consult", true], ["개강 일정 보기", "#schedule"]] }),
    body, trail,
    ld: [{
      "@context": "https://schema.org", "@type": "Course", name: c.name, description: d.lead,
      provider: { "@type": "Organization", name: "데일카네기코리아" },
      ...(SITE.BASE_URL ? { url: abs(courseFile(key)) } : {}),
      // 이미 가진 일정·수강료를 넣어 검색 결과에 기수가 그대로 노출되게 한다
      ...(active.length ? {
        // 개강일을 못 읽는 행(일정 미정)은 startDate 가 빈 값이 되어 구조화 데이터가 무효가 된다
        hasCourseInstance: active.filter((r) => schedDate(r.open) != null).map((r) => ({
          "@type": "CourseInstance",
          name: `${r.name}${r.gi ? ` ${r.gi}기` : ""}`,
          courseMode: "onsite",
          location: { "@type": "Place", name: REGIONS[r.region].name, address: { "@type": "PostalAddress", addressLocality: REGIONS[r.region].name, addressCountry: "KR" } },
          startDate: isoDay(schedDate(r.open)),
          ...(isDayCourse(r) && closeDate(r) ? { endDate: isoDay(closeDate(r)) } : {}), // 수료일은 본사 확인분이 아니어서 내보내지 않는다 (data.js 주석 참고)
          courseSchedule: { "@type": "Schedule", repeatFrequency: isDayCourse(r) ? "P1D" : "P1W", ...(byDayLd(r.day).length ? { byDay: byDayLd(r.day) } : {}) },
          ...(r.fee ? { offers: { "@type": "Offer", price: r.fee, priceCurrency: "KRW", category: "수강료", availability: "https://schema.org/InStock", validFrom: TODAY } } : {}),
        })),
      } : {}),
      dateModified: TODAY,
    }],
  });
}

// ------------------------------------------------------------
// 개강 일정
// ------------------------------------------------------------
function buildSchedule() {
  const P = PAGES.schedule;
  const adm = COURSE_DETAIL.ceo.admission;
  const trail = [HOME, ["개강 일정", null]];
  const body = `<section class="sec sec-alt sec-tight" id="schedule">
  <div class="wrap">
    <h2 class="sr">전체 개강 일정</h2>
    ${schedListHtml(SCHEDULE, { tools: true })}
  </div>
</section>

<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "Regions", title: ["지역별로", "보기"], sub: "지역을 누르면 그 지역의 개강 일정과 담당 지사, 동문 활동을 볼 수 있습니다." })}
    <div class="grid-4">
      ${Object.keys(REGIONS).map(regionCard).join("\n      ")}
    </div>
  </div>
</section>

<section class="sec sec-alt">
  <div class="wrap narrow">
    ${secHead({ eyebrow: "How to apply", title: "등록 절차와 환불", sub: "최고경영자 코스 서울 본원 기준입니다. 과정과 지역에 따라 조금씩 다를 수 있어 등록 전에 다시 안내해 드립니다." })}
    <dl class="dl reveal">
      ${adm.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("\n      ")}
    </dl>
  </div>
</section>
${consultHtml()}`;
  return layout({
    file: "schedule.html", title: `${YEAR_LABEL} 개강 일정 | 전국 지역별 데일카네기 과정 모집`,
    desc: `데일카네기 최고경영자 코스·DCC·리더십·프레젠테이션 과정의 ${YEAR_LABEL} 전국 개강 일정. 지역과 교육 대상으로 골라 볼 수 있습니다.`,
    hero: heroSm({ trail, eyebrow: P.eyebrow, title: [`${YEAR_LABEL}`, "개강 일정"], sub: P.sub, extra: `<dl class="hero-meta"><div><dt>모집 중</dt><dd><span data-live="count">${LIVE.count}</span>개 기수</dd></div><div><dt>지역</dt><dd><span data-live="regions">${LIVE.regions}</span>개 지역</dd></div><div><dt>가장 빠른 개강</dt><dd><span data-live="next">${LIVE.next ? esc(nextLabel(LIVE.next)) : "문의"}</span></dd></div></dl>` }),
    body, trail, ld: [webPageLd(`${YEAR_LABEL} 개강 일정`, "데일카네기 전국 개강 일정", "schedule.html")],
  });
}

// ------------------------------------------------------------
// 지역별 안내 · 지역 페이지
// ------------------------------------------------------------
function buildRegions() {
  const P = PAGES.regions;
  const trail = [HOME, ["지역별 안내", null]];
  const groups = BRANCH_ORDER.map((b) => {
    const slugs = Object.keys(REGIONS).filter((s) => REGIONS[s].branch === b);
    if (!slugs.length) return "";
    return `<div class="reg-group reveal">
      <h3><span>${esc(BRANCH[b].label)}</span><small>${slugs.length}개 지역 관할</small></h3>
      <div class="grid-4">
        ${slugs.map(regionCard).join("\n        ")}
      </div>
    </div>`;
  }).join("\n    ");
  const body = `<section class="sec sec-alt sec-tight">
  <div class="wrap">
    <h2 class="sr">지사별 지역 목록</h2>
    ${groups}
  </div>
</section>
${consultHtml()}`;
  return layout({
    file: "regions.html", title: "지역별 안내 | 서울·경기·부산·대구·대전·광주·울산 데일카네기 과정",
    desc: "데일카네기 공개과정이 열리는 전국 24개 지역. 지역별 개강 일정과 담당 지사, 수료 후 동문 활동을 안내합니다.",
    hero: heroSm({ trail, eyebrow: P.eyebrow, title: P.title, sub: P.sub, extra: `<dl class="hero-meta"><div><dt>지역</dt><dd>${Object.keys(REGIONS).length}개</dd></div><div><dt>모집 중</dt><dd><span data-live="regions">${LIVE.regions}</span>개 지역 · <span data-live="count">${LIVE.count}</span>개 기수</dd></div></dl>` }),
    body, trail, ld: [webPageLd("지역별 안내", "데일카네기 지역별 과정 안내", "regions.html")],
  });
}

function buildRegion(slug) {
  const r = REGIONS[slug];
  const br = BRANCH[r.branch];
  const rows = SCHEDULE.filter((x) => x.region === slug);
  const active = rows.filter(isActive);
  const next = nextOf(active);
  // 그 지역에서 실제로 열렸던 과정만 — 한 번도 연 적 없는 과정을 '많이 찾는 과정'으로 붙이지 않는다.
  // 기록이 아예 없는 지역은 전국 대표 과정인 CEO 하나만 두고 나머지는 상담으로 안내한다
  const courseKeys = COURSE_ORDER.filter((k) => rows.some((x) => x.course === k));
  // 동문회가 있다는 건 그 지역에서 수료생이 나왔다는 뜻이다 — 지금 일정표에 없다고 '열린 적 없다'고 쓰지 않는다
  const hasRows = courseKeys.length > 0;
  const hasHistory = hasRows || ALUMNI.some((a) => a.region === slug);
  // 동문회만 있고 일정표에 기록이 없는 지역은 카드가 0개로 비어 버린다 — 대표 과정을 세운다
  const courses = hasRows ? courseKeys : ["ceo"];
  const mine = ALUMNI.filter((a) => a.region === slug);
  const sameBranch = ALUMNI.filter((a) => a.branch === r.branch && a.region !== slug);
  const near = Object.keys(REGIONS).filter((s) => s !== slug && REGIONS[s].branch === r.branch);
  // 이 지역에 열린 기수가 없으면 같은 지사 관할에서 실제로 모집 중인 기수를 대신 보여 준다
  const nearRows = active.length ? [] : SCHEDULE.filter((x) => near.includes(x.region) && isActive(x)).sort(byOpen);
  const trail = [HOME, ["지역별 안내", "regions.html"], [r.name, null]];
  // 지역 순번에 따라 풀에서 3개씩 밀어 가며 고른다 — 이웃 지역끼리 같은 문항이 겹치지 않는다
  const rIdx = Object.keys(REGIONS).indexOf(slug);
  const pool = REGION.faqPool.map((q) => FAQ_FLAT.find(([qq]) => qq === q)).filter(Boolean);
  const picks = [0, 1, 2].map((i) => pool[(rIdx + i) % pool.length]); // 1칸씩 밀어 이웃 지역끼리 겹치지 않게
  const sub = active.length
    ? R(REGION.subOpen, r.name).replace("{N}", active.length).replace("{NEXT}", nextLabel(next) || "문의 시 안내")
    : R(nearRows.length ? REGION.subNone : REGION.subNoneAlone, r.name); // 가까운 지역 기수가 없으면 있다고 말하지 않는다
  const body = `<section class="sec sec-alt sec-tight" id="schedule">
  <div class="wrap">
    ${/* 개설 기록이 없으면 바로 아래 안내 문단이 같은 말을 하므로 sub를 비운다 */ ""}
    ${secHead({ eyebrow: "Schedule", title: R(REGION.scheduleTitle, r.name), sub: active.length ? C.SCHEDULE_COPY.sub : rows.length ? R(REGION.subPast, r.name) : "" })}
    ${rows.length ? schedListHtml(rows) : `<p class="sch-empty reveal">${esc(R(hasHistory ? REGION.waitingPast : REGION.waiting, r.name))} <a href="#consult">상담 신청하기</a></p>`}
    ${nearRows.length ? `<div class="near-sched reveal">
      <h3>${esc(br.label)} 관할에서 지금 모집 중인 기수</h3>
      <p>${esc(r.name)}에서 가까운 곳입니다. 등록하시면 그 지역 기수로 안내해 드립니다.</p>
      ${schedListHtml(nearRows)}
    </div>` : ""}
    <p class="sec-link reveal"><a href="schedule.html?region=${slug}">전체 개강 일정에서 보기 →</a></p>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <h2 class="sr">${esc(r.name)} 수업 장소와 담당 지사</h2>
  </div>
  <div class="wrap split">
    <div class="venue reveal">
      <h3>${REGION.venueTitle}</h3>
      <p>${esc(R(REGION.venueWhere, r.name))}</p>
      <small>${esc(REGION.venueNote)}</small>
    </div>
    <div class="venue reveal">
      <h3>담당 지사</h3>
      <p>${esc(br.label)}</p>
      <small>지사 연락은 상담 신청이나 전화 상담 버튼으로 받고 있습니다.</small>
    </div>
  </div>
</section>

<section class="sec sec-alt">
  <div class="wrap">
    ${secHead({
      eyebrow: "Courses",
      title: (hasRows ? REGION.coursesTitle : REGION.coursesTitleNone).map((t) => R(t, r.name)),
      sub: R(hasRows ? REGION.coursesSub : hasHistory ? REGION.coursesSubAlumni : REGION.coursesSubNone, r.name),
    })}
    <div class="grid-3">
      ${courses.map((k) => courseCard(k, slug)).join("\n      ")}
    </div>
  </div>
</section>
${mine.length || sameBranch.length ? `
<section class="sec">
  <div class="wrap">
    ${secHead({
      // 이 지역 동문회가 없으면 제목부터 '이 지역 활동'이라고 말하지 않는다
      eyebrow: "Alumni",
      title: (mine.length ? REGION.alumniTitle : REGION.alumniTitleBranch).map((t) => R(t, r.name).replace("{BR}", br.label)),
      sub: mine.length ? REGION.alumniSub : R(REGION.alumniSubBranch, r.name).replace("{BR}", br.label),
    })}
    ${mine.map((a) => `<div class="alumni reveal"><h3>${esc(a.name)} 동문회</h3><ul class="chips-lg">${a.acts.map((t) => `<li><span>${esc(t)}</span></li>`).join("")}</ul></div>`).join("\n    ")}
    ${sameBranch.length ? `<div class="alumni${mine.length ? " alumni-sub" : ""} reveal"><h3>${mine.length ? `같은 지사(${esc(br.label)})가 함께 운영하는 동문회` : "같은 지사가 운영하는 동문회"}</h3>${sameBranch.map((a) => `<p><b>${esc(a.name)}</b> ${a.acts.map(esc).join(" · ")}</p>`).join("")}</div>` : ""}
  </div>
</section>` : ""}

<section class="sec sec-alt">
  <div class="wrap faq-in">
    <div class="faq-head reveal">
      <p class="eyebrow">FAQ</p>
      <h2 class="h-xl"><span class="ln">${esc(r.name)} 과정,</span> <span class="ln">이런 점이 궁금하셨죠</span></h2>
      <p class="lead">더 많은 질문과 답은 자주 묻는 질문 페이지에 있습니다.</p>
      <a class="btn btn-ink" href="faq.html">질문 전체 보기${IC.arrow}</a>
    </div>
    <div class="faq-body reveal">
      <div class="faq-panel">
        ${picks.map(([q, a], i) => faqItem(q, a, i + 1, i === 0)).join("\n        ")}
      </div>
    </div>
  </div>
</section>
${near.length ? `
<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "Nearby", title: REGION.nearTitle, sub: `${br.label}${iga(br.label)} 함께 관할하는 지역입니다.` })}
    <div class="grid-4">
      ${near.map(regionCard).join("\n      ")}
    </div>
  </div>
</section>` : ""}
${consultHtml({ region: r.name })}`;
  return layout({
    file: regionFile(slug),
    title: `${r.name} 데일카네기 과정 | ${active.length ? `${YEAR_LABEL} ${active.length}개 기수 모집` : "개강 일정 안내"}`,
    // 지역마다 다르게 — 실제로 열린 과정, 실제 모집 현황, 그 지역 동문회 유무로 문장을 만든다
    desc: [
      active.length
        ? `${r.name} 데일카네기 ${courses.map((k) => COURSES[k].code).join("·")} ${YEAR_LABEL} ${active.length}개 기수 모집 중${next ? `, 가장 빠른 개강 ${next.open}` : ""}.`
        : hasRows
          ? `${r.name}에서 열렸던 데일카네기 ${courses.map((k) => COURSES[k].code).join("·")} 과정과 다음 기수 안내.`
          : `${r.name} 지역 데일카네기 과정 개설 문의와 가까운 지역 기수 안내.`,
      `담당 ${br.label}.`,
      mine.length ? `${r.name} 동문회 활동(${mine[0].acts.slice(0, 3).join("·")})까지 안내합니다.` : "수강료와 등록 절차를 안내합니다.",
    ].join(" "),
    hero: heroSm({ trail, eyebrow: `${REGION.eyebrow} · ${br.label}`, title: [`${r.name}에서 열리는`, "데일카네기 과정"], sub, actions: [["상담 신청", "#consult", true], ["개강 일정 보기", "#schedule"]] }),
    body, trail,
    ld: [
      webPageLd(`${r.name} 데일카네기 과정`, `${r.name} 지역 개강 일정과 담당 지사 안내`, regionFile(slug)),
      {
        "@context": "https://schema.org", "@type": "EducationalOrganization",
        name: br.label.startsWith("데일카네기") ? br.label : `데일카네기 ${br.label}`, parentOrganization: { "@type": "Organization", name: "데일카네기코리아" },
        // 같은 지사가 24개 지역 페이지에서 저마다 다른 url 을 가진 별개 조직으로 선언되면 안 된다.
        // @id 를 지사마다 하나로 고정하고 담당 지역 전체를 areaServed 에 넣는다
        ...(SITE.BASE_URL ? { "@id": `${abs("regions.html")}#branch-${r.branch}`, url: abs("regions.html") } : {}),
        areaServed: Object.keys(REGIONS).filter((s) => REGIONS[s].branch === r.branch)
          .map((s) => ({ "@type": "Place", name: REGIONS[s].name })),
      },
      ...(active.length ? [{
        "@context": "https://schema.org", "@type": "ItemList", name: `${r.name} 모집 중인 기수`,
        itemListElement: active.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: `${x.name}${x.gi ? ` ${x.gi}기` : ""}`, ...(SITE.BASE_URL ? { url: abs(courseFile(x.course)) } : {}) })),
      }] : []),
    ],
  });
}

// ------------------------------------------------------------
// 고민별 안내
// ------------------------------------------------------------
function buildConcerns() {
  const P = PAGES.concerns;
  const trail = [HOME, ["고민별 안내", null]];
  const body = `<section class="sec sec-alt sec-tight">
  <div class="wrap">
    <h2 class="sr">상담에서 자주 듣는 말 12가지</h2>
    <div class="grid-3">
      ${CONCERNS.map(concernCard).join("\n      ")}
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap split">
    <div class="prose reveal">
      <p class="eyebrow">For Organizations</p>
      <h2 class="h-lg">회사 안에서 반복되는 문제라면</h2>
      <p>${esc(CORPORATE.sub)}</p>
      <p><a class="btn btn-ink" href="corporate.html">기업 맞춤 교육 안내${IC.arrow}</a></p>
    </div>
    <div class="prose reveal">
      <p class="eyebrow">For Individuals</p>
      <h2 class="h-lg">나 자신의 문제라면</h2>
      <p>${esc(PAGES.courses.sub)}</p>
      <p><a class="btn btn-soft" href="courses.html">과정 안내 보기${IC.arrow}</a></p>
    </div>
  </div>
</section>
${consultHtml()}`;
  return layout({
    file: "concerns.html", title: "고민별 안내 | 팀장 역할·발표 불안·피드백·조직 개편·세일즈",
    desc: "상담에서 자주 듣는 12가지 고민. 왜 생기는지, 데일카네기 과정에서 실제로 무엇을 하는지, 교육으로 풀리지 않는 부분은 무엇인지 다룹니다.",
    hero: heroSm({ trail, eyebrow: P.eyebrow, title: P.title, sub: P.sub }),
    body, trail, ld: [webPageLd("고민별 안내", "상담에서 자주 듣는 고민과 교육에서 하는 일", "concerns.html")],
  });
}

function buildConcern(c) {
  const trail = [HOME, ["고민별 안내", "concerns.html"], [c.quote, null]];
  const others = CONCERNS.filter((x) => x.slug !== c.slug);
  const preset = c.courses[0] === "corporate" ? { course: "기업 맞춤 교육" } : { course: COURSES[c.courses[0]].name };
  const body = `<section class="sec">
  <div class="wrap narrow prose reveal">
    <p class="eyebrow">Why</p>
    <h2 class="h-lg">왜 이런 일이 생기나</h2>
    ${c.why.map((p) => `<p>${esc(p)}</p>`).join("\n    ")}
  </div>
</section>

<section class="sec sec-alt">
  <div class="wrap split">
    <div class="reveal">
      <p class="eyebrow">What we do</p>
      <h2 class="h-lg"><span class="ln">교육에서</span> <span class="ln">실제로 하는 것</span></h2>
      <p class="lead" style="margin-top:16px">듣고 끝나는 강의가 아니라 자기 상황을 가지고 해 보는 방식입니다.</p>
    </div>
    <ol class="steps reveal" data-steps>
      ${c.practice.map(([t, d], k) => `<li><span class="step-n">${k + 1}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join("\n      ")}
    </ol>
  </div>
</section>

<section class="sec sec-tight">
  <div class="wrap narrow">
    <div class="callout reveal"><strong>교육으로 풀리지 않는 부분</strong><p>${esc(c.limit)}</p></div>
  </div>
</section>

<section class="sec" id="related">
  <div class="wrap">
    ${secHead({ eyebrow: "Courses", title: ["이 고민과 이어지는", "과정"], sub: "어느 과정이 맞는지 애매하면 상담에서 함께 정하면 됩니다." })}
    <div class="grid-3">
      ${relatedCards(c.courses)}
    </div>
  </div>
</section>

<section class="sec sec-alt">
  <div class="wrap">
    ${secHead({ eyebrow: "More", title: "다른 고민도 있다면" })}
    <div class="chips-lg reveal">${others.map((x) => `<a href="${concernFile(x)}">${esc(x.quote)}</a>`).join("")}</div>
  </div>
</section>
${consultHtml(preset)}`;
  return layout({
    file: concernFile(c),
    title: `“${c.quote}” | 원인과 교육에서 하는 일`,
    // 본문을 자르면 문장 한가운데서 끊긴다 — 완성된 문장만 이어 붙여 155자 안으로 맞춘다
    desc: (() => {
      const parts = [c.one, `데일카네기 ${c.courses.map((k) => (k === "corporate" ? "기업 맞춤 교육" : COURSES[k].code)).join("·")} 과정과 이어집니다.`];
      const why = c.why[0].split(". ")[0].replace(/[.·]$/, "");
      if ((parts.join(" ") + " " + why).length <= 155) parts.splice(1, 0, why + ".");
      return parts.join(" ");
    })(),
    hero: heroSm({ trail, badge: c.word, eyebrow: "상담에서 자주 듣는 말", title: `“${c.quote}”`, sub: c.one, actions: [["상담 신청", "#consult", true], ["관련 과정 보기", "#related"]] }),
    body, trail, ld: [webPageLd(c.quote, c.one, concernFile(c))],
  });
}

// ------------------------------------------------------------
// 기업 맞춤 교육
// ------------------------------------------------------------
function buildCorporate() {
  const K = CORPORATE;
  const trail = [HOME, ["기업교육", null]];
  const related = CONCERNS.filter((x) => x.courses.includes("corporate"));
  const faq = C.FAQ.find((g) => g.tab === K.faqTab);
  const body = `<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "When", title: K.momentsTitle, sub: K.momentsSub })}
    <ul class="o-grid o-grid-4 reveal">
      ${K.moments.map(([t, p], i) => `<li><span class="n">0${i + 1}</span><strong>${esc(t)}</strong><p>${esc(p)}</p></li>`).join("\n      ")}
    </ul>
  </div>
</section>

<section class="sec sec-alt">
  <div class="wrap">
    ${secHead({ eyebrow: "How", title: K.processTitle, sub: K.processSub })}
    <div class="split">
      <ol class="steps reveal" data-steps>
        ${K.process.map(([t, d], k) => `<li><span class="step-n">${k + 1}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join("\n        ")}
      </ol>
      <div class="reveal">
        <h3 class="h-lg" style="font-size:22px">${esc(K.areasTitle)}</h3>
        <ul class="o-grid o-grid-2" style="margin-top:20px">
          ${K.areas.map(([t, d]) => `<li><strong>${esc(t)}</strong><p>${esc(d)}</p></li>`).join("\n          ")}
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "Concerns", title: ["교육 담당자들이", "상담에서 하는 말"], sub: "조직 안에서 반복되는 문제 가운데 기업교육으로 이어지는 것들입니다." })}
    <div class="grid-3">
      ${related.map(concernCard).join("\n      ")}
    </div>
  </div>
</section>

<section class="sec sec-alt" id="faq">
  <div class="wrap faq-in">
    <div class="faq-head reveal">
      <p class="eyebrow">FAQ</p>
      <h2 class="h-xl"><span class="ln">기업교육</span> <span class="ln">진행 방식</span></h2>
      <p class="lead">공개과정(최고경영자 코스, 데일카네기 코스 등)은 과정 안내에서, 지역별 일정은 개강 일정에서 보실 수 있습니다.</p>
      <a class="btn btn-ink" href="#consult">기업교육 상담 신청${IC.arrow}</a>
    </div>
    <div class="faq-body reveal">
      <div class="faq-panel">
        ${faq.items.map(([q, a], i) => faqItem(q, a, i + 1, i === 0)).join("\n        ")}
      </div>
    </div>
  </div>
</section>
${consultHtml({ course: "기업 맞춤 교육" })}`;
  return layout({
    file: "corporate.html", title: "기업 맞춤 교육 | 팀장 교육·성과관리·코칭·조직문화·세일즈 사내교육",
    desc: "조직 개편 직후, 리더 교체, 성과 정체, 승진자 육성. 기업이 교육을 찾는 때는 대개 정해져 있습니다. 데일카네기 기업교육은 담당자·리더·구성원을 먼저 듣고 150여 개 모듈에서 필요한 것만 꺼내 씁니다.",
    hero: heroSm({ trail, eyebrow: K.eyebrow, title: K.title, sub: K.sub, actions: [["기업교육 상담 신청", "#consult", true], ["고민별 안내 보기", "concerns.html"]] }),
    body, trail,
    // FAQPage 구조화 데이터는 faq.html 한 곳에서만 낸다 — 같은 Q&A를 두 URL에 중복 마크업하지 않는다
    ld: [webPageLd("기업 맞춤 교육", "사전 진단에서 시작하는 데일카네기 기업교육 안내", "corporate.html")],
  });
}

// ------------------------------------------------------------
// 수강 후기 · 데일 카네기 소개 · FAQ · 404
// ------------------------------------------------------------
function buildReviews() {
  const P = PAGES.reviews;
  const trail = [HOME, ["수강 후기", null]];
  const body = `<section class="sec sec-alt sec-tight">
  <div class="wrap">
    ${secHead({ eyebrow: "Endorsements", title: "추천의 글", sub: "세계적인 경영자와 국내 각계 리더들이 데일카네기 코스를 이렇게 이야기합니다." })}
    <div class="endorse reveal">
      ${ENDORSEMENTS.map((e) => `<blockquote><p>${esc(e.text)}</p><footer><strong>${esc(e.name)}</strong><span>${esc(e.title)}</span></footer></blockquote>`).join("\n      ")}
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap narrow">
    ${secHead({ eyebrow: "Reviews", title: ["수강생이", "남긴 후기"], sub: "과정을 마친 분들이 직접 남긴 말입니다. 이름 일부는 가려져 있습니다." })}
    <div class="reviews">
      ${REVIEWS.map((rv, i) => `<article class="review reveal" id="rv-${i + 1}">
        <span class="review-no">${String(i + 1).padStart(2, "0")}</span>
        <h3>${esc(rv.title)}</h3>
        <p class="review-by">${esc(rv.author)}</p>
        <p>${esc(rv.paras[0])}</p>
        ${rv.paras.length > 1 ? `<details class="review-more fold"><summary>이어서 읽기</summary>${rv.paras.slice(1).map((p) => `<p>${esc(p)}</p>`).join("\n        ")}</details>` : ""}
      </article>`).join("\n      ")}
    </div>
    ${FOLD_OPEN}
  </div>
</section>
${consultHtml()}`;
  return layout({
    file: "reviews.html", title: "수강 후기 | 최고경영자 코스·데일카네기 코스 수료생 이야기",
    desc: "워렌 버핏, 리 아이아코카, 손병두 등 추천의 글 7편과 데일카네기 최고경영자 코스·DCC 수료생이 남긴 후기 8편 전문. 12주·8주 과정에서 무엇이 달라졌는지 본인의 말로 읽어 보실 수 있습니다.",
    hero: heroSm({ trail, eyebrow: P.eyebrow, title: P.title, sub: P.sub }),
    body, trail, ld: [webPageLd("수강 후기", "데일카네기 과정 수료생 후기", "reviews.html")],
  });
}

function buildAbout() {
  const A = ABOUT;
  const trail = [HOME, ["데일 카네기", null]];
  const body = `<section class="sec">
  <div class="wrap story-in">
    <figure class="story-fig reveal">
      <img src="assets/dale-book.jpg" alt="자신의 책 『인간관계론』을 읽고 있는 데일 카네기" loading="lazy" decoding="async" width="1200" height="900">
      <span class="story-year">1936</span>
    </figure>
    <div class="story-body prose reveal">
      <p class="eyebrow">Story</p>
      <h2 class="h-xl">${lines(C.STORY.title)}</h2>
      ${A.story.map((p) => `<p>${esc(p)}</p>`).join("\n      ")}
      <ol class="tl">
        ${C.STORY.timeline.map(([y, t]) => `<li><b>${y}</b><span>${esc(t)}</span></li>`).join("\n        ")}
      </ol>
    </div>
  </div>
</section>

<section class="sec sec-alt">
  <div class="wrap">
    ${secHead({ eyebrow: "Method", title: A.cycleTitle, sub: A.cycleSub })}
    <ul class="o-grid o-grid-4 reveal">
      ${A.cycle.map(([t, en, p], i) => `<li><span class="n">0${i + 1}</span><strong>${esc(t)} <em>${esc(en)}</em></strong><p>${esc(p)}</p></li>`).join("\n      ")}
    </ul>
  </div>
</section>

<section class="sec">
  <div class="wrap split">
    <div class="reveal">
      <p class="eyebrow">Leadership</p>
      <h2 class="h-xl">${lines(A.ladderTitle)}</h2>
      <p class="lead" style="margin-top:18px">데일카네기 과정이 사람을 이끄는 힘을 기르는 순서입니다. 지금 나의 리더십은 몇 번째 계단에 있는지 생각해 보십시오.</p>
    </div>
    <ol class="steps reveal" data-steps>
      ${A.ladder.map(([t, d], k) => `<li><span class="step-n">${k + 1}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join("\n      ")}
    </ol>
  </div>
</section>

<section class="sec sec-alt">
  <div class="wrap narrow prose reveal">
    <p class="eyebrow">Korea</p>
    <h2 class="h-xl">${lines(A.koreaTitle)}</h2>
    ${A.korea.map((p) => `<p>${esc(p)}</p>`).join("\n    ")}
  </div>
</section>

<section class="sec">
  <div class="wrap narrow">
    <blockquote class="quote-big reveal"><p>${esc(A.quote.text)}</p><footer><b>${esc(A.quote.by)}</b>${esc(A.quote.title)}</footer></blockquote>
  </div>
</section>
${consultHtml()}`;
  return layout({
    file: "about.html", title: "데일 카네기 소개 | 인간관계론의 저자, 1912년부터 이어진 교육",
    desc: "1912년 뉴욕 YMCA의 강의실에서 시작한 데일 카네기의 이야기와 데일카네기 트레이닝의 교육 방법, 1992년부터 이어온 데일카네기코리아의 교육 실적.",
    hero: heroSm({ trail, eyebrow: A.eyebrow, title: A.title, sub: A.sub }),
    body, trail,
    ld: [{ "@context": "https://schema.org", "@type": "Person", name: "Dale Carnegie", alternateName: "데일 카네기", birthDate: "1888-11-24", deathDate: "1955-11-01", description: "『인간관계론』의 저자, 데일카네기 트레이닝 창시자" }],
  });
}

function buildFaq() {
  const P = PAGES.faq;
  const trail = [HOME, ["자주 묻는 질문", null]];
  let n = 0;
  const groups = C.FAQ.map((g, i) => `<section class="sec${i % 2 ? " sec-alt" : ""}${i === 0 ? " sec-tight" : ""}" id="faq-${i}">
  <div class="wrap faq-in">
    <div class="faq-head reveal">
      <p class="eyebrow">${String(i + 1).padStart(2, "0")}</p>
      <h2 class="h-xl">${esc(g.tab)}</h2>
    </div>
    <div class="faq-body reveal">
      <div class="faq-panel">
        ${g.items.map(([q, a], k) => { n += 1; return faqItem(q, a, n, i === 0 && k === 0); }).join("\n        ")}
      </div>
    </div>
  </div>
</section>`).join("\n");
  const body = `${groups}
${consultHtml()}`;
  return layout({
    file: "faq.html", title: "자주 묻는 질문 | 수업 방식·등록·환불·수료 후·기업교육",
    desc: "데일카네기 과정 상담에서 자주 받는 질문. 수업 진행 방식, 내성적인 사람도 가능한지, 등록과 환불, 수료 후 동문회, 기업교육 진행 방식.",
    hero: heroSm({ trail, eyebrow: P.eyebrow, title: P.title, sub: P.sub, extra: `<div class="chips-lg hero-chips">${C.FAQ.map((g, i) => `<a href="#faq-${i}">${esc(g.tab)}</a>`).join("")}</div>` }),
    body, trail,
    ld: [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ_FLAT.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }],
  });
}

// ------------------------------------------------------------
// 검색 키워드 — 목록 · 허브 · 지역 조합
// ------------------------------------------------------------
function buildTopics() {
  const trail = [HOME, ["주제별 안내", null]];
  const body = `<section class="sec sec-alt sec-tight">
  <div class="wrap">
    <h2 class="sr">주제별 안내</h2>
    <div class="grid-3">
      ${TOPICS.map((t) => topicCard(t)).join("\n      ")}
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "By region", title: ["지역을 정해 놓고", "찾고 계시다면"], sub: "주제를 고른 뒤 지역을 누르면 그 지역의 개강 일정과 담당 지사까지 함께 나옵니다." })}
    ${COMBO_TOPICS.map((t) => `<details class="topic-regions fold">
      <summary><span>${esc(t.kw)}</span><small>${Object.keys(REGIONS).length}개 지역</small></summary>
      <div class="chips-lg">${Object.entries(REGIONS).map(([slug, r]) => `<a href="${comboFile(slug, t)}">${esc(r.name)} ${esc(t.kw)}</a>`).join("")}</div>
      <p class="sec-link"><a href="${topicFile(t)}">${esc(t.kw)} 전체 안내 →</a></p>
    </details>`).join("\n    ")}
    ${FOLD_OPEN}
  </div>
</section>
${consultHtml()}`;
  return layout({
    file: "topics.html", title: "주제별 안내",
    desc: `기업교육·CEO교육·리더십교육·팀장교육·세일즈교육 등 상황별 안내와 지역별 개강 일정.`,
    hero: heroSm({ trail, eyebrow: "Topics", title: ["어떤 교육이", "필요하신가요"], sub: `교육 이름으로 찾는 분도 있고, 지역을 먼저 정하는 분도 있습니다. ${TOPICS.length}가지 주제로도, 지역으로도 찾으실 수 있습니다.` }),
    body, trail, ld: [webPageLd("주제별 안내", "주제별 데일카네기 교육 안내", "topics.html")],
  });
}

// 키워드 허브 — 전국 기준
function buildTopic(t) {
  const trail = [HOME, ["주제별 안내", "topics.html"], [t.kw, null]];
  const related = CONCERNS.filter((c) => (t.concerns || []).includes(c.slug));
  const rows = SCHEDULE.filter((r) => t.courses.includes(r.course));
  const active = rows.filter(isActive);
  const preset = t.courses[0] === "corporate" ? { course: "기업 맞춤 교육" } : { course: COURSES[t.courses[0]].name };
  const body = `<section class="sec">
  <div class="wrap narrow prose reveal">
    <p class="eyebrow">Why you searched</p>
    <h2 class="h-lg">이 말로 찾으실 때는</h2>
    ${t.intent.map((p) => `<p>${esc(p)}</p>`).join("\n    ")}
  </div>
</section>

${t.body.map((sec, i) => `<section class="sec${i % 2 === 0 ? " sec-alt" : ""}">
  <div class="wrap narrow prose reveal">
    <h2 class="h-lg">${esc(sec.h)}</h2>
    ${sec.p.map((p) => `<p>${esc(p)}</p>`).join("\n    ")}
  </div>
</section>`).join("\n")}

<section class="sec sec-tight">
  <div class="wrap narrow">
    <div class="callout reveal"><strong>교육으로 풀리지 않는 부분</strong><p>${esc(t.limit)}</p></div>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "Courses", title: ["이 주제와", "이어지는 과정"] })}
    <div class="grid-3">
      ${relatedCards(t.courses)}
    </div>
  </div>
</section>
${rows.length ? `
<section class="sec sec-alt" id="schedule">
  <div class="wrap">
    ${secHead({ eyebrow: "Schedule", title: `${t.kw} 관련 개강 일정`, sub: active.length ? C.SCHEDULE_COPY.sub : "지금 모집 중인 기수가 없습니다. 상담 신청에 지역을 적어 주시면 다음 기수 일정이 정해지는 대로 먼저 안내해 드립니다." })}
    ${schedListHtml(rows)}
    <p class="sec-link reveal"><a href="schedule.html">전체 개강 일정 보기 →</a></p>
  </div>
</section>` : ""}
${t.combo ? `
<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "By region", title: `지역별 ${t.kw} 안내`, sub: "지역을 고르시면 그 지역의 개강 일정과 담당 지사를 함께 보실 수 있습니다." })}
    <div class="chips-lg chips-more reveal">${Object.entries(REGIONS).map(([slug, r]) => `<a href="${comboFile(slug, t)}">${esc(r.name)} ${esc(t.kw)}</a>`).join("")}</div>
  </div>
</section>` : ""}
${related.length ? `
<section class="sec sec-alt">
  <div class="wrap">
    ${secHead({ eyebrow: "Concerns", title: ["상담에서", "자주 듣는 말"], sub: "이 주제로 찾아오신 분들이 실제로 하시는 이야기입니다." })}
    <div class="grid-3">
      ${related.map(concernCard).join("\n      ")}
    </div>
  </div>
</section>` : ""}

<section class="sec${related.length ? "" : " sec-alt"}" id="faq">
  <div class="wrap faq-in">
    <div class="faq-head reveal">
      <p class="eyebrow">FAQ</p>
      <h2 class="h-xl"><span class="ln">${esc(t.kw)}</span> <span class="ln">관련 질문</span></h2>
      <p class="lead">여기에 없는 내용은 상담 신청에 적어 주세요.</p>
      <a class="btn btn-ink" href="#consult">상담 신청${IC.arrow}</a>
      <p class="faq-more"><a href="faq.html">전체 질문 보기 →</a></p>
    </div>
    <div class="faq-body reveal">
      <div class="faq-panel">
        ${t.faq.map(([q, a], i) => faqItem(q, a, i + 1, i === 0)).join("\n        ")}
      </div>
    </div>
  </div>
</section>

<section class="sec sec-alt">
  <div class="wrap">
    ${secHead({ eyebrow: "More", title: "다른 주제도 보시려면" })}
    <div class="chips-lg chips-more reveal">${TOPICS.filter((x) => x.slug !== t.slug).map((x) => `<a href="${topicFile(x)}">${esc(x.kw)}</a>`).join("")}</div>
  </div>
</section>
${consultHtml(preset)}`;
  return layout({
    file: topicFile(t),
    title: `${t.kw} 안내`,
    desc: `${t.lead} ${t.intent[0].split(". ")[0]}. 데일카네기 ${t.courses.filter((k) => k !== "corporate").map((k) => COURSES[k].code).join("·")} 과정과 전국 개강 일정을 함께 안내합니다.`,
    hero: heroSm({ trail, badge: t.kw, eyebrow: "Topic", title: t.kw, sub: t.lead, actions: [["상담 신청", "#consult", true], ...(rows.length ? [["개강 일정 보기", "#schedule"]] : [])] }),
    body, trail,
    ld: [
      webPageLd(`${t.kw} 안내`, t.lead, topicFile(t)),
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: t.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  });
}

// 지역 × 키워드 조합
function buildCombo(slug, t) {
  const r = REGIONS[slug];
  const br = BRANCH[r.branch];
  const name = `${r.name} ${t.kw}`;
  const rows = SCHEDULE.filter((x) => x.region === slug && t.courses.includes(x.course));
  const active = rows.filter(isActive);
  const next = nextOf(active);
  const near = Object.keys(REGIONS).filter((x) => x !== slug && REGIONS[x].branch === r.branch);
  const nearRows = active.length ? [] : SCHEDULE.filter((x) => near.includes(x.region) && t.courses.includes(x.course) && isActive(x)).sort(byOpen);
  const mine = ALUMNI.filter((a) => a.region === slug);
  const allRows = SCHEDULE.filter((x) => x.region === slug); // 주제와 무관하게 그 지역 전체 이력
  const trail = [HOME, ["주제별 안내", "topics.html"], [t.kw, topicFile(t)], [r.name, null]];
  const preset = t.courses[0] === "corporate" ? { course: "기업 맞춤 교육", region: r.name } : { course: COURSES[t.courses[0]].name, region: r.name };
  const sub = active.length
    ? `${R(t.regionLead, r.name)} 지금 ${active.length}개 기수를 모집하고 있고, 가장 빠른 개강은 ${nextLabel(next)}입니다.`
    : `${R(t.regionLead, r.name)} 지금 이 주제로 열린 기수는 없지만 상담은 받고 있습니다.`;
  const body = `<section class="sec">
  <div class="wrap narrow prose reveal">
    <p class="eyebrow">${esc(r.name)}</p>
    <h2 class="h-lg">${esc(name)}${eul(name)} 찾으셨다면</h2>
    <p>${esc(R(t.regionNote, r.name))}</p>
    <p>${esc(t.intent[0])}</p>
  </div>
</section>

<section class="sec sec-alt" id="schedule">
  <div class="wrap">
    ${secHead({ eyebrow: "Schedule", title: `${r.name} 개강 일정`, sub: active.length ? C.SCHEDULE_COPY.sub : "" })}
    ${rows.length ? schedListHtml(rows) : `<p class="sch-empty reveal">${esc(r.name)}에서 이 주제로 열린 기수는 아직 없습니다. <a href="#consult">상담 신청</a>에 지역을 적어 주시면 개설될 때 먼저 연락드립니다.</p>`}
    ${nearRows.length ? `<div class="near-sched reveal">
      <h3>${esc(br.label)} 관할에서 지금 모집 중인 기수</h3>
      <p>${esc(r.name)}에서 가까운 곳입니다. 등록하시면 그 지역 기수로 안내해 드립니다.</p>
      ${schedListHtml(nearRows)}
    </div>` : ""}
    <p class="sec-link reveal"><a href="${regionFile(slug)}">${esc(r.name)} 전체 과정 안내 →</a> · <a href="${topicFile(t)}">${esc(t.kw)} 자세히 보기 →</a></p>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <h2 class="sr">${esc(r.name)} 수업 장소와 담당 지사</h2>
  </div>
  <div class="wrap split">
    <div class="venue reveal">
      <h3>${REGION.venueTitle}</h3>
      <p>${esc(R(REGION.venueWhere, r.name))}</p>
      <small>${esc(REGION.venueNote)}</small>
    </div>
    <div class="venue reveal">
      <h3>담당 지사</h3>
      <p>${esc(br.label)}</p>
      <small>지사 연락은 상담 신청이나 전화 상담 버튼으로 받고 있습니다.</small>
    </div>
  </div>
</section>

<section class="sec sec-alt">
  <div class="wrap narrow prose reveal">
    <h2 class="h-lg">${esc(r.name)}${eun(r.name)} 이렇게 운영합니다</h2>
    ${regionFacts(slug).map((p) => `<p>${esc(p)}</p>`).join("\n    ")}
  </div>
</section>
${allRows.length ? `
<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "History", title: [`${r.name}에서`, "열렸던 기수"], sub: `${r.name}에서 진행된 기수입니다. 지난 기수도 함께 있습니다.` })}
    ${schedListHtml(allRows)}
  </div>
</section>` : ""}

<section class="sec${allRows.length ? " sec-alt" : ""}">
  <div class="wrap narrow prose reveal">
    <h2 class="h-lg">${esc(t.body[0].h)}</h2>
    ${t.body[0].p.map((p) => `<p>${esc(p)}</p>`).join("\n    ")}
    ${t.limit ? `<div class="callout"><strong>교육으로 풀리지 않는 부분</strong><p>${esc(t.limit)}</p></div>` : ""}
    <p class="sec-link"><a href="${topicFile(t)}">${esc(t.kw)} 전체 안내 보기 →</a></p>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    ${secHead({ eyebrow: "Courses", title: [`${r.name}에서 들을 수 있는`, "관련 과정"] })}
    <div class="grid-3">
      ${t.courses.map((k) => (k === "corporate" ? corpCard() : courseCard(k, slug))).join("\n      ")}
    </div>
  </div>
</section>
${mine.length ? `
<section class="sec sec-alt">
  <div class="wrap">
    ${secHead({ eyebrow: "Alumni", title: REGION.alumniTitle.map((x) => R(x, r.name)), sub: REGION.alumniSub })}
    ${mine.map((a) => `<div class="alumni reveal"><h3>${esc(a.name)} 동문회</h3><ul class="chips-lg">${a.acts.map((x) => `<li><span>${esc(x)}</span></li>`).join("")}</ul></div>`).join("\n    ")}
  </div>
</section>` : ""}

<section class="sec${mine.length ? "" : " sec-alt"}">
  <div class="wrap">
    ${secHead({ eyebrow: "More", title: `${r.name}의 다른 주제` })}
    <div class="chips-lg chips-more reveal">${COMBO_TOPICS.filter((x) => x.slug !== t.slug).map((x) => `<a href="${comboFile(slug, x)}">${esc(r.name)} ${esc(x.kw)}</a>`).join("")}</div>
    <h3 class="sec-title-sm" style="margin-top:34px;font-size:16px;font-weight:700">다른 지역의 ${esc(t.kw)}</h3>
    <div class="chips-lg reveal" style="margin-top:14px">${near.concat(Object.keys(REGIONS).filter((x) => x !== slug && !near.includes(x)).slice(0, 8)).map((x) => `<a href="${comboFile(x, t)}">${esc(REGIONS[x].name)}</a>`).join("")}</div>
  </div>
</section>
${consultHtml(preset)}`;
  return layout({
    file: comboFile(slug, t),
    title: `${name}${active.length ? ` | ${active.length}개 기수 모집` : ""}`,
    desc: `${R(t.regionLead, r.name)} ${active.length ? `${YEAR_LABEL} ${active.length}개 기수 모집 중${next ? `, 가장 빠른 개강 ${next.open}` : ""}.` : "개설 문의와 가까운 지역 기수를 안내합니다."} 담당 ${br.label}.`,
    hero: heroSm({ trail, badge: t.kw, eyebrow: `${br.label} · ${r.name}`, title: [`${r.name}에서 찾는`, t.kw], sub, actions: [["상담 신청", "#consult", true], ["개강 일정 보기", "#schedule"]] }),
    body, trail,
    ld: [
      webPageLd(name, R(t.regionLead, r.name), comboFile(slug, t)),
      ...(active.length ? [{
        "@context": "https://schema.org", "@type": "ItemList", name: `${name} 모집 중인 기수`,
        itemListElement: active.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: `${x.name}${x.gi ? ` ${x.gi}기` : ""}`, ...(SITE.BASE_URL ? { url: abs(courseFile(x.course)) } : {}) })),
      }] : []),
    ],
  });
}

function build404() {
  const P = PAGES.notFound;
  const body = `<section class="sec">
  <div class="wrap">
    <h2 class="sr">주요 페이지</h2>
    <div class="grid-4">
      ${[...NAV, ...NAV_MORE].map(([t, h]) => `<a class="card reveal" href="${h}"><h3>${t}</h3><span class="card-foot">이동<b>${IC.arrow}</b></span></a>`).join("\n      ")}
    </div>
  </div>
</section>
${consultHtml()}`;
  return layout({
    file: "404.html", title: "페이지를 찾을 수 없습니다", desc: P.sub,
    hero: heroSm({ badge: "404", title: P.title, sub: P.sub, actions: [["홈으로", "index.html", true]] }),
    body,
  });
}

// ------------------------------------------------------------
// 출력
// ------------------------------------------------------------
const PAGE_LIST = [
  ["index.html", buildIndex],
  ["courses.html", buildCourses],
  ...COURSE_ORDER.map((k) => [courseFile(k), () => buildCourse(k)]),
  ["schedule.html", buildSchedule],
  ["regions.html", buildRegions],
  ...Object.keys(REGIONS).map((s) => [regionFile(s), () => buildRegion(s)]),
  ["concerns.html", buildConcerns],
  ...CONCERNS.map((c) => [concernFile(c), () => buildConcern(c)]),
  ["topics.html", buildTopics],
  ...TOPICS.map((t) => [topicFile(t), () => buildTopic(t)]),
  ...COMBO_TOPICS.flatMap((t) => Object.keys(REGIONS).map((slug) => [comboFile(slug, t), () => buildCombo(slug, t)])),
  ["corporate.html", buildCorporate],
  ["reviews.html", buildReviews],
  ["about.html", buildAbout],
  ["faq.html", buildFaq],
  ["404.html", build404],
];

fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });
// 지난 빌드의 잔재(이름이 바뀐 페이지)가 남지 않도록 html만 먼저 지운다
const WILL_WRITE = new Set(PAGE_LIST.map(([n]) => n));
// 생성기가 만드는 이름 형태 — 이 형태인데 이번 목록에 없으면 이름이 바뀐 옛 페이지이므로 지운다
const GENERATED = new RegExp("^(index|courses|schedule|regions|concerns|topics|corporate|reviews|about|faq|404|course-[a-z]+|region-[a-z-]+|concern-[a-z-]+|topic-[a-z-]+|[a-z-]+-(" + COMBO_TOPICS.map((t) => t.slug).join("|") + "))\.html$");
const existing = fs.readdirSync(OUT).filter((f) => f.endsWith(".html"));
const stale = existing.filter((f) => !WILL_WRITE.has(f) && GENERATED.test(f));
const strays = existing.filter((f) => !WILL_WRITE.has(f) && !GENERATED.test(f));
for (const f of existing) if (WILL_WRITE.has(f) || stale.includes(f)) fs.unlinkSync(path.join(OUT, f));
for (const [name, fn] of PAGE_LIST) fs.writeFileSync(path.join(OUT, name), fn());
// style.css = 공통(홈) + 하위 페이지. 순서가 중요하다 (뒤쪽이 덮어쓴다)
fs.writeFileSync(path.join(OUT, "style.css"), ["style.css", "pages.css"].map((f) => fs.readFileSync(path.join(SRC, f), "utf8")).join("\n"));
fs.copyFileSync(path.join(SRC, "app.js"), path.join(OUT, "app.js"));
for (const f of ASSETS) {
  const own = path.join(ASSET_OWN, f);
  fs.copyFileSync(fs.existsSync(own) ? own : path.join(ASSET_FROM, f), path.join(OUT, "assets", f));
}
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
if (SITE.BASE_URL) {
  const urls = PAGE_LIST.map(([f]) => f).filter((f) => f !== "404.html").map((f) => `  <url><loc>${abs(f)}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n");
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE.BASE_URL}/sitemap.xml\n`);
  // 도메인은 Cloudflare Worker 커스텀 도메인으로 붙였다(wrangler.toml).
  // GitHub Pages로 되돌릴 일이 생기면 여기서 CNAME 파일을 다시 만들어야 한다 — 없으면 도메인 설정이 풀린다.
  // IndexNow 공용 키 확인 파일. 제출은 전문과외 워커의 중앙 크론이 매일 돌린다 —
  // 이 파일이 자기 도메인에서 열려야 그 사이트를 크론 목록에 넣을 수 있다
  fs.writeFileSync(path.join(OUT, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY);
}

console.log(`빌드 완료 → ${OUT} (${PAGE_LIST.length}개 페이지)`);
if (stale.length) console.warn(`※ 이름이 바뀐 옛 페이지 ${stale.length}개를 지웠습니다: ${stale.join(", ")}`);
if (strays.length) console.warn(`※ 생성기가 만들지 않는 html ${strays.length}개는 그대로 두었습니다: ${strays.join(", ")}`);
if (!SITE.BASE_URL) console.warn("※ SITE.BASE_URL이 비어 있습니다 — noindex 상태로 빌드했고 sitemap.xml·robots.txt는 만들지 않았습니다. 도메인이 정해지면 build.js 상단에 입력하세요.");
if (!FORM_ENDPOINT) console.warn("※ FORM_ENDPOINT가 비어 있습니다 — 상담 폼은 데모 모드(시트 기록 없음)로 동작합니다.");
