(function () {
  var D = window.JINGJIANG || {}, parts = D.parts || [];
  var flat = [];
  parts.forEach(function (p, pi) {
    (p.chapters || []).forEach(function (c, ci) { flat.push({ p: pi, c: ci, part: p.name, ch: c }); });
  });
  var side = document.getElementById("jjside"), list = document.getElementById("jjlist"), main = document.getElementById("jjmain"), search = document.getElementById("jjsearch");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]; }); }
  function idxOf(pi, ci) { for (var i = 0; i < flat.length; i++) if (flat[i].p === pi && flat[i].c === ci) return i; return 0; }
  var qp = new URLSearchParams(location.search);
  var cur = { p: Math.max(0, Math.min(parts.length - 1, parseInt(qp.get("p"), 10) || 0)), c: 0 };
  cur.c = Math.max(0, Math.min((parts[cur.p].chapters || []).length - 1, parseInt(qp.get("c"), 10) || 0));

  function load(pi, ci, push) {
    pi = Math.max(0, Math.min(parts.length - 1, pi));
    ci = Math.max(0, Math.min((parts[pi].chapters || []).length - 1, ci));
    cur = { p: pi, c: ci };
    if (push) { try { history.replaceState(null, "", "?p=" + pi + "&c=" + ci); } catch (e) { } }
    side.classList.remove("open");
    renderSide(search.value);
    renderMain();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function chapterLink(pi, ci, text, cls) {
    var a = document.createElement("a");
    a.className = cls || "jj-ch"; a.href = "?p=" + pi + "&c=" + ci; a.textContent = text;
    a.onclick = function (e) { e.preventDefault(); load(pi, ci, true); };
    return a;
  }
  function renderSide(q) {
    q = (q || "").trim(); list.innerHTML = "";
    if (q.length < 2) {
      parts.forEach(function (p, pi) {
        var h = document.createElement("div"); h.className = "jj-ph"; h.textContent = p.name; list.appendChild(h);
        (p.chapters || []).forEach(function (c, ci) {
          list.appendChild(chapterLink(pi, ci, c.name, "jj-ch" + (pi === cur.p && ci === cur.c ? " on" : "")));
        });
      });
      return;
    }
    var res = [], ql = q.toLowerCase();
    flat.forEach(function (f) {
      var hit = f.ch.name.indexOf(q) >= 0 ? "" : null;
      if (hit === null) {
        var pages = f.ch.pages || [];
        for (var i = 0; i < pages.length && hit === null; i++) {
          var ps = pages[i][1] || [];
          for (var j = 0; j < ps.length; j++) {
            var k = ps[j].indexOf(q);
            if (k < 0 && ql !== q) k = ps[j].toLowerCase().indexOf(ql);
            if (k >= 0) { hit = ps[j].slice(Math.max(0, k - 16), Math.min(ps[j].length, k + q.length + 34)); break; }
          }
        }
      }
      if (hit !== null) res.push({ f: f, snip: hit });
    });
    var head = document.createElement("div"); head.className = "jj-ph"; head.textContent = "搜索结果 " + res.length + " 章"; list.appendChild(head);
    if (!res.length) { var em = document.createElement("div"); em.className = "cs"; em.textContent = "没有匹配内容，换个关键词试试。"; list.appendChild(em); return; }
    res.slice(0, 30).forEach(function (r) {
      var d = document.createElement("div"); d.className = "jj-res";
      d.appendChild(chapterLink(r.f.p, r.f.c, r.f.ch.name));
      if (r.snip) { var sp = document.createElement("div"); sp.className = "jj-snip"; sp.textContent = "…" + r.snip + "…"; d.appendChild(sp); }
      list.appendChild(d);
    });
  }
  var QMAP = {
    "第一部分 马克思主义基本原理": ["q1000_s0", "q1000_s1"],
    "第二部分 毛泽东思想和中国特色社会主义理论体系概论": ["q1000_s2", "q1000_s3"],
    "第三部分 习近平新时代中国特色社会主义思想概论": ["q1000_s4", "q1000_s5"],
    "第四部分 中国近现代史纲要": ["q1000_s6", "q1000_s7"],
    "第五部分 思想道德与法治": ["q1000_s8", "q1000_s9"]
  };
  function renderMain() {
    var f = flat[idxOf(cur.p, cur.c)], p = parts[f.p], c = f.ch;
    document.title = c.name + " · 精讲精练 · 考研政治";
    var h = '<div class="jj-bc">' + esc(p.name) + '</div><h2>' + esc(c.name) + '</h2>';
    h += '<div class="jj-meta">原书 p' + c.from + '–' + c.to + ' ｜ ' + (c.pages || []).length + ' 页 ｜ OCR 文字 ｜ <a href="#" id="jjprint">🖨 打印本章</a></div>';
    var q = QMAP[p.name];
    if (q) h += '<div class="jj-q">对应肖1000：<a href="xiao1000.html#' + q[0] + '">单项选择 →</a> ｜ <a href="xiao1000.html#' + q[1] + '">多项选择 →</a> ｜ <a href="xiao1000.html?set=multi">多选专项 →</a></div>';
    h += '<div class="jj-text">';
    (c.pages || []).forEach(function (pg) {
      h += '<div class="jj-page"><span class="jj-pgn">p' + pg[0] + '</span>';
      (pg[1] || []).forEach(function (t) { h += '<p>' + esc(t) + '</p>'; });
      h += '</div>';
    });
    h += '</div>';
    var i = idxOf(cur.p, cur.c), prev = i > 0 ? flat[i - 1] : null, next = i < flat.length - 1 ? flat[i + 1] : null;
    h += '<div class="jj-nav">' + (prev ? '<a href="?p=' + prev.p + '&c=' + prev.c + '" data-p="' + prev.p + '" data-c="' + prev.c + '">← ' + esc(prev.ch.name) + '</a>' : '<span></span>') +
      '<span style="color:var(--sub);font-size:12px">' + (i + 1) + " / " + flat.length + '</span>' +
      (next ? '<a href="?p=' + next.p + '&c=' + next.c + '" data-p="' + next.p + '" data-c="' + next.c + '">' + esc(next.ch.name) + ' →</a>' : '<span></span>') + '</div>';
    main.innerHTML = h;
    var pr = document.getElementById("jjprint"); if (pr) pr.onclick = function (e) { e.preventDefault(); window.print(); };
    main.querySelectorAll(".jj-nav a[data-p]").forEach(function (a) {
      a.onclick = function (e) { e.preventDefault(); load(+a.dataset.p, +a.dataset.c, true); };
    });
  }
  var t = null;
  search.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { renderSide(search.value); }, 180); });
  document.getElementById("jjtoggle").onclick = function () { side.classList.toggle("open"); };
  document.addEventListener("keydown", function (e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName || "")) return;
    var i = idxOf(cur.p, cur.c);
    if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); load(flat[i - 1].p, flat[i - 1].c, true); }
    if (e.key === "ArrowRight" && i < flat.length - 1) { e.preventDefault(); load(flat[i + 1].p, flat[i + 1].c, true); }
  });
  renderSide(""); renderMain();
})();
