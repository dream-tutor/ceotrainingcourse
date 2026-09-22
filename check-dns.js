// 도메인이 제대로 붙었는지 본다 — node check-dns.js
// 토큰 없이 공개 DNS와 HTTP 응답만 보므로 아무 때나 돌려도 된다.
const DOMAIN = "ceotrainingcourse.com";
const GH_IPS = new Set(["185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"]);
const CF_RANGES = ["104.16.", "104.17.", "104.18.", "104.19.", "104.20.", "104.21.", "172.6", "172.7", "188.114.", "162.159."];

const dns = async (name, type) => {
  const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${name}&type=${type}`, { headers: { accept: "application/dns-json" } });
  const j = await r.json();
  return (j.Answer || []).map((x) => x.data);
};

(async () => {
  const a = await dns(DOMAIN, "A");
  const www = await dns(`www.${DOMAIN}`, "CNAME");

  console.log(`A    ${DOMAIN}: ${a.join(", ") || "(없음)"}`);
  console.log(`CNAME www.${DOMAIN}: ${www.join(", ") || "(없음)"}`);

  const hit = a.filter((ip) => GH_IPS.has(ip));
  const proxied = a.some((ip) => CF_RANGES.some((p) => ip.startsWith(p)));

  if (!a.length) console.log("\n✗ 아직 A 레코드가 없습니다. 도메인 구매와 DNS 등록을 먼저 하세요.");
  else if (proxied) console.log("\n✗ 클라우드플레어 프록시가 켜져 있습니다(주황 구름). 끄지 않으면 깃허브가 인증서를 발급하지 못합니다.");
  else if (hit.length < 4) console.log(`\n△ 깃허브 IP가 ${hit.length}/4 개만 잡힙니다. 전파 중이거나 레코드가 빠졌습니다.`);
  else console.log("\n✓ A 레코드 4개가 깃허브를 가리킵니다.");

  for (const url of [`https://${DOMAIN}/`, `https://www.${DOMAIN}/`]) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      console.log(`${url} → ${r.status}${r.headers.get("location") ? " → " + r.headers.get("location") : ""}`);
    } catch (e) {
      console.log(`${url} → 연결 실패 (${String(e.message || e).slice(0, 60)})`);
    }
  }
  console.log("\nHTTPS 가 열리면 저장소 Settings → Pages 에서 Enforce HTTPS 를 켜세요.");
})();
