// docs/ 를 그대로 내보내는 앞단 워커.
//  · http 로 들어온 요청과 대표 도메인이 아닌 호스트(www 등)는 https 대표 도메인으로 301
//    (http 를 그대로 두면 상담 양식이 암호화되지 않은 페이지에서 열린다 — 2026-09-29 점검)
//    workers.dev 주소는 wrangler.toml 의 workers_dev = false 로 꺼 두었다(2026-09-30, 스쿨링트립과 통일)
//  · /index.html 직접 요청은 / 로 301 — 홈의 canonical·sitemap 이 "/" 라 여기로 모은다(2026-09-30).
//    다른 .html 주소는 그대로 200 이다(html_handling none)
//  · 디렉터리 요청(/ 나 /로 끝나는 경로)은 index.html 로 이어 준다
//
// html_handling 을 "none" 으로 둔 이유: 이 사이트의 canonical·sitemap·내부 링크가
// 전부 "busan-ceo.html" 형태다. 기본값(auto-trailing-slash)이면 /foo.html 을
// /foo 로 넘겨 버려서 canonical 과 실제 주소가 어긋난다.
const DOMAIN = "ceotrainingcourse.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";

    if (!local && (url.protocol === "http:" || url.hostname !== DOMAIN)) {
      return Response.redirect(`https://${DOMAIN}${url.pathname}${url.search}`, 301);
    }

    if (url.pathname === "/index.html") {
      url.pathname = "/";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/" || url.pathname.endsWith("/")) {
      const to = new URL(request.url);
      to.pathname += "index.html";
      return env.ASSETS.fetch(new Request(to, request));
    }

    return env.ASSETS.fetch(request);
  },
};
