(function () {
  var PFX = "pol_";
  function jget(n, d) { try { var v = JSON.parse(localStorage.getItem(PFX + n)); return v == null ? d : v; } catch (e) { return d; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]; }); }
  var L = window.LESSONS || {}, T = window.LESSON_TOC || {};
  var P = jget("prob", {}), R = jget("reasons", {});
  var PARTS = [
    { id: "mayuan", name: "马原", secs: ["q1000_s0", "q1000_s1"] },
    { id: "mzt", name: "毛中特", secs: ["q1000_s2", "q1000_s3"] },
    { id: "xsx", name: "新思想", secs: ["q1000_s4", "q1000_s5"] },
    { id: "sg", name: "史纲", secs: ["q1000_s6", "q1000_s7"] },
    { id: "sx", name: "思修", secs: ["q1000_s8", "q1000_s9"] }
  ];
  function chap(sid, i) {
    var t = T[sid] || [], ch = "";
    for (var j = 0; j < t.length; j++) { if (t[j].at <= i) ch = t[j].t; else break; }
    return ch || "未分章";
  }
  var ROWS = [];
  PARTS.forEach(function (p) {
    p.secs.forEach(function (sid, si) {
      var A = L[sid]; if (!A) return;
      (A.problems || []).forEach(function (pr, i) {
        var key = sid + ":" + pr.n, st = P[key];
        ROWS.push({ part: p.id, pname: p.name, ch: chap(sid, i), multi: si === 1, ans: !!st, ok: !!(st && st.ok), key: key, sid: sid, ord: ROWS.length });
      });
    });
  });
  function stat(rows) {
    var a = rows.filter(function (r) { return r.ans; }), o = rows.filter(function (r) { return r.ok; });
    return { tot: rows.length, ans: a.length, ok: o.length, acc: a.length ? Math.round(o.length / a.length * 100) : 0 };
  }
  function bar(acc) { var c = acc >= 80 ? "" : acc >= 60 ? "mid" : "low"; return '<div class="sbar"><i class="' + c + '" style="width:' + Math.min(100, acc) + '%"></i></div>'; }
  var hostSum = document.getElementById("sum"), hostParts = document.getElementById("parts"), hostWeak = document.getElementById("weak"), hostTbl = document.getElementById("table");

  var all = stat(ROWS);
  var sgl = stat(ROWS.filter(function (r) { return !r.multi; }));
  var mul = stat(ROWS.filter(function (r) { return r.multi; }));
  hostSum.innerHTML =
    '<div class="sgrid">' +
    '<div class="sbox"><div class="snum">' + all.ans + "/" + all.tot + '</div><div class="slbl">已答 / 选择总题</div>' + bar(all.ans ? Math.round(all.ans / all.tot * 100) : 0) + '</div>' +
    '<div class="sbox"><div class="snum">' + all.acc + '%</div><div class="slbl">总正确率（已答）</div>' + bar(all.acc) + '</div>' +
    '<div class="sbox"><div class="snum">' + sgl.acc + '%</div><div class="slbl">单选正确率</div>' + bar(sgl.acc) + '</div>' +
    '<div class="sbox"><div class="snum">' + mul.acc + '%</div><div class="slbl">多选正确率（目标 80%）</div>' + bar(mul.acc) + '</div>' +
    '</div>';
  if (!all.ans) hostSum.insertAdjacentHTML("beforeend", '<p class="cs">还没有作答记录。先去 <a href="xiao1000.html">肖1000</a> 做几题，统计会自动生成。</p>');

  var ph = '<h2 style="font-size:16px;margin:16px 0 8px">各科正确率</h2><div class="sgrid">';
  PARTS.forEach(function (p) {
    var rows = ROWS.filter(function (r) { return r.part === p.id; });
    var s = stat(rows), ss = stat(rows.filter(function (r) { return !r.multi; })), sm = stat(rows.filter(function (r) { return r.multi; }));
    ph += '<div class="sbox"><div class="slbl"><b style="color:var(--fg);font-size:13.5px">' + p.name + '</b> · ' + s.ans + "/" + s.tot + '</div>' +
      '<div class="snum">' + s.acc + '%</div>' + bar(s.acc) +
      '<div class="slbl" style="margin-top:6px">单选 ' + ss.acc + '% · 多选 ' + sm.acc + '%</div>' +
      '<div style="margin-top:6px"><a href="xiao1000.html#' + p.secs[0] + '" style="font-size:12px">去练 ' + p.name + ' →</a></div></div>';
  });
  ph += '</div>';
  hostParts.innerHTML = ph;

  var gm = {};
  ROWS.forEach(function (r) {
    var k = r.part + "|" + r.ch;
    if (!gm[k]) gm[k] = { part: r.part, pname: r.pname, ch: r.ch, sid: r.sid, ord: r.ord, rows: [] };
    gm[k].rows.push(r);
  });
  var weak = Object.keys(gm).map(function (k) { var g = gm[k], s = stat(g.rows); return { g: g, s: s }; })
    .filter(function (x) { return x.s.ans >= 5 && x.s.acc < 65; })
    .sort(function (a, b) { return a.s.acc - b.s.acc; }).slice(0, 12);
  if (weak.length) {
    var wh = '<h2 style="font-size:16px;margin:16px 0 8px">⚠️ 薄弱章节（已答≥5，正确率<65%）</h2><div class="weakbox"><div class="weaklist">';
    weak.forEach(function (x) {
      wh += '<a href="xiao1000.html#' + x.g.sid + '">' + x.g.pname + ' · ' + esc(x.g.ch) + ' <b>' + x.s.acc + '%</b> <span style="color:var(--sub)">(' + x.s.ans + '答)</span></a>';
    });
    wh += '</div><p class="cs" style="margin:8px 0 0">优先重刷这些章的多选；正确率回到 75%+ 再推进。</p></div>';
    hostWeak.innerHTML = wh;
  } else {
    hostWeak.innerHTML = '<p class="cs">暂无薄弱章节（或已答样本不足 5 题）。继续刷题后自动出现。</p>';
  }

  var rc = { concept: 0, memory: 0, careless: 0 };
  Object.keys(R).forEach(function (k) { if (rc[R[k]] != null) rc[R[k]]++; });
  var rsum = document.getElementById("rsum");
  if (rsum) rsum.innerHTML = '已标错因 <b>' + (rc.concept + rc.memory + rc.careless) + '</b> 道 ｜ 概念 ' + rc.concept + ' · 记忆 ' + rc.memory + ' · 审题 ' + rc.careless + ' ｜ <a href="wrong.html">去错题本标注 →</a>';

  var F = { part: "all", multi: false, answered: false, sort: "order" };
  var ctl = document.getElementById("ctl");
  ctl.innerHTML =
    '<select id="fpart" class="wsel"><option value="all">全部科目</option>' + PARTS.map(function (p) { return '<option value="' + p.id + '">' + p.name + '</option>'; }).join("") + '</select>' +
    '<label class="wchk"><input type="checkbox" id="fmulti"> 只看多选</label>' +
    '<label class="wchk"><input type="checkbox" id="fans"> 只看已答</label>' +
    '<select id="fsort" class="wsel"><option value="order">按章顺序</option><option value="asc">正确率从低到高</option><option value="desc">正确率从高到低</option><option value="n">已答最多</option></select>' +
    '<a class="wlink" href="xiao1000.html?set=multi">📕 多选专项 →</a>';
  document.getElementById("fpart").onchange = function () { F.part = this.value; drawTable(); };
  document.getElementById("fmulti").onchange = function () { F.multi = this.checked; drawTable(); };
  document.getElementById("fans").onchange = function () { F.answered = this.checked; drawTable(); };
  document.getElementById("fsort").onchange = function () { F.sort = this.value; drawTable(); };

  function drawTable() {
    var rows = ROWS.filter(function (r) {
      if (F.part !== "all" && r.part !== F.part) return false;
      if (F.multi && !r.multi) return false;
      if (F.answered && !r.ans) return false;
      return true;
    });
    var m = {};
    rows.forEach(function (r) {
      var k = r.part + "|" + r.ch;
      if (!m[k]) m[k] = { part: r.part, pname: r.pname, ch: r.ch, sid: r.sid, ord: r.ord, rows: [] };
      m[k].rows.push(r);
    });
    var arr = Object.keys(m).map(function (k) {
      var g = m[k], s = stat(g.rows);
      var ss = stat(g.rows.filter(function (r) { return !r.multi; })), sm = stat(g.rows.filter(function (r) { return r.multi; }));
      return { g: g, s: s, ss: ss, sm: sm };
    });
    if (F.sort === "asc") arr.sort(function (a, b) { return a.s.acc - b.s.acc; });
    else if (F.sort === "desc") arr.sort(function (a, b) { return b.s.acc - a.s.acc; });
    else if (F.sort === "n") arr.sort(function (a, b) { return b.s.ans - a.s.ans; });
    else arr.sort(function (a, b) { return a.g.ord - b.g.ord; });
    var h = '<h2 style="font-size:16px;margin:18px 0 8px">逐章正确率</h2><div style="overflow-x:auto"><table class="stbl"><thead><tr><th>科目</th><th>章节</th><th>已答/总</th><th>正确</th><th>正确率</th><th>单选</th><th>多选</th><th></th></tr></thead><tbody>';
    arr.forEach(function (x) {
      h += '<tr><td>' + x.g.pname + '</td><td>' + esc(x.g.ch) + '</td><td>' + x.s.ans + "/" + x.s.tot + '</td><td>' + x.s.ok + '</td>' +
        '<td><b>' + x.s.acc + '%</b>' + bar(x.s.acc) + '</td>' +
        '<td>' + (x.ss.ans ? x.ss.ok + "/" + x.ss.ans + " (" + x.ss.acc + "%)" : "—") + '</td>' +
        '<td>' + (x.sm.ans ? x.sm.ok + "/" + x.sm.ans + " (" + x.sm.acc + "%)" : "—") + '</td>' +
        '<td><a href="xiao1000.html#' + x.g.sid + '">练习 →</a></td></tr>';
    });
    h += '</tbody></table></div>';
    if (!arr.length) h += '<p class="cs">当前筛选下没有记录。</p>';
    hostTbl.innerHTML = h;
  }
  drawTable();
})();
