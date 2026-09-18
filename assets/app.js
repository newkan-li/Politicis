(function () {
  var PREFIX = "pol_";
  function k(n) { return PREFIX + n; }
  function jget(n, d) { try { return JSON.parse(localStorage.getItem(k(n))) || d; } catch (e) { return d; } }
  function jset(n, v) { try { localStorage.setItem(k(n), JSON.stringify(v)); } catch (e) { } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ---------- SRS ---------- */
  function srsAll() { return jget("srs", {}); }
  function srsGet(id) { return srsAll()[id]; }
  function srsRate(id, q) {
    var all = srsAll(), r = all[id] || { reps: 0, ef: 2.5, iv: 0 };
    if (q === 0) { r.reps = 0; r.iv = 0; r.ef = Math.max(1.3, r.ef - 0.2); }
    else {
      r.ef = Math.max(1.3, r.ef + (q === 2 ? 0.1 : -0.15));
      r.iv = r.reps === 0 ? 1 : Math.round(r.iv * r.ef);
      r.reps++;
    }
    r.due = Date.now() + (r.iv || 0) * 86400000;
    all[id] = r; jset("srs", all);
  }
  function srsDue() {
    var now = Date.now(), out = [];
    var all = srsAll();
    Object.keys(all).forEach(function (id) { if (all[id].due <= now) out.push(id); });
    return out;
  }
  function srsForget(id) { var all = srsAll(); delete all[id]; jset("srs", all); }
  function srsLabel(id) {
    var m = /^([a-z0-9]+)_s(\d+)$/.exec(id);
    if (m) {
      var ch = (window.MANIFEST || []).filter(function (x) { return x.id === m[1]; })[0];
      return { text: (ch ? ch.title : m[1]) + " · 第 " + (parseInt(m[2], 10) + 1) + " 节", href: m[1] + ".html" };
    }
    var p = /^([a-z0-9]+)_s(\d+):(\d+)$/.exec(id);
    if (p) {
      var c2 = (window.MANIFEST || []).filter(function (x) { return x.id === p[1]; })[0];
      return { text: (c2 ? c2.title : p[1]) + " · 第 " + (parseInt(p[2], 10) + 1) + " 节 · 练习第 " + p[3] + " 题", href: p[1] + ".html#" + p[1] + "_s" + p[2] };
    }
    return { text: id, href: null };
  }
  function lookupRec(key) {
    var p = /^([a-z0-9]+)_s(\d+):(\d+)$/.exec(key);
    if (p) {
      var Lp = (window.LESSONS || {})[p[1] + "_s" + p[2]];
      var pr = Lp && Lp.problems && Lp.problems.filter(function (x) { return String(x.n) === String(p[3]); })[0];
      if (pr) return { q: pr.q, a: pr.a, sol: pr.sol };
    }
    return null;
  }
  function wrongBody(rec, key) {
    var info = (rec && rec.q) ? rec : lookupRec(key);
    if (!info || !info.q) return "";
    var h = '<div class="wq">' + esc(info.q) + "</div>";
    if (info.a) h += '<div class="wa">答案：' + esc(info.a) + "</div>";
    if (info.sol) h += '<details class="sol"><summary>详细解答</summary><div class="ansbox">' + esc(info.sol) + "</div></details>";
    return h;
  }

  /* ---------- 章节标记 ---------- */
  function marks() { return jget("marks", {}); }
  function renderMarks() {
    document.querySelectorAll(".mark").forEach(function (host) {
      var cid = host.dataset.ch, si = host.dataset.sec, key = cid + "_s" + si;
      var m = marks()[key] || {};
      host.innerHTML = "";
      [["read", "✅ 已读", "on"], ["conf", "❓ 不懂", "conf"]].forEach(function (o) {
        var b = document.createElement("button");
        b.textContent = o[1];
        if (m[o[0]]) b.className = "on";
        b.onclick = function () {
          var all = marks(); var cur = all[key] || {}; cur[o[0]] = !cur[o[0]];
          all[key] = cur; jset("marks", all);
          if (o[0] === "read") { if (cur.read) srsRate(key, 2); else srsForget(key); }
          if (o[0] === "conf" && cur.conf) srsRate(key, 0);
          renderMarks();
        };
        host.appendChild(b);
      });
      if (m.read) { var s = document.createElement("span"); s.className = "chip"; s.textContent = "已读"; host.appendChild(s); }
    });
  }

  /* ---------- 首页看板 ---------- */
  function renderDash() {
    var host = document.getElementById("dash"); if (!host) return;
    var mk = marks(), readN = 0, confN = 0;
    Object.keys(mk).forEach(function (kk) { if (mk[kk].read) readN++; if (mk[kk].conf) confN++; });
    var M = window.MANIFEST || [], total = 0;
    M.forEach(function (m) { total += m.nsec || 0; });
    host.innerHTML = '<div class="dash-grid"><div>讲义章节 <b>' + M.length + '</b></div>' +
      '<div>小节进度 <b>' + readN + "/" + total + '</b></div>' +
      '<div>不懂 <b>' + confN + '</b></div>' +
      '<div>待复习 <b>' + srsDue().length + '</b></div></div>';
    M.forEach(function (m) {
      var e2 = document.getElementById("prog_" + m.id); if (!e2) return;
      var done = 0;
      for (var i = 0; i < (m.nsec || 0); i++) if ((mk[m.id + "_s" + i] || {}).read) done++;
      e2.textContent = "进度 " + done + "/" + m.nsec + (m.nsec && done === m.nsec ? " ✔" : "");
    });
  }

  /* ---------- 错题本 / 复习 ---------- */
  function renderWrong() {
    var host = document.getElementById("whost"); if (!host) return;
    var mk = marks();
    var secs = [];
    Object.keys(mk).forEach(function (key) { if (mk[key].conf) secs.push({ key: key, lab: srsLabel(key) }); });
    var qz = jget("quiz", {}), quiz = [];
    Object.keys(qz).forEach(function (key) { if (qz[key].wrong) quiz.push(key); });
    var pr = jget("prob", {}), probs = [];
    Object.keys(pr).forEach(function (key) { if (pr[key] && pr[key].ok === false) probs.push(key); });
    if (!secs.length && !quiz.length && !probs.length) {
      host.innerHTML = '<p class="empty">还没有错题。做错「练习题」「肖1000」或标记「不懂」后，会自动收集到这里。</p>';
      return;
    }
    host.innerHTML = "";
    if (probs.length) {
      host.appendChild(el("h2", null, "练习题错题（" + probs.length + "）"));
      probs.forEach(function (key) {
        var lab = srsLabel(key), it = el("div", "fitem");
        it.innerHTML = '<div class="fh">' + esc(lab.text) + '</div>' + wrongBody(pr[key], key) +
          (lab.href ? '<div><a href="' + lab.href + '">回到练习题 →</a></div>' : "");
        var bar = el("div", "mark"), b = document.createElement("button");
        b.textContent = "✓ 已弄懂，移除";
        b.onclick = function () { var all = jget("prob", {}); if (all[key]) all[key].ok = true; jset("prob", all); renderWrong(); };
        bar.appendChild(b); it.appendChild(bar); host.appendChild(it);
      });
    }
    if (quiz.length) {
      host.appendChild(el("h2", null, "自测错题（" + quiz.length + "）"));
      quiz.forEach(function (key) {
        var lab = srsLabel(key), it = el("div", "fitem");
        it.innerHTML = '<div class="fh">' + esc(lab.text) + '</div>' + wrongBody(qz[key], key);
        var bar = el("div", "mark"), b = document.createElement("button");
        b.textContent = "✓ 已弄懂，移除";
        b.onclick = function () { var all = jget("quiz", {}); if (all[key]) all[key].wrong = false; jset("quiz", all); srsForget(key); renderWrong(); };
        bar.appendChild(b); it.appendChild(bar); host.appendChild(it);
      });
    }
    if (secs.length) {
      host.appendChild(el("h2", null, "章节不懂（" + secs.length + "）"));
      secs.forEach(function (o) {
        var it = el("div", "fitem");
        it.innerHTML = '<div class="fh">' + esc(o.lab.text) + '</div>' +
          (o.lab.href ? '<div><a href="' + o.lab.href + '">打开讲义 →</a></div>' : "");
        var bar = el("div", "mark"), b = document.createElement("button");
        b.textContent = "✓ 已弄懂，移除";
        b.onclick = function () { var all = marks(); if (all[o.key]) all[o.key].conf = false; jset("marks", all); renderWrong(); };
        bar.appendChild(b); it.appendChild(bar); host.appendChild(it);
      });
    }
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([host]);
  }
  function renderReview() {
    var host = document.getElementById("reviewhost"); if (!host) return;
    var due = srsDue();
    var cnt = document.getElementById("duecount"); if (cnt) cnt.textContent = due.length;
    if (!due.length) { host.innerHTML = '<p class="empty">今天没有待复习的内容。去学习并标记「已读」后会自动安排复习。</p>'; return; }
    host.innerHTML = "";
    due.forEach(function (id) {
      var lab = srsLabel(id), it = el("div", "fitem");
      it.innerHTML = '<div class="fh">' + esc(lab.text) + '</div>' + (lab.href ? '<div><a href="' + lab.href + '">打开讲义 →</a></div>' : "");
      var bar = el("div", "mark");
      [["不会", 0], ["模糊", 1], ["会", 2]].forEach(function (o) {
        var b = document.createElement("button");
        b.textContent = o[0];
        b.onclick = function () { srsRate(id, o[1]); renderReview(); };
        bar.appendChild(b);
      });
      it.appendChild(bar); host.appendChild(it);
    });
  }

  /* ---------- 通用原页查看器（讲义 / 肖1000） ---------- */
  function renderPages() {
    var host = document.getElementById("pgview"); if (!host) return;
    var P = window.PAGES || { books: [] };
    if (!P.books || !P.books.length) { host.innerHTML = '<p class="empty">无内容。</p>'; return; }
    var key = P.key || "pages";
    var store = jget(key, {});
    var bookTabs = document.getElementById("pgbooks");
    var tabs = document.getElementById("pgtabs");
    var info = document.getElementById("pginfo");
    var bi = 0, si = 0, page = P.books[0].sections[0] ? P.books[0].sections[0].a : 1;
    var hb = /b=(\d+)/.exec(location.hash || ""); if (hb) { var b0 = parseInt(hb[1], 10); if (P.books[b0]) bi = b0; }
    var hp = /p=(\d+)/.exec(location.hash || "");
    if (hp) { var p0 = parseInt(hp[1], 10); P.books[bi].sections.forEach(function (S, i) { if (p0 >= S.a && p0 <= S.b) { si = i; page = p0; } }); }
    function B() { return P.books[bi]; }
    function clampSec() { var S = B().sections[si]; if (page < S.a) page = S.a; if (page > S.b) page = S.b; }
    function drawBooks() {
      if (!bookTabs) return; bookTabs.innerHTML = "";
      P.books.forEach(function (bk, i) {
        var b = el("button", "navbtn", bk.name);
        if (i === bi) b.style.borderColor = "var(--acc)";
        b.onclick = function () { bi = i; si = 0; page = P.books[i].sections[0].a; clampSec(); draw(); };
        bookTabs.appendChild(b);
      });
    }
    function drawTabs() {
      if (!tabs) return; tabs.innerHTML = "";
      B().sections.forEach(function (S, i) {
        var b = el("button", "navbtn", S.name);
        if (i === si) b.style.borderColor = "var(--acc)";
        b.onclick = function () { si = i; page = S.a; clampSec(); draw(); };
        tabs.appendChild(b);
      });
    }
    function draw() {
      clampSec();
      try { history.replaceState(null, "", "#b=" + bi + "&p=" + page); } catch (e) { }
      drawBooks(); drawTabs();
      var S = B().sections[si];
      host.innerHTML = '<figure><img src="' + B().img + '/p-' + String(page).padStart(3, "0") + '.jpg" alt="p' + page + '"><figcaption>' + esc(B().name) + ' · ' + esc(S.name) + ' · 第 ' + page + ' 页</figcaption></figure>';
      var mk = document.getElementById("pgmark");
      if (mk) {
        var st = store[bi + "_" + page] || {};
        mk.innerHTML = "";
        [["ok", "✓ 做对", "on"], ["no", "✗ 做错", "conf"]].forEach(function (o) {
          var b = document.createElement("button");
          b.textContent = o[1];
          if (st[o[0]]) b.className = o[2];
          b.onclick = function () {
            var m = jget(key, {}); var c = m[bi + "_" + page] || {}; c[o[0]] = !c[o[0]];
            m[bi + "_" + page] = c; jset(key, m); store = m; draw();
          };
          mk.appendChild(b);
        });
      }
      var nOk = 0, nNo = 0;
      Object.keys(store).forEach(function (kk) { if (store[kk].ok) nOk++; if (store[kk].no) nNo++; });
      if (info) info.textContent = "已做对 " + nOk + " 页 · 做错 " + nNo + " 页";
    }
    var prev = document.getElementById("pgprev"), next = document.getElementById("pgnext"),
      jump = document.getElementById("pgjump"), go = document.getElementById("pggo");
    if (prev) prev.onclick = function () { page--; draw(); };
    if (next) next.onclick = function () { page++; draw(); };
    if (go) go.onclick = function () { var v = parseInt(jump.value, 10); if (v) { page = v; draw(); } };
    if (jump) jump.onkeydown = function (e) { if (e.key === "Enter" && go) go.click(); };
    draw();
  }

  window.MathApp = { srsRate: srsRate, srsForget: srsForget, srsDue: srsDue, srsLabel: srsLabel, jget: jget, jset: jset, esc: esc, el: el, marks: marks };

  window.addEventListener("DOMContentLoaded", function () {
    var page = document.body.dataset.page;
    if (page === "index") renderDash();
    else if (page === "chapter") renderMarks();
    else if (page === "wrong") renderWrong();
    else if (page === "review") renderReview();
    else if (page === "pages") renderPages();
  });
})();
