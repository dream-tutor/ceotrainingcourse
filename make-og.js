// 공유 카드 이미지를 다시 뽑는다 — node make-og.js
// src/og.html 을 1200×630 으로 찍어 assets/og.png 에 저장한다. docs로 옮기는 것은 build.js가 한다.
// 첫 사이트의 og.png 에는 "카네기코스"가 박혀 있어 그대로 쓰면 공유 카드에 다른 사이트 이름이 뜬다.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SRC = path.join(__dirname, "src", "og.html").split("\\").join("/");
const OUT = path.join(__dirname, "assets", "og.png"); // 이 사이트 전용 자산 — 빌드가 docs로 복사한다

(async () => {
  const port = 9900 + Math.floor(Math.random() * 90);
  const prof = "C:/Users/goodj/AppData/Local/Temp/claude/cprof-og" + port;
  const chrome = spawn(CHROME,
    ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
      "--no-first-run", "--disable-gpu", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  let t;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch (e) {}
  }
  if (!t || !t.length) { chrome.kill(); throw new Error("크롬에 붙지 못했습니다"); }

  const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map();
  ws.onmessage = (m) => { const o = JSON.parse(m.data); if (o.id && pend.has(o.id)) { pend.get(o.id)(o); pend.delete(o.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `file:///${SRC}` });
  await sleep(1500); // 웹폰트와 사진이 다 뜬 뒤에 찍는다
  await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
  await sleep(400);
  const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
  fs.writeFileSync(OUT, Buffer.from(shot.result.data, "base64"));

  ws.close(); chrome.kill(); await sleep(400);
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  console.log(`공유 카드 저장 → ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)}KB)`);
  console.log("이제 node build.js 를 돌리면 docs/assets/og.png 로 복사됩니다.");
})().catch((e) => { console.error(e); process.exit(1); });
