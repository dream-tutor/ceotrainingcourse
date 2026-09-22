// 클라우드플레어 DNS를 깃허브 Pages로 붙인다 — node setup-dns.js [--dry]
//
//   토큰은 파일에서만 읽고 화면에 찍지 않는다.
//   기본 경로: 이 폴더의 .cf-token  (환경변수 CF_TOKEN_FILE 로 바꿀 수 있다)
//   필요한 권한: Zone → Zone → Read, Zone → DNS → Edit (대상 존만)
//
// ⚠ 프록시(주황 구름)는 반드시 꺼야 한다. 켜 두면 깃허브가 인증서를 발급하지 못해
//   Enforce HTTPS 가 막힌다. 그래서 아래 레코드는 전부 proxied: false 로 넣는다.
const fs = require("fs");
const path = require("path");

const DOMAIN = "ceotrainingcourse.com";
const PAGES_HOST = "dream-tutor.github.io";
const GH_IPS = ["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"];
const DRY = process.argv.includes("--dry");

const tokenFile = process.env.CF_TOKEN_FILE || path.join(__dirname, ".cf-token");
if (!fs.existsSync(tokenFile)) {
  console.error(`토큰 파일이 없습니다: ${tokenFile}`);
  console.error("클라우드플레어에서 API 토큰을 만들어 이 파일에 한 줄로 저장하세요.");
  process.exit(1);
}
const TOKEN = fs.readFileSync(tokenFile, "utf8").trim();
if (!TOKEN) { console.error("토큰 파일이 비어 있습니다."); process.exit(1); }

const api = async (p, init = {}) => {
  const r = await fetch(`https://api.cloudflare.com/client/v4${p}`, {
    ...init,
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  const j = await r.json();
  if (!j.success) throw new Error(`${p} → ${JSON.stringify(j.errors)}`);
  return j.result;
};

(async () => {
  const zones = await api(`/zones?name=${DOMAIN}`);
  if (!zones.length) {
    console.error(`존이 없습니다: ${DOMAIN}`);
    console.error("도메인을 아직 구매하지 않았거나, 토큰이 이 존을 볼 수 없습니다.");
    process.exit(1);
  }
  const zone = zones[0];
  console.log(`존 ${zone.name} · 상태 ${zone.status} · 네임서버 ${(zone.name_servers || []).join(", ")}`);

  const want = [
    ...GH_IPS.map((ip) => ({ type: "A", name: DOMAIN, content: ip, proxied: false, ttl: 1 })),
    { type: "CNAME", name: `www.${DOMAIN}`, content: PAGES_HOST, proxied: false, ttl: 1 },
  ];

  const existing = await api(`/zones/${zone.id}/dns_records?per_page=200`);
  // 루트와 www 에 붙어 있는 옛 레코드는 치운다 — 등록기관이 넣어 두는 파킹 레코드가 있다
  const touched = new Set([DOMAIN, `www.${DOMAIN}`]);
  const stale = existing.filter((r) => touched.has(r.name) && ["A", "AAAA", "CNAME"].includes(r.type));

  for (const r of stale) {
    const keep = want.find((w) => w.type === r.type && w.name === r.name && w.content === r.content);
    if (keep && r.proxied === false) { keep.done = true; console.log(`그대로  ${r.type} ${r.name} → ${r.content}`); continue; }
    console.log(`${DRY ? "[예정] " : ""}삭제  ${r.type} ${r.name} → ${r.content}${r.proxied ? " (프록시 켜져 있었음)" : ""}`);
    if (!DRY) await api(`/zones/${zone.id}/dns_records/${r.id}`, { method: "DELETE" });
  }

  for (const w of want) {
    if (w.done) continue;
    console.log(`${DRY ? "[예정] " : ""}추가  ${w.type} ${w.name} → ${w.content} (프록시 끔)`);
    if (!DRY) await api(`/zones/${zone.id}/dns_records`, { method: "POST", body: JSON.stringify({ type: w.type, name: w.name, content: w.content, proxied: false, ttl: 1 }) });
  }

  if (DRY) { console.log("\n--dry 라 아무것도 바꾸지 않았습니다."); return; }

  // SSL 을 Full 로 두어야 프록시를 나중에 켜더라도 루프가 생기지 않는다
  try {
    const ssl = await api(`/zones/${zone.id}/settings/ssl`);
    console.log(`SSL 모드: ${ssl.value}${ssl.value === "flexible" ? "  ⚠ full 로 올리는 것을 권합니다" : ""}`);
  } catch (e) { console.log("SSL 설정은 읽지 못했습니다(토큰 권한 밖) — 대시보드에서 확인하세요."); }

  console.log("\n끝났습니다. 전파된 뒤 깃허브 저장소 Settings → Pages 에서 Enforce HTTPS 를 켜세요.");
  console.log("확인: node check-dns.js");
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
