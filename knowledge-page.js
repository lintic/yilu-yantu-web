

  var KB = window.KNOWLEDGE || [];

  var view = "browse";           // browse | review

  var year = null, kw = "";

  var st = App.stages();



  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function hl(text) {

    if (!kw) return esc(text);

    var safe = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return esc(text).replace(new RegExp(safe, "gi"), function (m) { return "<mark>" + m + "</mark>"; });

  }

  function byId(id) { for (var i = 0; i < KB.length; i++) if (KB[i].id === id) return KB[i]; return null; }



  /* ================= 浏览 ================= */

  function renderBrowse() {

    var l1 = document.getElementById("l1"), l2 = document.getElementById("l2");

    var crumb = document.getElementById("crumb");

    if (year == null) {

      document.getElementById("title").textContent = "知识点手册";

      crumb.style.display = "none";

      l1.style.display = "grid"; l2.style.display = "none";

      var years = [];

      KB.forEach(function (g) { if (years.indexOf(g.year) < 0) years.push(g.year); });

      years.sort(function (a, b) { return b - a; });

      l1.innerHTML = years.map(function (y) {

        var n = KB.filter(function (g) { return g.year === y; }).length;

        return '<div class="y-card" data-y="' + y + '"><div class="s-arrow">›</div><div class="y-num">' + y + '</div>' +

               '<b>真题考点提炼</b><div class="y-sub">' + n + ' 个知识点</div></div>';

      }).join("");

      return;

    }

    document.getElementById("title").textContent = year + " 年真题考点";

    crumb.style.display = "inline";

    l1.style.display = "none"; l2.style.display = "block";

    var groups = KB.filter(function (g) { return g.year === year; });

    if (kw) groups = groups.filter(function (g) { return g.text.indexOf(kw) >= 0; });

    groups.sort(function (a, b) { return a.no - b.no; });

    document.getElementById("count").textContent =

      "共 " + groups.length + " 组考点（按原版 PDF 顺序编号）" + (kw ? " · 含“" + kw + "”" : "");

    var box = document.getElementById("list");

    if (!groups.length) {

      box.innerHTML = '<div class="empty"><span class="ico">🔍</span>没有匹配的考点<br>换个关键词试试</div>';

      return;

    }

    box.innerHTML = groups.map(function (g) {

      var prev = g.text.replace(/\n/g, " ").slice(0, 46);

      return '<div class="g-item" data-id="' + g.id + '">' +

        '<div class="g-head"><span class="g-num">' + g.no + '</span>' +

        '<span class="g-prev">' + hl(prev) + '</span><span class="g-arrow">›</span></div>' +

        '<div class="g-body">' + hl(g.text) + (g.source?'<p class="muted" style="font-size:12px;margin-top:14px">来源：'+esc(g.source.label)+' · PDF 第 '+(g.source.pages||[]).join('、')+' 页</p>':'') + '</div></div>';

    }).join("");

  }



  document.getElementById("l1").addEventListener("click", function (e) {

    var c = e.target.closest(".y-card"); if (!c) return;

    year = +c.getAttribute("data-y"); renderBrowse();

  });

  document.getElementById("crumb").addEventListener("click", function () { year = null; kw = ""; document.getElementById("q").value = ""; renderBrowse(); });

  var timer;

  document.getElementById("q").addEventListener("input", function () {

    clearTimeout(timer);

    var self = this;

    timer = setTimeout(function () { kw = self.value.trim(); renderBrowse(); }, 200);

  });

  document.getElementById("list").addEventListener("click", function (e) {

    var head = e.target.closest(".g-head");

    if (head) head.parentElement.classList.toggle("open");

  });



  /* ================= 背复习 ================= */

  var queue = [], qi = 0, revealed = false, graded = 0, sessionOk = 0;



  function buildQueue() {

    var data = App.kpData();

    var now = Date.now();

    var due = [], fresh = [];

    KB.forEach(function (g) {

      var e = data[g.id];

      if (e && !e.graduated && e.due <= now) due.push(g);

      else if (!e) fresh.push(g);

    });

    due.sort(function (a, b) { return a.no - b.no; });

    fresh.sort(function (a, b) { return a.no - b.no; });

    return due.concat(fresh.slice(0, App.kpNewRemaining()));

  }



  function renderReview() {

    var box = document.getElementById("review");

    document.getElementById("title").textContent = "知识卡片复习";

    var data = App.kpData();

    var now = Date.now();

    var dueCount = 0, freshCount = 0, learning = 0;

    KB.forEach(function (g) {

      var e = data[g.id];

      if (!e) freshCount++;

      else if (!e.graduated && e.due <= now) dueCount++;

      else if (!e.graduated) learning++;

    });

    if (!queue.length) queue = buildQueue();



    if (qi >= queue.length) {

      box.innerHTML =

        '<div class="due-line">' +

          '<div class="due-box"><b>' + dueCount + '</b><span>待复习</span></div>' +

          '<div class="due-box coral"><b>' + freshCount + '</b><span>新知识点（每日最多 ' + App.KP_NEW_LIMIT + '）</span></div>' +

          '<div class="due-box"><b>' + learning + '</b><span>记忆中</span></div>' +

        '</div>' +

        '<div class="kcard"><div class="kc-hint">' +

          (graded ? "本轮完成 ✓ 自评 " + graded + " 条" : "今天没有到期的考点卡片") +

          '<br>每天按额度学习新知识点，到期卡片优先复习。</div></div>' +

        '<div class="kc-actions"><button class="btn btn-g" id="btn-reshuffle">重新检查队列</button></div>';

      document.getElementById("btn-reshuffle").addEventListener("click", function () {

        queue = []; qi = 0; graded = 0; sessionOk = 0; renderReview();

      });

      return;

    }



    var g = queue[qi];

    var e = data[g.id];

    var stageTxt = e ? ("第 " + Math.min(e.stage + 1, st.length) + "/" + st.length + " 轮") : "新知识点";

    box.innerHTML =

      '<div class="kcard">' +

        '<div class="kc-head"><span class="kc-q">No.' + g.no + '</span>' +

        '<span class="kc-year">' + g.year + ' 年真题 · ' + stageTxt + '</span>' +

        '<span style="flex:1"></span><span class="kc-year">' + (qi + 1) + '/' + queue.length + '</span></div>' +

        '<div class="kc-body">' + (revealed ? esc(g.text) : '<span style="color:var(--ink-soft)">考点线索：' + esc(g.text.split(/[：:。；\n]/)[0].slice(0, 25)) + '…<br><small>先回忆要点，再显示全文对照自评。</small></span>') + '</div>' +

      '</div>' +

      '<div class="kc-actions" id="kc-actions"></div>' +

      '<div class="kc-actions"><button class="btn btn-g" id="btn-prev-card" style="flex:0 0 100%' +

        (qi === 0 ? ";display:none" : "") + '">‹ 上一条</button></div>';

    var acts = document.getElementById("kc-actions");

    if (!revealed) {

      var show = document.createElement("button");

      show.className = "btn btn-p"; show.textContent = "显示考点";

      show.addEventListener("click", function () { revealed = true; renderReview(); });

      acts.appendChild(show);

    } else {

      var bad = document.createElement("button");

      bad.className = "btn btn-no"; bad.textContent = "忘了 · 再复习";

      bad.addEventListener("click", function () { grade(false); });

      var ok = document.createElement("button");

      ok.className = "btn btn-ok"; ok.textContent = "记得 · 继续";

      ok.addEventListener("click", function () { grade(true); });

      acts.appendChild(bad); acts.appendChild(ok);

    }

    document.getElementById("btn-prev-card").addEventListener("click", function () {

      if (qi > 0) { qi--; revealed = false; renderReview(); }

    });

  }



  function grade(ok) {

    var g = queue[qi];

    var saved = App.kpGrade(g.id, ok);
    if (saved === null) { UI.toast("复习记录未保存，请释放空间后重试或导出学习备份"); return; }
    if (saved === false) { UI.toast("今天的新知识点额度已用完"); queue = []; qi = 0; renderReview(); return; }

    graded++; if (ok) sessionOk++;

    qi++; revealed = false;

    renderReview();

  }



/* ================= 切换 ================= */

  function setView(v) {

    view = v;

    document.getElementById("browse").style.display = v === "browse" ? "block" : "none";

    document.getElementById("review").style.display = v === "review" ? "block" : "none";

    document.getElementById("seg-browse").classList.toggle("on", v === "browse");

    document.getElementById("seg-review").classList.toggle("on", v === "review");

    if (v === "review") { queue = []; qi = 0; graded = 0; sessionOk = 0; revealed = false; renderReview(); }

    else renderBrowse();

  }

  document.getElementById("seg-browse").addEventListener("click", function () { setView("browse"); });

  document.getElementById("seg-review").addEventListener("click", function () { setView("review"); });



  renderBrowse();

