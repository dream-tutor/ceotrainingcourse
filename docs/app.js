/* ============================================================
   데일카네기 두 번째 사이트 — 동작 (모든 페이지 공통)
   build.js가 docs/app.js로 복사한다. 여기(src)만 고칠 것
   ============================================================ */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasIO = "IntersectionObserver" in window;

  // ---------- 헤더 · 따라다니는 버튼 ----------
  const hd = $("#hd");
  const float = $("#float");
  const onScroll = () => {
    hd.classList.toggle("is-solid", window.scrollY > 24);
    if (float) float.classList.toggle("is-on", window.scrollY > window.innerHeight * 0.6);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // ---------- 모바일 메뉴 ----------
  const burger = $("#burger");
  const mnav = $("#mnav");
  const setMenu = (open) => {
    mnav.hidden = !open;
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    hd.classList.toggle("is-menu", open);
    document.body.classList.toggle("is-locked", open);
    // 메뉴가 화면을 덮는 동안 뒤쪽 콘텐츠로 Tab이 새어 나가지 않게 한다
    const backdrops = $$("main, footer, .float, .hero");
    if ("inert" in HTMLElement.prototype) backdrops.forEach((el) => { el.inert = open; });
    else { // 구형 브라우저 — 포커스 가능한 요소의 tabindex를 직접 걷어낸다
      backdrops.forEach((el) => $$('a[href], button, input, select, textarea, [tabindex]', el).forEach((t) => {
        if (open) { if (t.dataset.ti === undefined) t.dataset.ti = t.getAttribute("tabindex") || ""; t.setAttribute("tabindex", "-1"); }
        else if (t.dataset.ti !== undefined) { t.dataset.ti ? t.setAttribute("tabindex", t.dataset.ti) : t.removeAttribute("tabindex"); delete t.dataset.ti; }
      }));
    }
    if (open) { const first = $("a", mnav); if (first) first.focus(); }
  };
  burger.addEventListener("click", () => setMenu(mnav.hidden));
  mnav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !mnav.hidden) { setMenu(false); burger.focus(); } });
  window.addEventListener("resize", () => { if (window.innerWidth > 980 && !mnav.hidden) setMenu(false); });

  // ---------- 히어로 슬라이드 (홈에만 있다) ----------
  (() => {
    const hero = $(".hero");
    const bar = $("#heroBar");
    if (!hero || !bar) return;
    const slides = $$(".slide", hero);
    const now = $("#heroNow");
    const pauseBtn = $("#heroPause");
    if (slides.length < 2) return;
    let cur = 0;
    const runBar = () => {
      bar.classList.remove("is-run");
      if (reduce) return; // 움직임 줄이기 설정이면 자동으로 넘기지 않는다
      void bar.offsetWidth;
      bar.classList.add("is-run");
    };
    const go = (i) => {
      cur = (i + slides.length) % slides.length;
      slides.forEach((s, k) => {
        s.classList.toggle("is-on", k === cur);
        s.inert = k !== cur;
        if (k === cur) s.removeAttribute("aria-hidden"); else s.setAttribute("aria-hidden", "true");
      });
      hero.dataset.slide = String(cur);
      now.textContent = String(cur + 1).padStart(2, "0");
      runBar();
    };
    bar.addEventListener("animationend", () => go(cur + 1));
    $("#heroPrev").addEventListener("click", () => go(cur - 1));
    $("#heroNext").addEventListener("click", () => go(cur + 1));
    pauseBtn.addEventListener("click", () => {
      const p = hero.classList.toggle("is-paused");
      pauseBtn.setAttribute("aria-pressed", String(p)); // 이름은 "자동 넘김"으로 고정, 상태는 pressed로만 알린다
    });
    // 글을 읽는 동안(마우스를 올렸거나 키보드 초점이 있을 때)과 화면 밖에서는 멈춘다
    const copy = $(".hero-copy", hero);
    copy.addEventListener("mouseenter", () => hero.classList.add("is-hold"));
    copy.addEventListener("mouseleave", () => hero.classList.remove("is-hold"));
    copy.addEventListener("focusin", () => hero.classList.add("is-hold"));
    copy.addEventListener("focusout", () => hero.classList.remove("is-hold"));
    if (hasIO) new IntersectionObserver((en) => hero.classList.toggle("is-away", !en[0].isIntersecting), { threshold: 0.25 }).observe(hero);
    // 터치 넘기기
    let x0 = null;
    hero.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 56) go(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });
    slides.forEach((s, k) => { s.inert = k !== 0; });
    runBar();
  })();

  // ---------- 등장 효과 · 단계 순차 점등 · 숫자 카운트 ----------
  const reveals = $$(".reveal");
  const stepLists = $$("[data-steps]");
  const counters = $$("[data-count]");
  const lightSteps = (ol) => $$("li", ol).forEach((li, i) => setTimeout(() => li.classList.add("is-on"), reduce ? 0 : 250 + i * 480));
  const countUp = (el) => {
    const to = +el.dataset.count;
    if (reduce || !to) return;
    const t0 = performance.now(), dur = 1700;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString("ko-KR");
      if (p < 1) requestAnimationFrame(tick);
    };
    el.textContent = "0";
    requestAnimationFrame(tick);
  };
  if (hasIO) {
    const once = (fn, opt) => new IntersectionObserver((entries, io) => entries.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); fn(en.target); } }), opt);
    const ioReveal = once((el) => el.classList.add("is-in"), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach((el) => ioReveal.observe(el));
    const ioSteps = once(lightSteps, { threshold: 0.35 });
    stepLists.forEach((el) => ioSteps.observe(el));
    const ioCount = once(countUp, { threshold: 0.6 });
    counters.forEach((el) => ioCount.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
    stepLists.forEach(lightSteps);
  }

  // ---------- 모집 현황 숫자 ----------
  // 일정표가 없는 페이지에서도 접속 시점 기준으로 다시 센다. 빌드 시점 값으로 두면
  // 시간이 지나면서 같은 페이지 안의 일정표 배지와 카드 숫자가 서로 어긋난다.
  const statusOf = (row, today) => {
    const o = Date.parse(row.o), c = Date.parse(row.c);
    if (isNaN(o)) return "tba";
    if (!isNaN(c) && c < today) return "done";
    if (o <= today) return "past";
    if (o - today <= 7 * 864e5) return "soon";
    return "open";
  };
  (() => {
    const raw = $("#schedData");
    if (!raw) return;
    let rows;
    try { rows = JSON.parse(raw.textContent); } catch (e) { return; }
    const d = new Date();
    const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const active = rows.filter((r) => ["open", "soon", "tba"].includes(statusOf(r, today)));
    const byOpen = (a, b) => String(a.o).localeCompare(String(b.o));
    const soonest = (list) => list.filter((r) => r.o).sort(byOpen)[0];

    const setLive = (k, v) => $$(`[data-live="${k}"]`).forEach((el) => { el.textContent = v; });
    setLive("count", active.length);
    setLive("regions", new Set(active.map((r) => r.r)).size);
    const next = soonest(active);
    if (next) setLive("next", `${next.d}(${next.w})`);

    $$("[data-live-group]").forEach((el) => {
      const n = active.filter((r) => r.g.includes(el.dataset.liveGroup)).length;
      el.hidden = n === 0;
      const b = $("[data-live-n]", el);
      if (b) b.textContent = n;
    });

    // 지역 칩의 작은 숫자
    $$("[data-live-chip]").forEach((el) => {
      const n = active.filter((r) => r.r === el.dataset.liveChip).length;
      const b = el.querySelector("small");
      if (!b) return;
      b.textContent = n || "";
      b.hidden = !n;
    });

    // 카드 아래 '모집 현황' 줄 — 과정별/지역별로 좁혀서 센다
    $$("[data-live-course], [data-live-region]").forEach((el) => {
      const txt = $(".live-txt", el);
      if (!txt) return;
      const k = el.dataset.liveCourse, reg = el.dataset.liveRegion;
      const mine = active.filter((r) => (!k || r.k === k) && (!reg || r.r === reg));
      if (!mine.length) { txt.textContent = el.dataset.liveNone || ""; return; }
      const n2 = soonest(mine);
      txt.textContent = "";
      const dot = document.createElement("i");
      dot.className = "dot";
      txt.appendChild(dot);
      txt.appendChild(document.createTextNode(`${mine.length}개 기수 모집 중${n2 ? ` · ${n2.d} 개강` : ""}`));
    });
  })();

  // ---------- 개강 일정 ----------
  // (1) 모든 목록: 접속 시점 기준으로 상태를 다시 계산하고 접수 중인 기수를 위로 올린다
  // (2) 필터가 있는 목록(홈·일정 페이지): 대상·지역으로 거르고, 처음에는 가까운 일정만 보여 준다
  const sch = (() => {
    const lists = $$(".sch-list");
    if (!lists.length) return null;
    const LABEL = { open: "접수 중", soon: "마감 임박", past: "개강 완료", done: "종료", tba: "일정 문의" };
    const d = new Date();
    const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const isActive = (r) => ["open", "soon", "tba"].includes(r.dataset.st);
    const markFirst = (list) => {
      const rows = $$(".sch-row", list);
      rows.forEach((r) => r.classList.remove("is-first"));
      const first = rows.find((r) => !r.hidden);
      if (first) first.classList.add("is-first");
    };
    lists.forEach((list) => {
      const rows = $$(".sch-row", list);
      rows.forEach((r) => {
        const o = Date.parse(r.dataset.open), c = Date.parse(r.dataset.close);
        const k = isNaN(o) ? "tba" : !isNaN(c) && c < today ? "done" : o <= today ? "past" : o - today <= 7 * 864e5 ? "soon" : "open";
        r.className = r.className.replace(/\bst-[a-z]+/g, "").trim() + " st-" + k;
        r.dataset.st = k;
        $(".st-badge", r).textContent = LABEL[k];
      });
      // 빌드 이후 개강해 버린 기수는 아래로 내린다
      rows.slice().sort((a, b) => (isActive(a) === isActive(b) ? 0 : isActive(a) ? -1 : 1)).forEach((r) => list.appendChild(r));
      // 필터가 없는 목록(과정·지역 페이지)은 지난 기수를 접어 둔다.
      // 그냥 두면 해가 갈수록 '개강 완료' 줄이 목록을 잠식한다.
      const done = rows.filter((r) => !isActive(r));
      if (list.id !== "schList" && done.length) {
        // 전부 지난 기수뿐이면 감출 것이 없다 — 접기 버튼 없이 펼친 채로 둔다
        const allDone = done.length === rows.length;
        let open = allDone;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sch-past";
        btn.hidden = allDone;
        const label = () => { btn.textContent = `이미 개강한 기수 ${done.length}개 ${open ? "접기" : "보기"}`; btn.setAttribute("aria-expanded", String(open)); };
        const render = () => { done.forEach((r) => { r.hidden = !open; }); markFirst(list); };
        btn.addEventListener("click", () => { open = !open; label(); render(); });
        label();
        render();
        const foot = document.createElement("div");
        foot.className = "sch-foot";
        foot.appendChild(btn);
        list.insertAdjacentElement("afterend", foot);
      }
      markFirst(list);
    });

    const list = $("#schList");
    const tools = $("#schTools");
    if (!list || !tools) return null;
    const rows = $$(".sch-row", list);
    const active = rows.filter(isActive);
    // 모집 현황 숫자는 위의 #schedData 블록이 이미 맞춰 놓았다
    const pills = $$(".pill[data-group]", tools);
    const select = $("#schRegion");
    const count = $("#schCount");
    const empty = $("#schEmpty");
    const more = $("#schMore");
    const past = $("#schPast");
    const narrow = window.matchMedia("(max-width: 760px)");
    // all: 모집 중인 기수를 끝까지 펼쳤는지 / past: 이미 개강한 기수까지 보는지
    const state = { group: "all", region: "all", all: false, past: false };
    // 주소의 ?group=ceo&region=seoul 로 필터를 미리 맞춘다 (과정·지역 페이지에서 넘어올 때)
    const q = new URLSearchParams(location.search);
    if (pills.some((p) => p.dataset.group === q.get("group"))) state.group = q.get("group");
    if ([...select.options].some((o) => o.value === q.get("region"))) state.region = q.get("region");
    const apply = () => {
      const limit = narrow.matches ? 5 : 8; // 처음에는 가까운 개강일 몇 개만
      let nActive = 0, nPast = 0;
      $$(".sch-row", list).forEach((r) => {
        const match = (state.group === "all" || r.dataset.groups.split(" ").includes(state.group)) && (state.region === "all" || r.dataset.region === state.region);
        const act = isActive(r);
        let show = false;
        if (match && act) { nActive++; show = state.all || nActive <= limit; }
        else if (match) { nPast++; show = state.past; }
        r.hidden = !show;
      });
      markFirst(list);
      pills.forEach((p) => {
        const on = p.dataset.group === state.group;
        p.classList.toggle("is-on", on);
        p.setAttribute("aria-checked", String(on)); // 라디오 그룹 — 하나만 켜진다
        p.tabIndex = on ? 0 : -1;                   // 그룹 전체가 탭 정지점 하나
      });
      select.value = state.region;
      const where = state.region === "all" ? "전국" : select.options[select.selectedIndex].text;
      count.innerHTML = `${where} · 모집 중 <b>${nActive}</b>개 기수`;
      list.hidden = !(nActive || (state.past && nPast));
      empty.hidden = nActive > 0;
      more.hidden = nActive <= limit;
      $("span", more).textContent = state.all ? "가까운 일정만 보기" : `모집 중인 기수 ${nActive - limit}개 더 보기`;
      more.setAttribute("aria-expanded", String(state.all));
      past.hidden = nPast === 0;
      $("b", past).textContent = nPast;
      $("i", past).textContent = state.past ? "접기" : "보기";
      past.setAttribute("aria-expanded", String(state.past));
    };
    // 필터를 바꾸면 펼침 상태는 초기화한다 — 좁은 필터에서 더보기 버튼이 사라진 사이
    // all=true가 갇혔다가 넓은 필터로 돌아갈 때 목록이 저절로 전부 펼쳐지는 것을 막는다
    const pick = (i, focus) => { state.group = pills[i].dataset.group; state.all = false; apply(); if (focus) pills[i].focus(); };
    pills.forEach((p, i) => {
      p.addEventListener("click", () => pick(i));
      p.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); pick((i + 1) % pills.length, true); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); pick((i - 1 + pills.length) % pills.length, true); }
      });
    });
    select.addEventListener("change", () => { state.region = select.value; state.all = false; apply(); });
    more.addEventListener("click", () => {
      state.all = !state.all;
      apply();
      if (!state.all) $("#schedule").scrollIntoView({ block: "start" }); // 접으면 목록이 짧아지므로 일정표 처음으로
    });
    past.addEventListener("click", () => { state.past = !state.past; apply(); });
    apply();
    // 구형 엔진은 MediaQueryList.addEventListener가 없다 — 여기서 던지면 아래 코드가 통째로 죽는다
    if (narrow.addEventListener) narrow.addEventListener("change", apply);
    else if (narrow.addListener) narrow.addListener(apply);
    return { set: (patch) => { Object.assign(state, patch); apply(); } };
  })();

  // 상담 신청 팝업 — #consult 링크는 페이지 어디에나 있어서 한곳에서 받는다
  const consultDlg = (() => {
    const dlg = $("#consult");
    if (!dlg) return null;
    const open = () => {
      if (dlg.open) return;
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
      dlg.scrollTop = 0;
      // 이미 보낸 뒤 다시 열면 완료 문구만 보이므로 닫기 버튼에 초점을 둔다
      const first = $(".form-grid input, .form-grid select", dlg);
      (first && !first.closest("[hidden]") ? first : $(".dlg-x", dlg)).focus();
    };
    const close = () => { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); };
    dlg.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { close(); return; }
      if (e.target !== dlg) return; // 판 안쪽 여백을 눌렀을 때는 닫지 않는다
      const b = dlg.getBoundingClientRect();
      if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) close();
    });
    if (location.hash === "#consult") open(); // 주소를 그대로 공유한 경우
    return { open, close };
  })();

  // 교육 대상 블록 → 일정표를 그 조건으로 맞춰 놓고 이동 / 상담 폼에 과정·지역 미리 채우기
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    if (sch && a.dataset.filter) sch.set({ group: a.dataset.filter, region: "all", all: false });
    const form = $("#consultForm");
    if (form && (a.dataset.presetCourse || a.dataset.presetRegion)) {
      const pick = (name, v) => { const s = form.elements[name]; if (s && v && [...s.options].some((o) => o.value === v)) s.value = v; };
      pick("관심과정", a.dataset.presetCourse);
      pick("지역", a.dataset.presetRegion);
    }
    if (consultDlg && a.getAttribute("href") === "#consult") { e.preventDefault(); consultDlg.open(); }
  });

  // ---------- 흐르는 띠 멈춤 ----------
  (() => {
    const wrap = $(".mq-wrap");
    if (!wrap || reduce) return; // 움직임 줄이기 설정이면 CSS가 이미 멈춰 둔다
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mq-stop";
    let stopped = false;
    btn.textContent = "문구 흐름 멈추기"; // 이름 고정, 눌림 여부는 aria-pressed로
    const label = () => btn.setAttribute("aria-pressed", String(stopped));
    btn.addEventListener("click", () => { stopped = !stopped; wrap.classList.toggle("is-stopped", stopped); label(); });
    label();
    wrap.insertAdjacentElement("afterend", btn);
  })();

  // ---------- 수강료 포함 항목 ----------
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".fee-note");
    if (!b) return;
    e.preventDefault();
    alert(b.dataset.note);
  });

  // ---------- 추천의 글 가로 넘기기 ----------
  $$("[data-scroll]").forEach((btn) => btn.addEventListener("click", () => {
    const track = $(btn.dataset.scroll);
    const card = track.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 20 : 400;
    track.scrollBy({ left: step * +btn.dataset.dir, behavior: reduce ? "auto" : "smooth" });
  }));

  // ---------- 수강 후기 전문 팝업 (홈) ----------
  (() => {
    const dlg = $("#rvDialog");
    const raw = $("#rvData");
    if (!dlg || !raw) return;
    const data = JSON.parse(raw.textContent);
    const close = () => { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); };
    $$(".rv").forEach((btn) => btn.addEventListener("click", () => {
      const r = data[+btn.dataset.review];
      $("#rvT").textContent = r.t;
      $("#rvA").textContent = r.a;
      const box = $("#rvP");
      box.textContent = "";
      r.p.forEach((t) => { const p = document.createElement("p"); p.textContent = t; box.appendChild(p); });
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
      dlg.scrollTop = 0;
      $(".dlg-x", dlg).focus();
    }));
    // 바깥 클릭으로 닫기 — e.target === dlg만 보면 dialog의 안쪽 여백(패딩)을 눌러도 닫힌다.
    // 실제로 판 바깥을 눌렀는지 좌표로 확인한다
    dlg.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { close(); return; }
      if (e.target !== dlg) return;
      const b = dlg.getBoundingClientRect();
      const outside = e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom;
      if (outside) close();
    });
  })();

  // ---------- FAQ 탭(홈) · 같은 묶음 안에서는 하나만 열리는 아코디언 ----------
  (() => {
    const tabs = $$('[role="tab"]');
    const select = (i, focus) => tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute("aria-selected", String(on));
      t.classList.toggle("is-on", on);
      t.tabIndex = on ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).hidden = !on;
      if (on && focus) t.focus();
    });
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); select((i + 1) % tabs.length, true); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
      });
    });
    // 하나만 열리게 강제하지 않는다 — 두 답변을 나란히 비교하려는 사람을 막을 이유가 없다
  })();

  // ---------- 상담 신청 폼 (첫 사이트와 같은 접수 방식: GAS에 GET으로 전달) ----------
  (() => {
    const form = $("#consultForm");
    if (!form) return;
    const EP = window.__FORM_ENDPOINT__ || "";
    const isLocal = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname); // 미리보기에서는 실제 접수로 보내지 않는다
    // 기본 체크 + 해제하면 안내 후 되돌리기 — 전 사이트 공통 규칙(2026-09-18 사용자 지정).
    // "기본 체크는 동의로 인정받기 어렵다"는 지적이 있었지만 사용자가 이 방식을 택했다.
    // 되돌리려면 여기와 build.js 의 checked 만 빼면 된다(문구·details 구조는 그대로).
    const agree = $("#agree");
    if (agree) agree.addEventListener("change", () => {
      if (agree.checked) return;
      alert("체크를 해제하시면 상담 신청이 어렵습니다.");
      agree.checked = true;
      agree.classList.remove("is-bad");
      agree.removeAttribute("aria-invalid");
    });
    const normTel = (p, v) => {
      v = String(v || "").replace(/\D/g, "");
      return v.length === 11 ? `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7)}`
        : v.length === 10 ? `${v.slice(0, 3)}-${v.slice(3, 6)}-${v.slice(6)}`
        : v.length === 8 ? `${p}-${v.slice(0, 4)}-${v.slice(4)}`
        : v.length === 7 ? `${p}-${v.slice(0, 3)}-${v.slice(3)}`
        : `${p}-${v}`;
    };
    // role="alert"는 내용이 바뀔 때 읽힌다. 미리 넣어 두고 hidden만 풀면 읽히지 않을 수 있다
    const box = $("#consultFail");
    const showError = (msg, withTel) => {
      if (!box) { alert(msg); return; }
      box.textContent = msg + " ";
      if (withTel && box.dataset.tel) {
        const a = document.createElement("a");
        a.href = "tel:" + box.dataset.tel;
        a.textContent = box.dataset.telLabel;
        box.appendChild(a);
      }
      box.hidden = false;
      // 팝업 안에서는 이 문구가 스크롤 밖에 있을 수 있다 — 접수가 안 됐는데 못 보고 넘어가면 안 된다
      if (box.scrollIntoView) box.scrollIntoView({ block: "nearest" });
    };
    form.addEventListener("input", (e) => { e.target.classList.remove("is-bad"); e.target.removeAttribute("aria-invalid"); });
    form.addEventListener("change", (e) => { e.target.classList.remove("is-bad"); e.target.removeAttribute("aria-invalid"); });
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = new FormData(form);
      const get = (k) => String(f.get(k) || "").trim();
      const bad = ["이름", "연락처", "소속", "관심과정", "지역"].filter((k) => !get(k));
      $$(".is-bad", form).forEach((el) => el.classList.remove("is-bad"));
      $$("[aria-invalid]", form).forEach((el) => el.removeAttribute("aria-invalid"));
      if (bad.length) {
        bad.forEach((k) => { const el = form.elements[k]; el.classList.add("is-bad"); el.setAttribute("aria-invalid", "true"); });
        showError(`${bad.join(", ")} 항목을 채워 주세요.`);
        form.elements[bad[0]].focus();
        return;
      }
      if (!agree.checked) {
        agree.classList.add("is-bad");
        agree.setAttribute("aria-invalid", "true");
        showError("개인정보 수집·이용에 동의하셔야 상담 신청을 보낼 수 있습니다. 전화 상담은 동의 없이도 이용하실 수 있습니다.");
        agree.focus();
        return;
      }
      const org = get("소속"), rank = get("직급");
      const btn = $(".form-submit", form);
      btn.disabled = true;
      btn.firstChild.textContent = "접수 중...";
      const data = {
        "이름": get("이름"), "연락처": normTel(get("연락처앞") || "010", get("연락처")), "소속": org, "직급": rank,
        "소속직급": org + (rank ? " " + rank : ""), // 구버전 GAS 호환
        "관심과정": get("관심과정"), "지역": get("지역"), "문의내용": get("문의내용"),
        "신청일": new Date().toLocaleString("ko-KR"),
        "유입페이지": location.href, "유입페이지제목": document.title,
        "유입경로": document.referrer || "직접입력",
      };
      const qs = Object.keys(data).map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(data[k])).join("&");
      const showDone = () => {
        if (box) box.hidden = true;
        $$(".form-grid, .agree, .agree-more, .form-submit, .form-fine", form).forEach((el) => { el.hidden = true; });
        const done = $("#consultDone");
        done.hidden = false;
        done.focus();
      };
      const showFail = () => {
        btn.disabled = false;
        btn.firstChild.textContent = "상담 신청하기";
        showError(box && box.dataset.msg ? box.dataset.msg : "접수가 전달되지 않았습니다.", true);
      };
      if (!EP || isLocal) { // 미리보기·엔드포인트 미설정 — 실제로 보내지 않는다
        console.warn("상담 폼 데모 모드 — 시트에 기록하지 않습니다.", data);
        setTimeout(showDone, 500);
        return;
      }
      // GAS 웹앱은 CORS 헤더를 주지 않아 응답 내용을 읽을 수는 없다.
      // 다만 no-cors fetch는 서버에 닿으면 opaque 응답으로 resolve하고, 닿지 못하면 reject하므로
      // '전달됐는지'까지는 구분할 수 있다 (이미지 요청은 이 둘을 구분하지 못한다)
      let settled = false;
      const finish = (ok) => { if (settled) return; settled = true; ok ? showDone() : showFail(); };
      const timer = setTimeout(() => finish(false), 10000);
      const done = (ok) => { clearTimeout(timer); finish(ok); };
      if (window.fetch) {
        // no-cors 응답은 opaque라 상태 코드를 읽을 수 없다. 네트워크 실패와 시간 초과까지만 잡히고
        // 엔드포인트가 404·500을 돌려주는 경우는 구분되지 않는다 (GAS가 CORS 헤더를 주지 않는 한계)
        fetch(EP + "?" + qs, { mode: "no-cors", cache: "no-store" }).then(() => done(true), () => done(false));
      } else { // 아주 오래된 브라우저 — 구분은 못 해도 접수는 보낸다
        const img = new Image();
        img.onload = img.onerror = () => done(true);
        img.src = EP + "?" + qs;
      }
    });
    // 상담 영역이 보이는 동안에는 따라다니는 '상담 신청' 버튼을 숨긴다
    const cta = $(".float-cta");
    const consult = $("#consult");
    if (cta && consult && hasIO) new IntersectionObserver((en) => cta.classList.toggle("is-off", en[0].isIntersecting), { threshold: 0.12 }).observe(consult);
  })();
})();
