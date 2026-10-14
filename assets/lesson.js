(function () {
  var A = window.MathApp || {};

  /* ================= 手写（iPad / Apple Pencil 兼容） =================
     整笔用 window 级 pointermove/up 跟踪（不用 setPointerCapture、不在 pointer 里 preventDefault、
     不用 pointerleave 断笔）；逐段增量绘制；保存防抖；书写期禁选中防系统菜单。 */
  var HW_SAVE_T = null, HWDATA = null, HW_ONCE = false, HW_RO = null, HW_IO = null, HW_CVS = [], HW_PEN_T = 0, HW_THEME_OBS = null;
  function hwSetWriting(on) { window.__hwWriting = !!on; try { document.documentElement.classList.toggle("hw-writing", !!on); } catch (e) { } }
  function hwLoad() { if (!HWDATA) { try { HWDATA = A.jget("hw", {}) || {}; } catch (e) { HWDATA = {}; } } return HWDATA; }
  function hwPersist() { try { A.jset("hw", hwLoad()); } catch (e) { try { if (window.__hwQuotaWarn !== 1) { window.__hwQuotaWarn = 1; alert("本机存储已满：手写可能无法保存。请用「\ud83d\udcbe \u5907\u4efd」导出后清理，或换设备。"); } } catch (x) { } } }
  function hwInk() { try { if (document.documentElement.getAttribute("data-theme") === "dark") return "#e8eef6"; } catch (e) { } return "#1a2b45"; }
  function hwRedrawAll() { for (var i = 0; i < HW_CVS.length; i++) { var c = HW_CVS[i]; if (c && c._redraw && c.isConnected && c.offsetWidth) c._redraw(); } }
  function hwObserveTheme() { if (HW_THEME_OBS || !window.MutationObserver) return; HW_THEME_OBS = new MutationObserver(function () { hwRedrawAll(); }); try { HW_THEME_OBS.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) { } }
  function hwRegister(c) { if (HW_CVS.indexOf(c) < 0) HW_CVS.push(c); hwObserveTheme(); if (!HW_RO && window.ResizeObserver) { HW_RO = new ResizeObserver(function (es) { es.forEach(function (en) { var x = en.target; if (x._redraw && x.offsetWidth) x._redraw(); }); }); } try { if (HW_RO) HW_RO.observe(c); } catch (e) { } }
  function hwPenRecent() { return Date.now() - HW_PEN_T < 5000; }
  document.addEventListener("pointerdown", function (e) { if (e.pointerType === "pen") HW_PEN_T = Date.now(); }, true);
  function hwCSS() {
    if (document.getElementById("hwSetCSS")) return;
    var s = document.createElement("style"); s.id = "hwSetCSS";
    s.textContent =
      'html.hw-writing{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}'
      + '.hwbox{margin-top:8px}'
      + '.hwbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 6px}'
      + '.hwbar .lbl{font-size:12.5px;color:var(--sub)}'
      + '.hwbar button{border:1px solid var(--line);background:var(--card);color:var(--acc);border-radius:14px;padding:3px 12px;font-size:12.5px;cursor:pointer}'
      + '.hwbar button.on{background:#c0392b;color:#fff;border-color:#c0392b}'
      + 'canvas.hw{display:block;width:100%;height:150px;border:1.5px dashed #b9c6d2;border-radius:8px;background:#fffdf7;touch-action:none}'
      + 'canvas.hw.tall{height:240px}'
      + 'html[data-theme="dark"] canvas.hw{background:#1c2229;border-color:#3a4756}'
      + 'html[data-theme="sepia"] canvas.hw{background:#fbf5e6;border-color:#cdbb95}'
      + '.hwfab{position:fixed;right:12px;z-index:9995;background:var(--acc);color:#fff;border:none;border-radius:22px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.28)}'
      + '#hwScratch{bottom:72px}#hwBackup{bottom:116px}'
      + '#hwPad,#hwBak{position:fixed;inset:0;z-index:9996;display:none;align-items:center;justify-content:center;background:rgba(15,22,35,.55);padding:16px}'
      + '#hwPad .card,#hwBak .card{background:#fff;border-radius:14px;max-width:960px;width:100%;max-height:92vh;overflow:auto;padding:14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.35)}'
      + '#hwPad .hd,#hwBak .hd{display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap}'
      + '#hwBak textarea{width:100%;height:160px;font:12px/1.5 ui-monospace,monospace;border:1px solid var(--line);border-radius:8px;padding:8px;box-sizing:border-box;background:var(--card);color:var(--fg)}'
      + 'html[data-theme="dark"] #hwPad .card,html[data-theme="dark"] #hwBak .card{background:#151b24;color:#e6e9ef}'
      + 'html[data-theme="dark"] #hwPad .card b,html[data-theme="dark"] #hwBak .card b{color:#9fc3ff}'
      + '@media print{.hwfab,.hwbar,#hwPad,#hwBak{display:none!important}}';
    document.head.appendChild(s);
  }
  var HW = {
    get: function (key) { return hwLoad()[key] || []; },
    set: function (key, strokes) { var d = hwLoad(); d[key] = strokes; hwPersist(); },
    undo: function (key) { var d = hwLoad(), arr = d[key] || []; arr.pop(); d[key] = arr; hwPersist(); },
    attach: function (canvas, key) {
      var self = this;
      canvas.dataset.key = key;
      var ctx = null, dpr = 1, RW = 0, RH = 0, rect = null, act = null;
      function ensure() {
        dpr = window.devicePixelRatio || 1;
        var r = canvas.getBoundingClientRect();
        if (!r.width) return false;
        RW = r.width; RH = r.height;
        var w = Math.max(1, Math.round(RW * dpr)), h = Math.max(1, Math.round(RH * dpr));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return true;
      }
      function drawStrokes() {
        if (!ensure()) return;
        var col = hwInk();
        ctx.clearRect(0, 0, RW, RH);
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
        self.get(key).forEach(function (st) {
          if (!st || !st.length) return;
          if (st.length === 1) { ctx.beginPath(); ctx.arc(st[0][0] * RW, st[0][1] * RH, 1.6, 0, 7); ctx.fill(); return; }
          ctx.beginPath();
          st.forEach(function (p, i) { var x = p[0] * RW, y = p[1] * RH; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
          ctx.stroke();
        });
      }
      function seg(a, b) { if (!ctx) return; ctx.strokeStyle = hwInk(); ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(a[0] * RW, a[1] * RH); ctx.lineTo(b[0] * RW, b[1] * RH); ctx.stroke(); }
      function dotOn(p) { if (!ctx) return; ctx.fillStyle = hwInk(); ctx.beginPath(); ctx.arc(p[0] * RW, p[1] * RH, 1.6, 0, 7); ctx.fill(); }
      function pos(e) { var p = (e.touches && e.touches[0]) || e; return [(p.clientX - rect.left) / rect.width, (p.clientY - rect.top) / rect.height]; }
      function eraserOn() { return canvas.dataset.eraser === "1"; }
      function eraseAt(p) {
        var d = hwLoad();
        d[key] = self.get(key).filter(function (st) { return !st.some(function (q) { return Math.abs(q[0] - p[0]) < 0.03 && Math.abs(q[1] - p[1]) < 0.05; }); });
        hwPersist();
      }
      function scheduleSave() { if (HW_SAVE_T) clearTimeout(HW_SAVE_T); HW_SAVE_T = setTimeout(function () { HW_SAVE_T = null; hwPersist(); }, 400); }
      function down(e) {
        if (e.pointerType === "touch" && hwPenRecent()) return;
        if (!ensure()) return;
        rect = canvas.getBoundingClientRect();
        hwSetWriting(true);
        act = { pid: (e.pointerId != null ? e.pointerId : null), cur: null };
        var p = pos(e);
        if (eraserOn()) { eraseAt(p); drawStrokes(); return; }
        var cur = [p], d = hwLoad(), arr = (d[key] || []).slice(); arr.push(cur); d[key] = arr; hwPersist(); act.cur = cur; dotOn(p);
        window.addEventListener("pointermove", move, true);
        window.addEventListener("pointerup", end, true);
        window.addEventListener("pointercancel", end, true);
      }
      function move(e) {
        if (!act) return;
        if (act.pid != null && e.pointerId != null && e.pointerId !== act.pid) return;
        var evs = [e]; try { if (e.getCoalescedEvents) { var ce = e.getCoalescedEvents(); if (ce && ce.length) evs = ce; } } catch (x) { }
        for (var i = 0; i < evs.length; i++) {
          var p = pos(evs[i]);
          if (eraserOn()) { eraseAt(p); drawStrokes(); continue; }
          if (act.cur && act.cur.length) { seg(act.cur[act.cur.length - 1], p); act.cur.push(p); }
        }
      }
      function end(e) {
        if (!act) return;
        if (act.pid != null && e && e.pointerId != null && e.pointerId !== act.pid) return;
        act = null;
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", end, true);
        window.removeEventListener("pointercancel", end, true);
        hwSetWriting(false);
        scheduleSave();
      }
      function setup() {
        canvas.addEventListener("pointerdown", down);
        canvas.addEventListener("touchstart", function (e) { try { e.preventDefault(); } catch (x) { } }, { passive: false });
        canvas.addEventListener("touchmove", function (e) { if (act) { try { e.preventDefault(); } catch (x) { } } }, { passive: false });
        canvas._redraw = drawStrokes;
        hwRegister(canvas);
        drawStrokes();
      }
      if ("IntersectionObserver" in window) {
        if (!HW_IO) {
          HW_IO = new IntersectionObserver(function (es) {
            es.forEach(function (en) { if (en.isIntersecting) { HW_IO.unobserve(en.target); var f = en.target.__hwSetup; if (f) { en.target.__hwSetup = null; f(); } } });
          }, { rootMargin: "500px 0px" });
        }
        canvas.__hwSetup = setup; HW_IO.observe(canvas);
      } else setup();
    }
  };
  document.addEventListener("contextmenu", function (e) { if (window.__hwWriting) { try { e.preventDefault(); } catch (x) { } } }, true);
  document.addEventListener("selectstart", function (e) { if (window.__hwWriting) { try { e.preventDefault(); } catch (x) { } } }, true);
  window.addEventListener("pagehide", function () { if (HW_SAVE_T) { clearTimeout(HW_SAVE_T); HW_SAVE_T = null; } hwPersist(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden && HW_SAVE_T) { clearTimeout(HW_SAVE_T); HW_SAVE_T = null; hwPersist(); } });
  function hwBox(key, tall) {
    var box = A.el("div", "hwbox");
    var bar = A.el("div", "hwbar");
    bar.appendChild(A.el("span", "lbl", "\u270d\ufe0f \u624b\u5199\u89e3\u7b54/\u6f14\u7b97\uff08\u89e6\u63a7\u7b14/\u624b\u6307\uff09"));
    var bEr = A.el("button", null, "\u6a61\u76ae\uff1a\u5173"), bUn = A.el("button", null, "\u64a4\u9500"), bCl = A.el("button", null, "\u6e05\u7a7a");
    bar.appendChild(bEr); bar.appendChild(bUn); bar.appendChild(bCl);
    var cv = A.el("canvas", "hw" + (tall ? " tall" : ""));
    box.appendChild(bar); box.appendChild(cv);
    bEr.onclick = function () { var on = cv.dataset.eraser === "1"; cv.dataset.eraser = on ? "0" : "1"; bEr.textContent = "\u6a61\u76ae\uff1a" + (on ? "\u5173" : "\u5f00"); bEr.classList.toggle("on", !on); };
    bUn.onclick = function () { HW.undo(key); if (cv._redraw) cv._redraw(); };
    bCl.onclick = function () { if (confirm("\u6e05\u7a7a\u6b64\u5904\u624b\u5199\uff1f")) { HW.set(key, []); if (cv._redraw) cv._redraw(); } };
    setTimeout(function () { HW.attach(cv, key); }, 0);
    return box;
  }
  var BAK_KEYS = ["srs", "prob", "quiz", "marks", "hw"];
  function importTxt(txt) {
    var o = JSON.parse(txt), data = (o && o.data) ? o.data : o;
    BAK_KEYS.forEach(function (n) { if (data && typeof data[n] !== "undefined" && data[n] !== null) A.jset(n, data[n]); });
    if (typeof data.hw !== "undefined") HWDATA = data.hw;
    alert("导入成功，即将刷新。"); location.reload();
  }
  function openBackup() {
    var m = document.getElementById("hwBak");
    if (!m) {
      m = A.el("div"); m.id = "hwBak";
      m.innerHTML = '<div class="card"><div class="hd"><b>💾 备份 / 恢复（含作答·错题·手写）</b></div>'
        + '<div class="hd"><button class="navbtn" id="hwBakExp">导出为文件</button>'
        + '<label class="navbtn" style="cursor:pointer">导入文件<input type="file" id="hwBakFile" accept="application/json" style="display:none"></label>'
        + '<span style="flex:1"></span><button class="navbtn" id="hwBakClose">关闭</button></div>'
        + '<p style="font-size:12.5px;color:var(--sub)">导出后可在别的设备/浏览器导入恢复；数据仅存本机。</p>'
        + '<textarea id="hwBakTxt" spellcheck="false"></textarea></div>';
      document.body.appendChild(m);
      m.addEventListener("click", function (e) { if (e.target === m) m.style.display = "none"; });
      m.querySelector("#hwBakClose").onclick = function () { m.style.display = "none"; };
      m.querySelector("#hwBakExp").onclick = function () {
        var out = {}; BAK_KEYS.forEach(function (n) { out[n] = A.jget(n, null); });
        var txt = JSON.stringify({ v: 1, t: Date.now(), data: out }, null, 1);
        try {
          var blob = new Blob([txt], { type: "application/json" });
          var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = "backup-" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        } catch (e) { }
        m.querySelector("#hwBakTxt").value = txt;
      };
      m.querySelector("#hwBakFile").onchange = function () {
        var f = this.files && this.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () { try { importTxt(rd.result); } catch (e) { alert("导入失败：" + e.message); } };
        rd.readAsText(f);
      };
      m.querySelector("#hwBakTxt").addEventListener("change", function () { try { importTxt(this.value); } catch (e) { alert("导入失败：" + e.message); } });
    }
    m.style.display = "flex";
  }
  function initHW(cid) {
    if (HW_ONCE) return; HW_ONCE = true;
    hwCSS();
    var scr = A.el("button", "hwfab", "🧻 草稿纸"); scr.id = "hwScratch"; scr.type = "button"; document.body.appendChild(scr);
    var bak = A.el("button", "hwfab", "💾 备份"); bak.id = "hwBackup"; bak.type = "button"; document.body.appendChild(bak);
    scr.onclick = function () {
      var pad = document.getElementById("hwPad");
      if (!pad) {
        pad = A.el("div"); pad.id = "hwPad";
        pad.innerHTML = '<div class="card"><div class="hd"><b>🧻 草稿纸</b></div><div id="hwPadBody"></div>'
          + '<div class="hd" style="justify-content:flex-end"><button class="navbtn" id="hwPadClose">关闭</button></div></div>';
        document.body.appendChild(pad);
        pad.addEventListener("click", function (e) { if (e.target === pad) pad.style.display = "none"; });
        pad.querySelector("#hwPadClose").onclick = function () { pad.style.display = "none"; };
        pad.querySelector("#hwPadBody").appendChild(hwBox("scratch:" + cid, true));
      }
      pad.style.display = "flex";
      requestAnimationFrame(function () { var cv = pad.querySelector("canvas.hw"); if (cv && cv._redraw) cv._redraw(); });
    };
    bak.onclick = function () { openBackup(); };
    document.addEventListener("contextmenu", function (e) { if (window.__hwWriting) { try { e.preventDefault(); } catch (x) { } } }, true);
    document.addEventListener("selectstart", function (e) { if (window.__hwWriting) { try { e.preventDefault(); } catch (x) { } } }, true);
    window.addEventListener("pagehide", function () { if (HW_SAVE_T) { clearTimeout(HW_SAVE_T); HW_SAVE_T = null; } hwPersist(); });
    document.addEventListener("visibilitychange", function () { if (document.hidden && HW_SAVE_T) { clearTimeout(HW_SAVE_T); HW_SAVE_T = null; hwPersist(); } });
  }

  /* ---------- 原书裁图（按章·页） ---------- */
  var FIG = {
    gs01: {20: ["assets/img/figs/gaoshu/gs01-p20-1.jpg"], 31: ["assets/img/figs/gaoshu/gs01-p31-1.jpg"]},
    gs02: {50: ["assets/img/figs/gaoshu/gs02-p50-1.jpg", "assets/img/figs/gaoshu/gs02-p50-2.jpg"], 56: ["assets/img/figs/gaoshu/gs02-p56-1.jpg"], 71: ["assets/img/figs/gaoshu/gs02-p71-1.jpg"]},
    gs03: {98: ["assets/img/figs/gaoshu/gs03-p98-1.jpg"], 105: ["assets/img/figs/gaoshu/gs03-p105-1.jpg", "assets/img/figs/gaoshu/gs03-p105-2.jpg"], 113: ["assets/img/figs/gaoshu/gs03-p113-1.jpg"], 114: ["assets/img/figs/gaoshu/gs03-p114-1.jpg", "assets/img/figs/gaoshu/gs03-p114-2.jpg", "assets/img/figs/gaoshu/gs03-p114-3.jpg", "assets/img/figs/gaoshu/gs03-p114-4.jpg"], 115: ["assets/img/figs/gaoshu/gs03-p115-1.jpg"], 116: ["assets/img/figs/gaoshu/gs03-p116-1.jpg", "assets/img/figs/gaoshu/gs03-p116-2.jpg", "assets/img/figs/gaoshu/gs03-p116-3.jpg"], 117: ["assets/img/figs/gaoshu/gs03-p117-1.jpg", "assets/img/figs/gaoshu/gs03-p117-2.jpg"]},
    gs04: {137: ["assets/img/figs/gaoshu/gs04-p137-1.jpg"]},
    gs05: {145: ["assets/img/figs/gaoshu/gs05-p145-1.jpg", "assets/img/figs/gaoshu/gs05-p145-2.jpg"], 149: ["assets/img/figs/gaoshu/gs05-p149-1.jpg"], 154: ["assets/img/figs/gaoshu/gs05-p154-1.jpg"], 155: ["assets/img/figs/gaoshu/gs05-p155-1.jpg"], 167: ["assets/img/figs/gaoshu/gs05-p167-1.jpg"]},
    gs06: {175: ["assets/img/figs/gaoshu/gs06-p175-1.jpg", "assets/img/figs/gaoshu/gs06-p175-2.jpg", "assets/img/figs/gaoshu/gs06-p175-3.jpg"], 176: ["assets/img/figs/gaoshu/gs06-p176-1.jpg", "assets/img/figs/gaoshu/gs06-p176-2.jpg"], 177: ["assets/img/figs/gaoshu/gs06-p177-1.jpg", "assets/img/figs/gaoshu/gs06-p177-2.jpg", "assets/img/figs/gaoshu/gs06-p177-3.jpg"], 178: ["assets/img/figs/gaoshu/gs06-p178-1.jpg", "assets/img/figs/gaoshu/gs06-p178-2.jpg"], 179: ["assets/img/figs/gaoshu/gs06-p179-1.jpg"], 180: ["assets/img/figs/gaoshu/gs06-p180-1.jpg", "assets/img/figs/gaoshu/gs06-p180-2.jpg", "assets/img/figs/gaoshu/gs06-p180-3.jpg"], 181: ["assets/img/figs/gaoshu/gs06-p181-1.jpg", "assets/img/figs/gaoshu/gs06-p181-2.jpg", "assets/img/figs/gaoshu/gs06-p181-3.jpg"], 182: ["assets/img/figs/gaoshu/gs06-p182-1.jpg", "assets/img/figs/gaoshu/gs06-p182-2.jpg", "assets/img/figs/gaoshu/gs06-p182-3.jpg", "assets/img/figs/gaoshu/gs06-p182-4.jpg", "assets/img/figs/gaoshu/gs06-p182-5.jpg"], 183: ["assets/img/figs/gaoshu/gs06-p183-1.jpg", "assets/img/figs/gaoshu/gs06-p183-2.jpg"], 184: ["assets/img/figs/gaoshu/gs06-p184-1.jpg"]},
    la01: {10: ["assets/img/figs/xiandai/la01-p10-1.jpg"]}
  };

  /* ---------- 轻量 Markdown 渲染（保留 $..$ / $$..$$ 数学，正文做 HTML 转义） ---------- */
  function inline(s) {
    return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }
  function parseChoice(p) {
    var L = "ABCDE";
    var m = p.a && /^\(([A-E]+)\)$/.exec(String(p.a).trim());
    if (!m || !p.q) return null;
    var q = p.q, found = [], i;
    for (i = 0; i < L.length; i++) { var k = q.indexOf("(" + L[i] + ")"); if (k >= 0) found.push({ i: i, k: k }); }
    if (found.length < 4 || found.length > 5) return null;
    for (i = 0; i < found.length; i++) { if (found[i].i !== i) return null; if (i && found[i].k < found[i - 1].k) return null; }
    var n = found.length;
    var stem = q.slice(0, found[0].k).trim(), opts = [];
    for (i = 0; i < n; i++) {
      var end = i < n - 1 ? found[i + 1].k : q.length;
      opts.push(q.slice(found[i].k + 3, end).replace(/^[、:：\s]+/, "").replace(/[\s　]+$/, ""));
    }
    var ans = m[1].split("").map(function (ch) { return ch.charCodeAt(0) - 65; }).sort(function (a, b) { return a - b; });
    return { stem: stem, options: opts, answers: ans, answer: ans[0], multi: ans.length > 1 };
  }
  function renderMarkdown(md) {
    var lines = String(md).replace(/\r/g, "").split("\n").map(function (ln) {
      if (/^\s*【(分析|解|证|评注|说明|证明|答案|注|解法|证法)/.test(ln)) return ln;
      var reOpt = /(?<![A-Za-z0-9_$])[（(]\s*([A-D])\s*[）)]/g, m, seen = {}, ok = true;
      while ((m = reOpt.exec(ln))) {
        seen[m[1]] = 1;
        if (/[、，。；：,;]/.test(ln.charAt(m.index + m[0].length))) ok = false;
      }
      if (!ok || Object.keys(seen).length < 4) return ln;
      return ln.replace(/(?<![A-Za-z0-9_$])\s*([（(]\s*[A-D]\s*[）)])/g, "\n$1").split("\n").map(function (x) { return x.trim(); }).filter(function (x) { return x; }).join("\n");
    }).join("\n").split("\n");
    var html = [], para = [], list = null, listType = "ul", listStart = 1, quote = [], math = null, ex = null;
    function ih(text) { return inline(A.esc(text)).replace(/\n/g, "<br>"); }
    function closeEx() {
      if (!ex) return;
      if (ex.a) html.push("</div>");
      if (ex.q) html.push("</div>");
      html.push("</div>"); ex = null;
    }
    function fp() {
      if (!para.length) return;
      var text = para.join("\n"); para = [];
      if (/^【例/.test(text)) {
        closeEx();
        html.push('<div class="ex"><div class="ex-q">' + ih(text));
        ex = { q: true, a: false };
        return;
      }
      if (/^【解|^【证|^【分析/.test(text)) {
        if (!ex) { html.push('<div class="ex">'); ex = { q: false, a: false }; }
        if (ex.q) { html.push("</div>"); ex.q = false; }
        if (ex.a) html.push('<hr class="exhr">');
        else { html.push('<div class="ex-a">'); ex.a = true; }
        html.push('<p class="solp">' + ih(text) + "</p>");
        return;
      }
      html.push("<p>" + ih(text) + "</p>");
    }
    function fl() {
      if (!list) return;
      var open = "<" + listType + (listType === "ol" ? ' start="' + listStart + '"' : "") + ">";
      html.push(open + list.map(function (x) { return "<li>" + ih(x) + "</li>"; }).join("") + "</" + listType + ">");
      list = null;
    }
    function fq() {
      if (!quote.length) return;
      html.push('<div class="notes">' + quote.map(ih).join("<br>") + "</div>"); quote = [];
    }
    function fa() { fp(); fl(); fq(); }
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      if (math !== null) {
        var ci = t.indexOf("$$");
        if (ci >= 0) {
          math.push(t.slice(0, ci));
          html.push('<div class="fml">$$' + A.esc(math.join("\n")) + "$$</div>");
          math = null;
          var rest = t.slice(ci + 2).trim();
          if (rest) para.push(rest);
        } else math.push(t);
        continue;
      }
      if (t === "" || /^-{3,}$/.test(t) || /^[·•*]\s*\d+\s*[·•*]?$/.test(t)) { fa(); continue; }
      var img = /^!\[(.*)\]\(([^)\s]+)\)\s*$/.exec(t);
      if (img) { fa(); html.push('<figure class="fig"><img loading="lazy" src="' + img[2] + '" alt="' + A.esc(img[1]) + '">' + (img[1] ? '<figcaption>' + A.esc(img[1]) + '</figcaption>' : '') + '</figure>'); continue; }
      if (/^\$\$/.test(t)) {
        fa();
        var r0 = t.slice(2), c0 = r0.indexOf("$$");
        if (c0 >= 0) {
          html.push('<div class="fml">$$' + A.esc(r0.slice(0, c0)) + "$$</div>");
          var after = r0.slice(c0 + 2).trim(); if (after) para.push(after);
        } else math = [r0];
        continue;
      }
      var h = /^(#{1,6})\s+(.*)$/.exec(t);
      if (h) {
        fa(); closeEx();
        var lv = h[1].length, tag = lv <= 2 ? "h3" : (lv === 3 ? "h4" : "h5");
        var cls = lv <= 2 ? "lh" : (lv === 3 ? "lh2" : "lh3");
        if (/^题型/.test(h[2])) cls += " tixing";
        html.push("<" + tag + ' class="' + cls + '">' + ih(h[2]) + "</" + tag + ">");
        continue;
      }
      if (/^【注】/.test(t)) { fa(); quote.push(t); continue; }
      if (/^>\s?/.test(t)) { fp(); fl(); quote.push(t.replace(/^>\s?/, "")); continue; }
      var ol = /^(\d+)[.)]\s+(.*)$/.exec(t);
      if (ol) {
        fp(); fq();
        if (!list) { list = []; listType = "ol"; listStart = parseInt(ol[1], 10); }
        list.push(ol[2]);
        continue;
      }
      var ul = /^[-•]\s+(.*)$/.exec(t);
      if (ul) {
        fp(); fq();
        if (!list) { list = []; listType = "ul"; }
        list.push(ul[1]);
        continue;
      }
      if (para.length && /^【(例|分析|解|证|评注|说明|答案|证明|解法|证法|注)|^[（(]\s*[A-D]\s*[）)]/.test(t)) fp();
      fl(); fq(); para.push(t);
    }
    fa(); closeEx();
    if (math !== null) html.push('<div class="fml">$$' + A.esc(math.join("\n")) + "$$</div>");
    return html.join("\n");
  }

  function typeset(nodes) { if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise(nodes); }

  function lessonHtml(L) {
    var html = "";
    if (!L.problems && (window.LECTURE_DRILL || {})[L.id]) {
      L.problems = window.LECTURE_DRILL[L.id];
      L.probTitle = L.probTitle || "本节真题自测（做后显示答案与解析）";
    }
    if (L.content) {
      var figs = FIG[L.id.split("_")[0]] || {};
      L.content.forEach(function (pg) {
        var md = String(pg.md).replace(/（图：[^）]*二维码[^）]*）/g, "").replace(/（图：本页[^）]*二维码[^）]*）/g, "");
        html += '<div class="pg" id="' + L.id + "-pg" + pg.p + '">' + renderMarkdown(md);
        var fs = figs[String(pg.p)];
        if (fs) fs.forEach(function (src, i) {
          html += '<figure class="fig"><img loading="lazy" src="' + src + '" alt="第' + pg.p + '页原图' + (i + 1) + '"><figcaption>第 ' + pg.p + ' 页 · 原书插图' + (fs.length > 1 ? " " + (i + 1) : "") + '</figcaption></figure>';
        });
        html += "</div>";
      });
    } else if (L.blocks) {
      L.blocks.forEach(function (b) {
        if (b.t === "h") html += '<h3 class="lh">' + A.esc(b.x) + "</h3>";
        else if (b.t === "h2") html += '<h4 class="lh2">' + A.esc(b.x) + "</h4>";
        else if (b.t === "p") html += "<p>" + A.esc(b.x).replace(/\n/g, "<br>") + "</p>";
        else if (b.t === "pg") html += '<div class="pgmark">第 ' + A.esc(String(b.x).replace(/^第/, "").replace(/页$/, "")) + " 页</div>";
        else if (b.t === "raw") html += b.x;
        else if (b.t === "note") html += '<div class="notes">' + A.esc(b.x) + "</div>";
        else if (b.t === "fml") html += '<div class="fml">' + A.esc(b.x) + "</div>";
        else if (b.t === "ex") html += '<div class="ex"><div class="ex-q">' + A.esc(b.q) + '</div>' +
          '<details class="sol"><summary>解答</summary><div class="ansbox">' + A.esc(b.sol) + "</div></details></div>";
      });
    }
    if (L.problems) {
      html += '<h3 class="lh">' + A.esc(L.probTitle || "练习题精选（含详细解答）") + "</h3>";
      html += '<p class="sub">选择题直接点选项判分；解答/证明题点「显示答案与解答」后自评对错，均计入统计。</p>';
      html += '<div class="navrow"><span class="chip" data-probstat></span><button class="navbtn" data-probreset>重做本节练习</button></div>';
      L.problems.forEach(function (p, i) {
        var tocH = (window.LESSON_TOC || {})[L.id];
        if (tocH) { for (var ti = 0; ti < tocH.length; ti++) if (tocH[ti].at === i) html += '<h3 class="lh toc-chap">' + A.esc(tocH[ti].t) + "</h3>"; }
        var c = parseChoice(p);
        html += '<div class="prob" id="' + L.id + "-p" + i + '">' +
          '<div class="prob-q"><span class="pn">' + p.n + ".</span> " + A.esc(c ? c.stem : p.q).replace(/\n/g, "<br>") + "</div>";
        if (c) {
          if (c.multi) html += '<p class="sub" style="margin:2px 0 4px">多选题（多选、少选、错选均不得分）</p>';
          html += '<div class="qopts' + (c.multi ? " multi" : "") + '">';
          c.options.forEach(function (o, j) {
            html += '<button class="qopt" data-opt="' + j + '">' + String.fromCharCode(65 + j) + ". " + A.esc(o) + "</button>";
          });
          html += "</div>";
          if (c.multi) html += '<div class="navrow"><button class="navbtn" data-submit>提交答案</button></div>';
        } else {
          html += '<div class="navrow"><button class="navbtn" data-show>显示答案与解答</button></div>';
        }
        html += '<div data-sol hidden><div class="ansbox">' +
          (p.a ? '<p class="prob-a">答案：' + A.esc(p.a) + "</p>" : "") +
          (p.sol ? renderMarkdown(p.sol) : "") + "</div></div>";
        html += "</div>";
      });
    }
    if (L.img && L.pages) {
      html += '<details class="pages"><summary>📖 对照原书原页（可选，正文不依赖）</summary><div class="imglist">';
      for (var pp = L.pages[0]; pp <= L.pages[1]; pp++) {
        html += '<figure><img loading="lazy" src="' + L.img + "/p-" + String(pp).padStart(3, "0") +
          '.jpg" alt="p' + pp + '"><figcaption>第 ' + pp + " 页</figcaption></figure>";
      }
      html += "</div></details>";
    }
    return html;
  }

  function makeQuiz(L, qhost, scoreEl, resetBtn) {
    if (!qhost || !L.quiz) return;
    var store = A.jget("quiz", {});
    function keyOf(i) { return L.id + "_q" + i; }
    function draw() {
      qhost.innerHTML = "";
      var answered = 0, correct = 0;
      L.quiz.forEach(function (q, i) {
        var key = keyOf(i), st = store[key] || {};
        var d = A.el("div", "qitem"); d.id = L.id + "-q" + i;
        d.innerHTML = '<div class="qq">' + (i + 1) + ". " + A.esc(q.q) + "</div>";
        var opts = A.el("div", "qopts");
        q.options.forEach(function (o, j) {
          var b = document.createElement("button");
          b.className = "qopt"; b.innerHTML = String.fromCharCode(65 + j) + ". " + A.esc(o);
          if (st.pick != null) {
            b.classList.add("locked");
            if (j === q.answer) b.classList.add("right");
            if (j === st.pick && st.pick !== q.answer) b.classList.add("wrong");
          }
          b.onclick = function () { pick(i, j); };
          opts.appendChild(b);
        });
        d.appendChild(opts);
        if (st.pick != null) {
          d.appendChild(A.el("div", "qexp", (st.pick === q.answer ? "✅ 正确　" : "❌ 错误　") + A.esc(q.explain || "")));
          answered++; if (st.pick === q.answer) correct++;
        }
        qhost.appendChild(d);
      });
      if (scoreEl) scoreEl.textContent = "已答 " + answered + "/" + L.quiz.length + " · 正确 " + correct;
      typeset([qhost]);
    }
    function pick(i, j) {
      var q = L.quiz[i], key = keyOf(i), all = A.jget("quiz", {});
      var st = all[key] || {}; if (st.pick != null) return;
      st.pick = j; st.ok = (j === q.answer); st.wrong = !st.ok;
      st.q = q.q; st.options = q.options; st.answer = q.answer; st.explain = q.explain;
      all[key] = st; A.jset("quiz", all); store = all;
      if (st.ok) A.srsRate(key, 2); else A.srsRate(key, 0);
      draw();
    }
    if (resetBtn) resetBtn.onclick = function () {
      var all = A.jget("quiz", {});
      L.quiz.forEach(function (q, i) { delete all[keyOf(i)]; A.srsForget(keyOf(i)); });
      A.jset("quiz", all); store = all; draw();
    };
    draw();
  }

  function initProblems(root, L) {
    if (!L.problems || !root) return;
    var store = A.jget("prob", {});
    function keyOf(n) { return L.id + ":" + n; }
    function stats() {
      var ans = 0, ok = 0;
      L.problems.forEach(function (p) { var st = store[keyOf(p.n)]; if (st) { ans++; if (st.ok) ok++; } });
      var el = root.querySelector("[data-probstat]");
      if (el) el.textContent = "已答 " + ans + "/" + L.problems.length + " · 正确 " + ok;
    }
    L.problems.forEach(function (p, i) {
      var box = root.querySelector(".prob#" + L.id + "-p" + i);
      if (!box) return;
      var key = keyOf(p.n), st = store[key];
      var solBox = box.querySelector("[data-sol]");
      function reveal() { if (solBox) { solBox.hidden = false; typeset([solBox]); } }
      var c = parseChoice(p);
      if (c) {
        var btns = box.querySelectorAll("[data-opt]");
        var submitBtn = box.querySelector("[data-submit]");
        function paint() {
          Array.prototype.forEach.call(btns, function (b) {
            var j = parseInt(b.getAttribute("data-opt"), 10);
            b.classList.add("locked");
            if (c.answers.indexOf(j) >= 0) b.classList.add("right");
            if (st) {
              var picked = c.multi ? (st.picks || []) : [st.pick];
              if (picked.indexOf(j) >= 0) { b.classList.add("sel"); if (c.answers.indexOf(j) < 0) b.classList.add("wrong"); }
            }
          });
          if (submitBtn) submitBtn.disabled = true;
        }
        if (c.multi) {
          var cur = [];
          Array.prototype.forEach.call(btns, function (b) {
            b.onclick = function () {
              if (store[key]) return;
              var j = parseInt(b.getAttribute("data-opt"), 10), p2 = cur.indexOf(j);
              if (p2 >= 0) { cur.splice(p2, 1); b.classList.remove("sel"); } else { cur.push(j); b.classList.add("sel"); }
            };
          });
          if (submitBtn) submitBtn.onclick = function () {
            if (store[key]) return;
            var picks = cur.slice().sort(function (a, b) { return a - b; });
            var ok = picks.length === c.answers.length && picks.every(function (x, i) { return x === c.answers[i]; });
            store[key] = { picks: picks, ok: ok, q: c.stem, options: c.options, answers: c.answers, multi: true };
            A.jset("prob", store); st = store[key];
            paint(); reveal(); stats();
          };
        } else {
          Array.prototype.forEach.call(btns, function (b) {
            b.onclick = function () {
              if (store[key]) return;
              var j = parseInt(b.getAttribute("data-opt"), 10);
              store[key] = { pick: j, ok: (j === c.answer), q: c.stem, options: c.options, answer: c.answer };
              A.jset("prob", store); st = store[key];
              paint(); reveal(); stats();
            };
          });
        }
        if (st) { paint(); reveal(); }
      } else {
        var showBtn = box.querySelector("[data-show]");
        var wrap = A.el("div", "navrow");
        var okB = document.createElement("button"); okB.className = "navbtn"; okB.textContent = "✓ 我做对了";
        var noB = document.createElement("button"); noB.className = "navbtn"; noB.textContent = "✗ 我做错了";
        function paintGrade() {
          if (!st) return;
          okB.disabled = noB.disabled = true;
          okB.style.borderColor = st.ok ? "var(--ok)" : "var(--line)";
          noB.style.borderColor = !st.ok ? "var(--no)" : "var(--line)";
        }
        okB.onclick = function () { if (store[key]) return; store[key] = { ok: true, q: p.q, a: p.a, sol: p.sol }; A.jset("prob", store); st = store[key]; reveal(); paintGrade(); stats(); };
        noB.onclick = function () { if (store[key]) return; store[key] = { ok: false, q: p.q, a: p.a, sol: p.sol }; A.jset("prob", store); st = store[key]; reveal(); paintGrade(); stats(); };
        wrap.appendChild(okB); wrap.appendChild(noB); box.appendChild(wrap);
        var hwb = hwBox(L.id + ":hw" + p.n);
        if (solBox) box.insertBefore(hwb, solBox); else box.appendChild(hwb);
        if (showBtn) showBtn.onclick = function () { reveal(); showBtn.disabled = true; showBtn.textContent = "已显示答案与解答"; };
        if (st) { reveal(); paintGrade(); }
      }
    });
    var reset = root.querySelector("[data-probreset]");
    if (reset) reset.onclick = function () {
      L.problems.forEach(function (p) { delete store[keyOf(p.n)]; });
      A.jset("prob", store);
      location.reload();
    };
    stats();
  }

  /* ---------- 章节整页模式（gs01.html 等） ---------- */
  var chapterHost = document.getElementById("chapter");
  if (chapterHost) {
    var cid = document.body.dataset.chapter || "gs01";
    var ids = Object.keys(window.LESSONS || {}).filter(function (k) { return k.indexOf(cid + "_s") === 0; });
    ids.sort(function (a, b) { return (a.split("_s")[1] | 0) - (b.split("_s")[1] | 0); });
    var html = "";
    ids.forEach(function (k) {
      var L = window.LESSONS[k];
      html += '<section class="sec" id="' + k + '"><h2>' + A.esc(L.title) +
        (L.pages ? ' <span class="bsub">讲义第 ' + L.pages[0] + "–" + L.pages[1] + " 页</span>" : "") + "</h2>" +
        '<div class="lessonbody">' + lessonHtml(L) + "</div>";
      if (L.quiz) {
        html += '<div class="quizwrap"><h3 class="lh">✍️ 本节自测</h3>' +
          '<div class="navrow"><span class="chip" data-score="' + k + '"></span>' +
          '<button class="navbtn" data-reset="' + k + '">重做本节</button></div>' +
          '<div data-quiz="' + k + '"></div></div>';
      }
      html += "</section>";
    });
    chapterHost.innerHTML = html;
    ids.forEach(function (k) {
      var L = window.LESSONS[k];
      makeQuiz(L, chapterHost.querySelector('[data-quiz="' + k + '"]'),
        chapterHost.querySelector('[data-score="' + k + '"]'),
        chapterHost.querySelector('[data-reset="' + k + '"]'));
      initProblems(chapterHost, L);
    });

    var nav = document.getElementById("lnav");
    if (nav) {
      var toc = '<div class="toc"><div class="toc-h">📑 本章目录</div>';
      var first = window.LESSONS[ids[0]] || {};
      var hier = (first.ch || "").split(" · ").length >= 3;
      var leaf = function (k) {
        var L = window.LESSONS[k];
        var s = '<a class="toc-l1" href="#' + k + '">' + A.esc(L.title) +
          (L.pages ? ' <span class="toc-pg">p' + L.pages[0] + "–" + L.pages[1] + "</span>" : "") +
          (L.problems ? ' <span class="toc-pg">' + L.problems.length + " 题</span>" : "") + "</a>";
        var sec = chapterHost.querySelector("#" + k);
        var body = sec ? sec.querySelector(".lessonbody") : null;
        var hs = body ? body.querySelectorAll("h3.lh, h4.lh2, h5.lh3") : [];
        if (hs.length) {
          var inner = "", ct = (L.ch || "").trim();
          Array.prototype.forEach.call(hs, function (h, i) {
            var ht = ((h.textContent || "")).trim();
            if (ht === ct || ht === (L.title || "").trim() || ht === (L.probTitle || "").trim()) return;
            var hid = k + "-h" + i; h.id = hid;
            inner += '<a class="toc-l2" href="#' + hid + '">' + A.esc(h.textContent) + "</a>";
          });
          if (inner) s += '<div class="toc-l2s">' + inner + "</div>";
        }
        return s;
      };
      if (hier) {
        var subjs = [], sMap = {};
        ids.forEach(function (k) {
          var L = window.LESSONS[k];
          var parts = (L.ch || "").split(" · ");
          var sn = parts[1] || "", cn = (parts.length >= 4 ? parts[2] : "");
          if (!sMap[sn]) { sMap[sn] = { name: sn, chs: [], cMap: {} }; subjs.push(sMap[sn]); }
          var sj = sMap[sn];
          if (!sj.cMap[cn]) { sj.cMap[cn] = { name: cn, secs: [] }; sj.chs.push(sj.cMap[cn]); }
          sj.cMap[cn].secs.push(k);
        });
        subjs.forEach(function (sj) {
          toc += '<div class="toc-subj">' + A.esc(sj.name) + "</div>";
          sj.chs.forEach(function (ch) {
            if (ch.name) toc += '<div class="toc-ch"><div class="toc-chh">' + A.esc(ch.name) + "</div>";
            ch.secs.forEach(function (k) { toc += leaf(k); });
            if (ch.name) toc += "</div>";
          });
        });
      } else {
        ids.forEach(function (k) {
          toc += '<div class="toc-sec">' + leaf(k) + "</div>";
        });
      }
      toc += "</div>";
      nav.innerHTML = toc;

      // 滚动联动高亮当前节（及所属章/科目）
      var links = {};
      Array.prototype.forEach.call(nav.querySelectorAll("a.toc-l1"), function (a) {
        var id = (a.getAttribute("href") || "").replace(/^#/, "");
        if (id) links[id] = a;
      });
      var secs = ids.map(function (k) { return document.getElementById(k); });
      var l2 = [];
      Array.prototype.forEach.call(nav.querySelectorAll("a.toc-l2"), function (a) {
        var id = (a.getAttribute("href") || "").replace(/^#/, "");
        var el = id ? document.getElementById(id) : null;
        if (el) l2.push({ a: a, el: el });
      });
      var tops = null, htops = null;
      var absTop = function (el) {
        var r = el.getBoundingClientRect();
        return r.top + (window.pageYOffset || document.documentElement.scrollTop || 0);
      };
      var measure = function () {
        tops = secs.map(function (s) { return s ? absTop(s) : 1e9; });
        htops = l2.map(function (o) { return absTop(o.el); });
      };
      var raf = null;
      var update = function () {
        raf = null;
        measure();
        var y = (window.pageYOffset || document.documentElement.scrollTop || 0) + 130;
        var cur = ids.length ? ids[0] : null;
        for (var i = 0; i < secs.length; i++) { if (tops[i] <= y) cur = ids[i]; else break; }
        for (var k in links) links[k].classList.toggle("active", k === cur);
        Array.prototype.forEach.call(nav.querySelectorAll(".toc-chh,.toc-subj"), function (el) {
          el.classList.remove("active");
        });
        if (cur && links[cur]) {
          var ch = null, subj = null, p = links[cur].parentNode;
          while (p && p !== nav) {
            var pcls = p.className || "";
            if (!ch && /(^|\s)toc-ch(\s|$)/.test(pcls)) ch = p;
            if (!subj && /(^|\s)toc-subj(\s|$)/.test(pcls)) subj = p;
            p = p.parentNode;
          }
          if (subj) subj.classList.add("active");
          else {
            var s = links[cur].previousElementSibling;
            while (s && !/(^|\s)toc-subj(\s|$)/.test(s.className || "")) s = s.previousElementSibling;
            if (s) s.classList.add("active");
          }
          if (ch) {
            var h = ch.querySelector(".toc-chh"); if (h) h.classList.add("active");
          }
        }
        if (l2.length) {
          var hc = -1;
          for (var j = 0; j < l2.length; j++) { if (htops[j] <= y) hc = j; else break; }
          l2.forEach(function (o, idx) { o.a.classList.toggle("active", idx === hc); });
          if (hc >= 0) keepVisible(l2[hc].a);
          else if (links[cur]) keepVisible(links[cur]);
        } else if (links[cur]) {
          keepVisible(links[cur]);
        }
      };
      var keepVisible = function (el) {
        if (!el || nav.scrollHeight <= nav.clientHeight) return;
        var nb = nav.getBoundingClientRect(), eb = el.getBoundingClientRect();
        if (eb.top < nb.top + 10) nav.scrollTop += eb.top - nb.top - 10;
        else if (eb.bottom > nb.bottom - 10) nav.scrollTop += eb.bottom - nb.bottom + 10;
      };
      var onScroll = function () { update(); };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      window.addEventListener("hashchange", onScroll);
      document.addEventListener("visibilitychange", onScroll);
      update();
      [80, 400, 1000, 2000, 3500].forEach(function (t) { setTimeout(update, t); });
      setInterval(function () { if (!document.hidden) update(); }, 900);
    }
    typeset([chapterHost]);
    initHW(cid);
    return;
  }

  /* ---------- 单节模式（lesson.html?id=...） ---------- */
  var host = document.getElementById("lesson");
  if (!host) return;
  var id = (/[?&]id=([^&]+)/.exec(location.search) || [])[1] || "gs01_s0";
  var L = (window.LESSONS || {})[id];
  if (!L) { host.innerHTML = '<p class="empty">未找到该节内容。</p>'; return; }

  document.title = L.ch + " " + L.title + " · 考研数学";
  var h1 = document.getElementById("ltitle"); if (h1) h1.textContent = L.ch + " · " + L.title;
  var meta = document.getElementById("lmeta");
  if (meta) meta.innerHTML = A.esc(L.book) + " ｜ 讲义第 " + L.pages[0] + "–" + L.pages[1] + " 页 ｜ <a href=\"index.html\">← 返回首页</a>";

  var lnav = document.getElementById("lnav");
  if (lnav) {
    var prefix = L.id.split("_s")[0];
    var kids = Object.keys(window.LESSONS).filter(function (k) { return k.indexOf(prefix + "_s") === 0; });
    kids.sort(function (a, b) { return (a.split("_s")[1] | 0) - (b.split("_s")[1] | 0); });
    lnav.innerHTML = "";
    kids.forEach(function (k) {
      var a = document.createElement("a");
      a.className = "navbtn"; a.href = "lesson.html?id=" + k; a.textContent = window.LESSONS[k].title;
      if (k === L.id) a.style.borderColor = "var(--acc)";
      lnav.appendChild(a);
    });
  }

  host.innerHTML = lessonHtml(L);
  typeset([host]);
  makeQuiz(L, document.getElementById("quiz"), document.getElementById("quizscore"), document.getElementById("quizreset"));
  initProblems(host, L);
  initHW(L.id);
})();
