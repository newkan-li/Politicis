(function(){
  if(window.__authGate)return;window.__authGate=true;
  var SALT_B64="jXqv5K7RiUGQOd4cwj8AXA==";
  var ITER=600000;
  var DK_B64="VtLRsR+dNr4pnWAcktJWOOH2M22fWUUkKN5qU09lUIM=";
  var KEY="politics_auth";
  function b64(s){return Uint8Array.from(atob(s),function(c){return c.charCodeAt(0);});}
  function bytesEqual(a,b){if(a.length!==b.length)return false;var d=0;for(var i=0;i<a.length;i++){d|=a[i]^b[i];}return d===0;}
  function derive(pw){
    var enc=new TextEncoder();
    return crypto.subtle.importKey("raw",enc.encode(pw),{name:"PBKDF2"},false,["deriveBits"])
      .then(function(k){return crypto.subtle.deriveBits({name:"PBKDF2",salt:b64(SALT_B64),iterations:ITER,hash:"SHA-256"},k,256);})
      .then(function(bits){return new Uint8Array(bits);});
  }
  function boot(){
    if(document.getElementById("gate"))return;
    var authed=false;
    try{authed=sessionStorage.getItem(KEY)==="1";}catch(e){}
    var st=document.createElement("style");
    st.textContent="#gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#1f5c8b,#12324d);padding:20px}"
      +"#gate.hide{display:none}#gate .gatebox{background:#fff;color:#222;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.35);padding:28px 26px;width:100%;max-width:360px}"
      +"#gate h2{margin:0 0 4px;font-size:19px}#gate p.sub{margin:0 0 18px;font-size:13px;color:#666}"
      +"#gate input[type=password]{width:100%;box-sizing:border-box;padding:11px 12px;font-size:16px;border:1px solid #cbd5e1;border-radius:9px;outline:none}"
      +"#gate input[type=password]:focus{border-color:#1f5c8b;box-shadow:0 0 0 3px rgba(31,92,139,.15)}"
      +"#gate button{width:100%;margin-top:14px;padding:11px;font-size:16px;border:0;border-radius:9px;background:#1f5c8b;color:#fff;cursor:pointer}"
      +"#gate button:disabled{opacity:.6;cursor:default}#gate .err{margin-top:12px;font-size:13px;color:#c0392b;min-height:18px}"
      +"#gate .hint{margin-top:10px;font-size:12px;color:#94a3b8;text-align:center}body.locked{overflow:hidden}";
    document.head.appendChild(st);
    var gate=document.createElement("div");gate.id="gate";
    gate.innerHTML='<form class="gatebox" id="gateform" autocomplete="off"><h2>🔒 '+(document.title||"需要密码")+'</h2><p class="sub">请输入访问密码</p><input type="password" id="gatepw" placeholder="密码" autofocus><button type="submit" id="gatebtn">进入</button><div class="err" id="gateerr"></div><div class="hint">本站仅限授权访问</div></form>';
    document.body.appendChild(gate);
    document.body.classList.add("locked");
    if(authed){gate.classList.add("hide");document.body.classList.remove("locked");return;}
    var form=document.getElementById("gateform"),pw=document.getElementById("gatepw"),err=document.getElementById("gateerr"),btn=document.getElementById("gatebtn");
    form.addEventListener("submit",function(e){
      e.preventDefault();err.textContent="";
      if(!window.crypto||!crypto.subtle){err.textContent="当前环境不支持加密校验，请用 localhost 或 https 打开。";return;}
      if(!pw.value){err.textContent="请输入密码";return;}
      btn.disabled=true;btn.textContent="验证中…";
      derive(pw.value).then(function(got){
        if(bytesEqual(got,b64(DK_B64))){try{sessionStorage.setItem(KEY,"1");}catch(e){}gate.classList.add("hide");document.body.classList.remove("locked");}
        else{err.textContent="密码错误，请重试";pw.value="";pw.focus();}
        btn.disabled=false;btn.textContent="进入";
      }).catch(function(){err.textContent="验证失败，请重试";btn.disabled=false;btn.textContent="进入";});
    });
  }
  if(document.body)boot();else document.addEventListener("DOMContentLoaded",boot);
})();
