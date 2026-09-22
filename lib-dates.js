// ============================================================
// 개강·수료일 해석 — build.js와 test-dates.js가 같이 쓴다
//
// 데이터의 날짜는 "MM.DD"라 연도가 없다. 연도를 잘못 고르면
// 아직 개강도 안 한 기수가 '종료'로 찍히거나(모집 집계에서 빠짐),
// 한참 지난 기수가 '접수 중'으로 되살아난다. 둘 다 실제로 겪었다.
// 고쳤으면 `node test-dates.js`를 돌릴 것.
// ============================================================

// "MM.DD" → 기준일(ref)에서 가장 가까운 해의 타임스탬프
//  · 달 번호끼리 빼서 비교하면 10월 개강 + 1월 수료처럼 경계에 걸리는 조합에서 한 해가 어긋난다
//  · "n일 넘게 지났으면 내년"으로 미루면 오래된 지난 기수가 내년 날짜로 되살아난다
function schedDate(mmdd, ref) {
  const m = /^(\d{1,2})\.(\d{1,2})$/.exec(String(mmdd || "").trim());
  if (!m) return null;
  const rd = new Date(ref);
  const mo = +m[1] - 1, day = +m[2];
  const at = (y) => Date.UTC(y, mo, day);
  const y = rd.getUTCFullYear();
  return [at(y - 1), at(y), at(y + 1)].reduce((a, b) => (Math.abs(b - ref) < Math.abs(a - ref) ? b : a));
}

// 수료일은 개강일을 기준으로 읽고, 그래도 개강일보다 앞서면 이듬해다
// (12주 과정이 10월에 열리면 수료는 이듬해 1월)
function closeDate(r, ref) {
  const o = schedDate(r.open, ref);
  const c = schedDate(r.close, o ?? ref);
  if (c == null || o == null || c >= o) return c;
  const x = new Date(c);
  return Date.UTC(x.getUTCFullYear() + 1, x.getUTCMonth(), x.getUTCDate());
}

// 접수 중(open) → 개강 7일 이내(soon) → 개강 완료(past) → 수료일 경과(done)
// "MM.DD"가 아니면 일정 문의(tba)
function schedStatus(r, ref) {
  const o = schedDate(r.open, ref), c = closeDate(r, ref);
  if (o == null) return "tba";
  if (c != null && c < ref) return "done";
  if (o <= ref) return "past";
  if (o - ref <= 7 * 864e5) return "soon";
  return "open";
}

const isActive = (r, ref) => ["open", "soon", "tba"].includes(schedStatus(r, ref));
const isoDay = (t) => (t == null ? "" : new Date(t).toISOString().slice(0, 10));

module.exports = { schedDate, closeDate, schedStatus, isActive, isoDay };
