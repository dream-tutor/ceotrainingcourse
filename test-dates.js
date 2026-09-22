// 개강·수료일 연도 해석 회귀 테스트 — node test-dates.js
//
// 데이터의 날짜는 "MM.DD"라 연도가 없다. 연도를 잘못 고르면 두 방향으로 깨진다.
//  · 아직 개강도 안 한 기수가 '종료'로 찍혀 모집 집계에서 빠진다
//  · 한참 지난 기수가 '접수 중'으로 되살아나 끝난 과정을 모집한다고 안내한다
// 둘 다 실제로 겪었다. build.js가 쓰는 lib-dates.js를 그대로 불러 검사한다.
const { SCHEDULE } = require("../site/data.js");
const D = require("./lib-dates.js");

const iso = D.isoDay;
const day = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const mmddOf = (r) => { const [m, d] = r.open.split("."); return { m: +m, d: +d }; };

let fail = 0;
const check = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); fail++; } };

// ── 1. 수료일은 언제 빌드하든 개강일보다 뒤여야 한다
console.log("1. 수료일 > 개강일 (빌드 날짜 24개)");
for (let m = 0; m < 12; m++) {
  for (const d of [5, 20]) {
    const ref = Date.UTC(2026, m, d);
    for (const r of SCHEDULE) {
      if (!r.close) continue;
      const o = D.schedDate(r.open, ref), c = D.closeDate(r, ref);
      check(c > o, `${iso(ref)} 빌드 · ${r.name} ${r.gi}기: 개강 ${iso(o)} / 수료 ${iso(c)}`);
    }
  }
}

// ── 2. 개강~수료 간격이 1년을 넘지 않아야 한다
console.log("2. 개강~수료 간격이 1년 미만");
{
  const ref = day("2026-09-22");
  for (const r of SCHEDULE) {
    if (!r.close) continue;
    const days = (D.closeDate(r, ref) - D.schedDate(r.open, ref)) / 864e5;
    check(days > 0 && days < 365, `${r.name} ${r.gi}기: ${days}일`);
  }
}

// ── 3. 아직 개강하지 않은 기수가 '종료'로 찍히면 안 된다
console.log("3. 미개강 기수가 done으로 찍히지 않는다");
for (const t of ["2026-04-05", "2026-05-01", "2026-06-15", "2026-07-27", "2026-08-01", "2026-09-22"]) {
  const ref = day(t);
  for (const r of SCHEDULE) {
    const o = D.schedDate(r.open, ref);
    if (o != null && o > ref) check(D.schedStatus(r, ref) !== "done", `${t} 빌드 · ${r.name} ${r.gi}기(개강 ${iso(o)})가 done`);
  }
}

// ── 4. 지난 기수가 내년 날짜로 되살아나면 안 된다
// 데이터를 갱신하지 않은 채 시간이 흐르면 개강일이 한참 지난 행이 남는다.
// 그 행이 open/soon으로 뒤집히면 이미 끝난 기수를 모집한다고 안내하게 된다
console.log("4. 지난 기수가 '접수 중'으로 되살아나지 않는다");
for (const t of ["2026-09-22", "2026-11-01", "2026-12-15", "2027-01-10", "2027-03-01"]) {
  const ref = day(t);
  for (const r of SCHEDULE) {
    const { m, d } = mmddOf(r);
    const actual = Date.UTC(2026, m - 1, d); // 이 데이터가 가리키는 실제 개강일(2026년 하반기 일정)
    if (actual >= ref - 60 * 864e5) continue; // 아직 최근이면 검사 대상 아님
    const st = D.schedStatus(r, ref);
    check(st !== "open" && st !== "soon", `${t} 빌드 · ${r.name} ${r.gi}기(실제 ${iso(actual)})가 ${st} → ${iso(D.schedDate(r.open, ref))}`);
  }
}

// ── 5. 오늘 기준 기대값
console.log("5. 오늘 기준 표본");
{
  const ref = day("2026-09-22");
  const jinju = SCHEDULE.find((r) => r.name === "진주 CEO");
  check(iso(D.closeDate(jinju, ref)) === "2027-01-11", `진주 수료일 ${iso(D.closeDate(jinju, ref))} (기대 2027-01-11)`);
  check(D.schedStatus(jinju, ref) === "open", `진주 상태 ${D.schedStatus(jinju, ref)} (기대 open)`);
  const active = SCHEDULE.filter((r) => D.isActive(r, ref));
  const regions = new Set(active.map((r) => r.region)).size;
  console.log(`   모집 중 ${active.length}개 기수 · ${regions}개 지역`);
  check(active.length === 15, `모집 기수 ${active.length} (기대 15)`);
  check(regions === 11, `모집 지역 ${regions} (기대 11)`);
}

console.log(fail ? `\n실패 ${fail}건` : "\n전부 통과");
process.exit(fail ? 1 : 0);
