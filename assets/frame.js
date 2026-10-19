(function () {
  var F = window.FRAMES || {}, keys = Object.keys(F);
  var params = new URLSearchParams(location.search);
  var cur = params.get("s") || keys[0] || "xsx";
  if (keys.indexOf(cur) < 0) cur = keys[0];
  var tabs = document.getElementById("ftabs"), note = document.getElementById("fnote"), host = document.getElementById("fhost");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]; }); }
  function li(arr) { return (arr || []).map(function (x) { return "<li>" + x + "</li>"; }).join(""); }
  function render() {
    Array.prototype.forEach.call(tabs.children, function (b) { b.className = "vtab" + (b.dataset.s === cur ? " on" : ""); });
    history.replaceState(null, "", "?s=" + cur);
    var o = F[cur]; if (!o) { host.innerHTML = ""; return; }
    note.innerHTML = "<b>" + esc(o.title) + "</b> ｜ " + esc(o.sub) + (o.note ? "<br><span style=\"font-size:12.5px;color:var(--sub)\">" + esc(o.note) + "</span>" : "");
    var chips = '<div class="fchips">' + o.chapters.map(function (c, i) { return '<a href="#c-' + cur + "-" + i + '">' + esc(c.t.replace(/^第[一二三四五六七八九十]+章\s*/, "").slice(0, 12)) + '</a>'; }).join("") + '</div>';
    var html = chips;
    o.chapters.forEach(function (c, i) {
      html += '<section class="sec frame-sec" id="c-' + cur + "-" + i + '">';
      html += '<h2>' + esc(c.t) + '</h2>';
      html += '<p class="fexam"><b>考法：</b>' + esc(c.exam) + '</p>';
      if (c.time) html += '<div class="ftime">' + c.time.map(function (t) { return '<span><b>' + esc(t[0]) + '</b> ' + esc(t[1]) + '</span>'; }).join("") + '</div>';
      html += '<div class="fgrid"><div class="fbox"><h3>🧭 框架</h3><ul>' + li(c.frame) + '</ul></div><div class="fbox"><h3>📌 核心考点</h3><ul>' + li(c.points) + '</ul></div></div>';
      if (c.compare && c.compare.length) {
        html += '<table class="ftbl"><tbody>' + c.compare.map(function (r) { return '<tr>' + r.map(function (x, j) { return '<td' + (j === 0 ? ' class="fk"' : '') + '>' + esc(x) + '</td>'; }).join("") + '</tr>'; }).join("") + '</tbody></table>';
      }
      if (c.mem) html += '<p class="fmem">🧠 ' + esc(c.mem) + '</p>';
      if (c.q) html += '<p class="fquiz">对应肖1000：' + c.q.map(function (sid) { var n = parseInt(sid.split("_s")[1], 10); var nm = n % 2 === 0 ? "单项选择" : "多项选择"; return '<a href="xiao1000.html#' + sid + '">' + nm + ' →</a>'; }).join(" ｜ ") + '</p>';
      html += '</section>';
    });
    host.innerHTML = html;
  }
  keys.forEach(function (k) {
    var b = document.createElement("button"); b.className = "vtab"; b.dataset.s = k;
    b.textContent = (k === "xsx" ? "新思想" : k === "sg" ? "史纲" : "思修");
    b.onclick = function () { cur = k; render(); window.scrollTo({ top: 0, behavior: "smooth" }); };
    tabs.appendChild(b);
  });
  render();
})();
