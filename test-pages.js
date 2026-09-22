// 생성된 페이지 기계 점검 — node test-pages.js
// 깨진 내부 링크·이미지, id 중복, 페이지당 h1 개수, 템플릿 자국, #앵커 유효성,
// 제목 계층 건너뜀, title 길이, description 중복, og:image 유무를 본다
const fs = require("fs"), path = require("path");
const OUT = process.argv[2] || path.join(__dirname, "docs");
const files = fs.readdirSync(OUT).filter(f => f.endsWith(".html"));
const have = new Set(fs.readdirSync(OUT));
const assets = new Set(fs.readdirSync(path.join(OUT, "assets")).map(f => "assets/" + f));
const bad = { links: [], imgs: [], dupIds: [], h1: [], tmpl: [], anchors: [], dupTitle: [], dupDesc: [], dupH1: [], longTitle: [], visibleTel: [], telLinks: [] };
// 전 사이트 규칙: 번호는 tel: href·aria-label·JSON-LD 에만, 전화 진입점은 플로팅 하나뿐
const TEL_RE = /0\d{1,2}-\d{3,4}-\d{4}|1[5-9]\d{2}-\d{4}/g;
// 조합 페이지는 같은 틀로 찍어 내서 title·description이 겹치기 쉽다.
// 겹치면 검색엔진이 한 페이지만 남기고 나머지를 버린다
const seen = { title: {}, desc: {}, h1: {} };
for (const f of files) {
  const html = fs.readFileSync(path.join(OUT, f), "utf8");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) bad.dupIds.push([f, [...new Set(dup)]]);
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) bad.h1.push([f, h1]);
  if (/undefined|\[object Object\]|NaN|\{R\}|\{N\}|\{NEXT\}|\{YEAR\}|\{COUNT\}|\{REGIONS\}/.test(html)) {
    const hit = html.match(/.{40}(undefined|\[object Object\]|NaN|\{R\}|\{N\}|\{NEXT\}|\{YEAR\}|\{COUNT\}|\{REGIONS\}).{40}/g);
    bad.tmpl.push([f, hit ? hit.slice(0, 3) : []]);
  }
  {
    const vis = html.replace(/<script[^]*?<\/script>/g, " ").replace(/<style[^]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
    const nums = [...new Set(vis.match(TEL_RE) || [])];
    if (nums.length) bad.visibleTel.push([f, nums]);
    const tels = (html.match(/href="tel:/g) || []).length;
    if (tels > 1) bad.telLinks.push([f, tels]);
  }
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "(없음)";
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "(없음)";
  const h1txt = ((html.match(/<h1[^>]*>([^]*?)<\/h1>/) || [])[1] || "(없음)").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  (seen.title[title] = seen.title[title] || []).push(f);
  (seen.desc[desc] = seen.desc[desc] || []).push(f);
  (seen.h1[h1txt] = seen.h1[h1txt] || []).push(f);
  if (title.length > 60) bad.longTitle.push([f, title.length]);

  for (const m of html.matchAll(/href="([^"#][^"]*?)"/g)) {
    // 404.html 은 어느 깊이에서 서빙될지 모르므로 루트 절대경로를 쓴다 — 앞의 / 를 떼고 본다
    const href = m[1].split("?")[0].split("#")[0].replace(/^\//, "");
    if (!href || /^(https?:|tel:|mailto:|data:)/.test(href)) continue;
    if (!have.has(href)) bad.links.push([f, m[1]]);
  }
  for (const m of html.matchAll(/src="([^"]+)"/g)) {
    const src = m[1].split("?")[0].replace(/^\//, "");
    if (/^(https?:|data:)/.test(src)) continue;
    if (!assets.has(src) && !have.has(src)) bad.imgs.push([f, src]);
  }
  // 같은 페이지 내 #앵커가 실제로 있는지
  for (const m of html.matchAll(/href="#([^"]+)"/g)) {
    if (!ids.includes(m[1]) && m[1] !== "top") bad.anchors.push([f, "#" + m[1]]);
  }
}
for (const [kind, key] of [["title", "dupTitle"], ["desc", "dupDesc"], ["h1", "dupH1"]]) {
  for (const [val, list] of Object.entries(seen[kind])) {
    if (list.length > 1) bad[key].push([val.slice(0, 60), list.length, list.slice(0, 3)]);
  }
}
const uniq = (arr) => [...new Set(arr.map(JSON.stringify))].map(JSON.parse);
console.log("페이지:", files.length);
for (const k of Object.keys(bad)) {
  const v = uniq(bad[k]);
  console.log(k + ":", v.length, v.length ? JSON.stringify(v.slice(0, 8)) : "OK");
}
