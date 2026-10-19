(function () {
  var B = window.BOOKS || [], PFX = "pol_";
  function jget(n, d) { try { var v = JSON.parse(localStorage.getItem(PFX + n)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(n, v) { try { localStorage.setItem(PFX + n, JSON.stringify(v)); } catch (e) { } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]; }); }
  var S = jget("books", {});
  function has(b) { return Object.prototype.hasOwnProperty.call(S, b.id) ? !!S[b.id] : !!b.have; }
  var F = { p: "all", st: "all" };
  var host = document.getElementById("bhost"), sum = document.getElementById("bsum"), ctl = document.getElementById("bctl");
  function q(name) { return "https://search.jd.com/Search?keyword=" + encodeURIComponent(name) + "&enc=utf-8"; }
  function d(name) { return "https://search.dangdang.com/?key=" + encodeURIComponent(name); }
  function row(b) {
    var have = has(b), links = "";
    if (b.free) {
      links = '<a href="https://www.gov.cn/" target="_blank" rel="noopener">官方</a> · <a href="https://www.xuexi.cn/" target="_blank" rel="noopener">学习强国</a>';
    } else {
      links = (b.id === "jjjl" ? '<a href="jingjiang.html">站内精讲 →</a> · ' : '') + '<a href="' + q(b.t) + '" target="_blank" rel="noopener">京东</a> · <a href="' + d(b.t) + '" target="_blank" rel="noopener">当当</a> · <a href="https://www.nlc.cn/" target="_blank" rel="noopener">国图</a> · <a href="https://www.chaoxing.com/" target="_blank" rel="noopener">超星</a>';
    }
    return '<div class="bkrow' + (have ? ' have' : '') + '"><label class="bkcheck"><input type="checkbox" data-id="' + b.id + '"' + (have ? ' checked' : '') + '></label>' +
      '<div><div class="bktitle"><span class="bkp ' + b.p + '">' + b.p + '</span> ' + esc(b.t) + ' <span class="bktag">' + esc(b.tag) + '</span></div>' +
      '<div class="bkmeta"><b>用途：</b>' + esc(b.use) + ' ｜ ' + esc(b.note) + '</div>' +
      '<div class="bklinks">' + links + '</div></div>' +
      '<div class="bkstate">' + (have ? '✅ 已有' : '⬜ 缺') + '</div></div>';
  }
  function counts() {
    var h = 0, sp = 0;
    B.forEach(function (b) { if (has(b)) h++; if (b.p === "P1" && !has(b)) sp++; });
    return { h: h, t: B.length, m: B.length - h, sp: sp };
  }
  function render() {
    var c = counts();
    sum.innerHTML = '<b>已有 ' + c.h + ' / ' + c.t + '</b> ｜ 缺 <b class="miss">' + c.m + '</b> ｜ 冲刺必补还缺 <b class="miss">' + c.sp + '</b> ｜ 完成度 ' + Math.round(c.h / c.t * 100) + '%<div class="sbar" style="margin-top:6px"><i style="width:' + Math.round(c.h / c.t * 100) + '%"></i></div>' +
      '<div class="bklegend"><span class="bkp P0">P0</span>现在/已有 <span class="bkp P1">P1</span>冲刺必补 <span class="bkp P2">P2</span>可选 <span class="bkp 免费">免费</span>官方免费</div>';
    ctl.innerHTML = '<select id="bp" class="wsel"><option value="all">全部优先级</option><option value="P0">P0 现在/已有</option><option value="P1">P1 冲刺必补</option><option value="P2">P2 可选</option><option value="免费">免费官方</option></select>' +
      '<select id="bst" class="wsel"><option value="all">全部状态</option><option value="miss">只看缺</option><option value="have">只看已有</option></select>' +
      '<button class="navbtn" id="breset">重置</button><button class="navbtn" id="bprint">打印清单</button>';
    document.getElementById("bp").value = F.p; document.getElementById("bst").value = F.st;
    document.getElementById("bp").onchange = function () { F.p = this.value; draw(); };
    document.getElementById("bst").onchange = function () { F.st = this.value; draw(); };
    document.getElementById("breset").onclick = function () { if (confirm("重置所有勾选？")) { S = {}; jset("books", S); render(); } };
    document.getElementById("bprint").onclick = function () { window.print(); };
    draw();
  }
  function draw() {
    var rows = B.filter(function (b) {
      if (F.p !== "all" && b.p !== F.p) return false;
      if (F.st === "miss" && has(b)) return false;
      if (F.st === "have" && !has(b)) return false;
      return true;
    });
    host.innerHTML = rows.map(row).join("") || '<p class="cs">当前筛选下没有书目。</p>';
    host.querySelectorAll("input[data-id]").forEach(function (cb) {
      cb.onchange = function () { S[cb.dataset.id] = cb.checked; jset("books", S); render(); };
    });
  }
  render();
})();
