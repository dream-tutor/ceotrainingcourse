// 모든 페이지를 헤드리스 크롬으로 열어 콘솔 오류·예외를 수집한다 — node test-console.js
// 빌드는 통과하는데 브라우저에서만 터지는 오류(예: 선언 전 참조)를 잡는다
//
// 탭 하나로 460번 이동하면 크롬 쪽 자원이 쌓여 ERR_INSUFFICIENT_RESOURCES가 난다.
// 페이지 문제가 아니라 검사 도구 문제이므로 CHUNK마다 크롬을 새로 띄운다.
const { spawn } = require("child_process");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DOCS = require("path").join(__dirname, "docs").split("\\").join("/");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CHUNK = 60;

// 크롬 하나를 띄워 pages를 순서대로 열고, 페이지마다 모인 오류를 돌려준다
async function sweep(pages, onPage) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const prof = "C:/Users/goodj/AppData/Local/Temp/claude/cprof-c" + port;
  const chrome = spawn(CHROME,
    ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
      "--no-first-run", "--disable-gpu", "--disable-extensions", "--disable-dev-shm-usage", "about:blank"],
    { stdio: "ignore" });
  let t;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch (e) {}
  }
  if (!t || !t.length) { chrome.kill(); throw new Error("크롬에 붙지 못했습니다"); }

  const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map(); let bucket = [];
  ws.onmessage = (m) => {
    const o = JSON.parse(m.data);
    if (o.id && pend.has(o.id)) { pend.get(o.id)(o); pend.delete(o.id); return; }
    if (o.method === "Runtime.exceptionThrown") {
      const e = o.params.exceptionDetails;
      bucket.push("예외: " + ((e.exception && (e.exception.description || e.exception.value)) || e.text));
    }
    if (o.method === "Log.entryAdded" && o.params.entry.level === "error") bucket.push("로그: " + o.params.entry.text);
    if (o.method === "Runtime.consoleAPICalled" && o.params.type === "error") {
      bucket.push("콘솔: " + o.params.args.map((a) => a.description || a.value).join(" "));
    }
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result.result.value;
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  for (const p of pages) {
    bucket = [];
    await send("Page.navigate", { url: `file:///${DOCS}/${p}` });
    await sleep(900);
    // 스크롤해서 등장 효과·순차 점등까지 실행시킨다
    await ev(`(async()=>{document.documentElement.style.scrollBehavior='auto';const h=document.documentElement.scrollHeight;for(let y=0;y<=h;y+=innerHeight){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,90));}window.scrollTo(0,0);return 1})()`);
    await sleep(500);
    onPage(p, [...new Set(bucket)]);
  }

  ws.close(); chrome.kill(); await sleep(400);
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
}

(async () => {
  const pages = fs.readdirSync(DOCS).filter((f) => f.endsWith(".html"));
  const hits = new Map();
  const onPage = (p, errs) => { if (errs.length) hits.set(p, errs); };

  for (let i = 0; i < pages.length; i += CHUNK) {
    const slice = pages.slice(i, i + CHUNK);
    await sweep(slice, onPage);
    process.stdout.write(`${Math.min(i + CHUNK, pages.length)}/${pages.length} 확인\n`);
  }

  // 자원 고갈로 한 번 놓친 페이지는 깨끗한 크롬으로 한 번 더 본다 — 진짜 오류만 남긴다
  const flaky = [...hits.keys()].filter((p) => hits.get(p).every((e) => e.includes("ERR_INSUFFICIENT_RESOURCES")));
  if (flaky.length) {
    process.stdout.write(`자원 부족으로 걸린 ${flaky.length}개 재확인\n`);
    await sweep(flaky, (p, errs) => { if (errs.length) hits.set(p, errs); else hits.delete(p); });
  }

  for (const [p, errs] of hits) {
    console.log(`✗ ${p}`);
    errs.slice(0, 3).forEach((x) => console.log("   " + x.split("\n")[0].slice(0, 160)));
  }
  console.log(hits.size ? `\n오류 있는 페이지 ${hits.size}/${pages.length}` : `\n${pages.length}개 페이지 전부 콘솔 오류 없음`);
  process.exit(hits.size ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
