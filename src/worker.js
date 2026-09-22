// docs/ 를 그대로 내보내는 앞단 워커.
//  · 대표 도메인이 아닌 호스트(www·workers.dev)는 대표 도메인으로 301
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

    if (!local && url.hostname !== DOMAIN) {
      return Response.redirect(`https://${DOMAIN}${url.pathname}${url.search}`, 301);
    }

    if (url.pathname === "/" || url.pathname.endsWith("/")) {
      const to = new URL(request.url);
      to.pathname += "index.html";
      return env.ASSETS.fetch(new Request(to, request));
    }

    return env.ASSETS.fetch(request);
  },
};
