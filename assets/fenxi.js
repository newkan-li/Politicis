(function () {
  var D = window.FENXI || {}, parts = D.parts || [];
  var params = new URLSearchParams(location.search);
  var cur = Math.max(0, Math.min(parts.length - 1, parseInt(params.get("p"), 10) || 0));
  var tabs = document.getElementById("ftabs"), host = document.getElementById("fhost"), note = document.getElementById("fnote");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]; }); }
  function paras(t) { return String(t || "").split("\n").filter(function (x) { return x.trim(); }).map(function (x) { return "<p>" + esc(x.trim()) + "</p>"; }).join(""); }
  function render() {
    Array.prototype.forEach.call(tabs.children, function (b) { b.className = "vtab" + (b.dataset.p === String(cur) ? " on" : ""); });
    history.replaceState(null, "", "?p=" + cur);
    var o = parts[cur]; if (!o) { host.innerHTML = ""; return; }
    note.innerHTML = "<b>" + esc(D.title || "") + "</b> ｜ " + esc(D.note || "") + " ｜ <a href=\"xiao1000-pages.html#b=0&p=" + o.page + "\" target=\"_blank\">打开原书原页 →</a>";
    var h = '<div class="statsbox" style="margin:8px 0 4px"><b>' + esc(o.name) + '</b> ｜ 共 ' + o.items.length + ' 题 ｜ <a href="xiao1000-pages.html#b=0&p=' + o.page + '" target="_blank">原页 p' + (o.range || o.page) + ' →</a></div>';
    o.items.forEach(function (it) {
      h += '<div class="fx-item">';
      h += '<div class="fx-h">第 ' + esc(it.n) + ' 题 <a href="xiao1000-pages.html#b=0&p=' + o.page + '" target="_blank">原页 p' + (o.range || o.page) + ' →</a></div>';
      if (it.material) {
        h += '<details class="fx-mat"><summary>📄 材料（点击展开）</summary>' + paras(it.material) + '</details>';
      }
      if (it.questions && it.questions.length) {
        h += '<div class="fx-q"><b>问题：</b>' + it.questions.map(function (q) { return '<div>' + esc(q) + '</div>'; }).join("") + '</div>';
      }
      if (it.note && (!it.material || !(it.questions && it.questions.length))) {
        h += '<div class="fx-miss">📖 ' + esc(it.note) + ' ｜ <a href="xiao1000-pages.html#b=0&p=' + o.page + '" target="_blank">看原页</a></div>';
      }
      h += '<details class="fx-ans"><summary>✅ 参考答案（点击展开，先自己写）</summary><div class="fx-ansbody">' + paras(it.answer) + '</div></details>';
      h += '</div>';
    });
    host.innerHTML = h;
  }
  parts.forEach(function (p, i) {
    var b = document.createElement("button"); b.className = "vtab"; b.dataset.p = String(i);
    b.textContent = p.short || p.name; b.onclick = function () { cur = i; render(); window.scrollTo({ top: 0, behavior: "smooth" }); };
    tabs.appendChild(b);
  });
  render();
})();
