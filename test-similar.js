// 페이지가 서로 얼마나 겹치는지 — node test-similar.js
//
// 지역 × 주제 조합 페이지는 같은 뼈대에 값만 바꿔 찍어 내기 쉽다.
// 그렇게 되면 검색엔진이 doorway page로 보고 잘 만든 페이지까지 같이 끌어내린다.
// 본문을 6글자 단위로 쪼개 자카드 유사도를 재서, 늘려도 되는 상태인지 확인한다.
//
// 기준
//   같은 주제 다른 지역 0.7 이상  → 주제를 늘리지 말고 지역 데이터를 더 실을 것
//   80% 넘는 쌍이 하나라도 있음    → 그 쌍부터 갈라 놓을 것
const fs = require("fs");
const path = require("path");
const { TOPICS } = require("./content-topics.js");

const DOCS = path.join(__dirname, "docs");
const COMBO = TOPICS.filter((t) => t.combo).map((t) => t.slug);
const COMBO_RE = new RegExp(`^[a-z-]+-(${COMBO.join("|")})\\.html$`);

// 본문만 본다 — 헤더·푸터·상담 폼은 모든 페이지에 똑같이 들어가므로 빼야 실제 차이가 보인다
const bodyText = (f) => {
  let h = fs.readFileSync(path.join(DOCS, f), "utf8");
  h = h.replace(/<script[^]*?<\/script>/g, " ").replace(/<style[^]*?<\/style>/g, " ");
  const m = h.match(/<main[^>]*>([^]*)<\/main>/);
  if (m) h = m[1];
  h = h.replace(/<section class="consult"[^]*?<\/section>/g, " ");
  return h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};
// 6글자 조각을 문자열로 들고 있으면 400여 페이지에서 메모리가 터진다.
// 32비트로 해시해 정렬한 배열로 두면 크기도 작고 교집합도 한 번 훑어 구할 수 있다
const grams = (t) => {
  const seen = new Set();
  for (let i = 0; i + 6 <= t.length; i++) {
    let h = 2166136261;
    for (let k = i; k < i + 6; k++) { h ^= t.charCodeAt(k); h = Math.imul(h, 16777619); }
    seen.add(h | 0);
  }
  return Int32Array.from(seen).sort();
};
const jaccard = (a, b) => {
  let i = 0, x = 0, y = 0;
  while (x < a.length && y < b.length) {
    if (a[x] === b[y]) { i++; x++; y++; }
    else if (a[x] < b[y]) x++;
    else y++;
  }
  return i / (a.length + b.length - i);
};

const files = fs.readdirSync(DOCS).filter((f) => f.endsWith(".html"));
const combos = files.filter((f) => COMBO_RE.test(f) && !/^(topic|region|concern|course)-/.test(f));
const regions = files.filter((f) => /^region-/.test(f));
if (!combos.length) { console.error("조합 페이지가 없습니다. node build.js 먼저 실행하세요."); process.exit(1); }

const G = {};
for (const f of combos.concat(regions)) G[f] = grams(bodyText(f));
const avg = (list) => {
  let s = 0, n = 0;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { s += jaccard(G[list[i]], G[list[j]]); n++; }
  return n ? s / n : 0;
};

let fail = 0;
const len = Math.round(combos.reduce((s, f) => s + bodyText(f).length, 0) / combos.length);
console.log(`전체 ${files.length}개 · 조합 ${combos.length}개 · 평균 본문 ${len}자`);

// 같은 주제를 24개 지역에 찍어 낸 쪽이 가장 위험한 축이다
const sampleTopic = COMBO[0];
const sameTopic = avg(combos.filter((f) => f.endsWith(`-${sampleTopic}.html`)));
console.log(`같은 주제 다른 지역: ${sameTopic.toFixed(3)} (${sampleTopic} 기준)`);
if (sameTopic >= 0.7) { console.error("  ✗ 0.7 이상 — 주제를 늘리기 전에 지역 데이터를 더 실을 것"); fail++; }

// 주제 slug에도 하이픈이 들어가므로(ceo-network 등) 정규식으로 자르면 지역을 잘못 집는다.
// 파일명 뒤에서 주제를 떼어 내는 쪽이 확실하다
const regionOf = (f) => {
  const t = COMBO.filter((s) => f.endsWith(`-${s}.html`)).sort((a, b) => b.length - a.length)[0];
  return f.slice(0, -(t.length + ".html".length + 1));
};
const sampleRegion = regionOf(combos[0]);
console.log(`같은 지역 다른 주제: ${avg(combos.filter((f) => f.startsWith(`${sampleRegion}-`))).toFixed(3)} (${sampleRegion} 기준)`);
console.log(`지역 페이지끼리: ${avg(regions).toFixed(3)}`);

let over = 0, max = 0, worst = "";
for (let i = 0; i < combos.length; i++) {
  for (let j = i + 1; j < combos.length; j++) {
    const v = jaccard(G[combos[i]], G[combos[j]]);
    if (v >= 0.8) over++;
    if (v > max) { max = v; worst = `${combos[i]} + ${combos[j]}`; }
  }
}
console.log(`80% 넘는 쌍: ${over}개 · 최대 ${max.toFixed(3)} (${worst})`);
if (over) { console.error("  ✗ 거의 같은 페이지가 있습니다"); fail++; }
if (len < 1500) { console.error(`  ✗ 본문이 평균 ${len}자로 얇습니다`); fail++; }

console.log(fail ? `\n실패 ${fail}건` : "\n전부 통과");
process.exit(fail ? 1 : 0);
