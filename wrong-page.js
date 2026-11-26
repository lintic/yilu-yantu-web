
  var dueOnly = true;
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };

  function fmtDue(ts) {
    var d = new Date(ts);
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  function render() {
    var groups = App.wrongGroups(dueOnly);
    var box = document.getElementById("list");
    var dueCount = App.wrongDueCount();
    document.getElementById("actions").style.display = dueCount ? "flex" : "none";
    document.getElementById("tipline").textContent =
      "以考点为单位回炉：同一考点的错题连着做，做对即考点过关进入下一间隔";
    if (!groups.length) {
      box.innerHTML = '<div class="empty">' +
        (dueOnly ? "暂无到期错题<br>错题会在第 " + App.stages().join("/") + " 天到期，按考点提醒你" : "错题本是空的，去刷几组题吧") + "</div>";
      return;
    }
    box.innerHTML = groups.map(function (g, gi) {
      var isDue = g.due > 0;
      var badge = isDue ? '<span class="g-badge due">' + g.due + ' 题待回炉</span>'
                        : '<span class="g-badge later">未到期</span>';
      var rows = g.items.map(function (w) {
        var showDue = w.due <= Date.now()
          ? '<span class="due-tag">待回炉</span>'
          : '<span class="due-later">' + fmtDue(w.due) + ' 复习</span>';
        var k = App.qKey(w.q);
        return '<div class="q-swipe" data-k="' + esc(k) + '">' +
          '<button class="q-swipe-del" data-k="' + esc(k) + '">移除</button>' +
          '<div class="q-row" data-k="' + esc(k) + '">' +
          '<div class="q-stem">' + esc(w.q.stem.length > 60 ? w.q.stem.slice(0, 60) + "…" : w.q.stem) + '</div>' +
          '<div class="q-meta">' + showDue + '<br>第 ' + (w.stage + 1) + '/' + App.stages().length + ' 轮</div>' +
          '</div></div>';
      }).join("");
      var sub = g.items.length + " 道错题 · 涉及 " +
        Array.from(new Set(g.items.map(function (w) { return w.q.year || "早年"; }))).sort().join("/") +
        " · 最早" + (isDue ? "今天到期" : fmtDue(g.earliest) + "到期");
      return '<div class="g-card" data-gi="' + gi + '">' +
        '<div class="g-head">' +
          '<div class="g-ico' + (isDue ? ' due' : '') + '">' + (isDue ? "!" : g.items.length) + '</div>' +
          '<div class="g-info"><b>' + esc(g.point) + '</b><span>' + esc(sub) + '</span></div>' + badge +
        '</div>' +
        '<div class="g-body">' + rows +
          (isDue ? '<button class="g-review" data-gi="' + gi + '">回炉此考点（' + g.items.length + ' 题）</button>' : '') +
        '</div></div>';
    }).join("");
  }

  /* ---- 移除流程 ---- */
  function removeFlow(k) {
    var q = App.byKey(k);
    if (q && confirm("把这道题移出错题本？\n（答错它还会自动回来）")) {
      App.removeWrong(q);
      render();
    }
  }

  /* 事件：卡片头 → 展开/收起；题目行 → 单题重做；回炉按钮 → 该考点回炉 */
  document.getElementById("list").addEventListener("click", function (e) {
    var delBtn = e.target.closest(".q-swipe-del");
    if (delBtn) {
      e.stopPropagation();
      removeFlow(delBtn.getAttribute("data-k"));
      return;
    }
    var reviewBtn = e.target.closest(".g-review");
    if (reviewBtn) {
      var gi = +reviewBtn.getAttribute("data-gi");
      var g = App.wrongGroups(dueOnly)[gi];
      launch(g.items.map(function (w) { return App.qKey(w.q); }), "考点回炉 · " + g.point);
      return;
    }
    var row = e.target.closest(".q-row");
    if (row && !swipeLock) {
      launch([row.getAttribute("data-k")], "单题重做");
      return;
    }
    var head = e.target.closest(".g-head");
    if (head) head.parentElement.classList.toggle("open");
  });

  /* ---- 手机：左滑移除（iOS 风格） ---- */
  var swipe = null, swipeLock = false;
  var SWIPE_W = 88;
  function closeOpenRow() {
    var open = document.querySelector(".q-row[style*='translate']");
    if (open) open.style.transform = "";
  }
  document.getElementById("list").addEventListener("touchstart", function (e) {
    var row = e.target.closest(".q-row");
    if (!row) return;
    swipe = { row: row, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, open: false };
    row.style.transition = "none";
    swipeLock = false;
  }, { passive: true });
  document.getElementById("list").addEventListener("touchmove", function (e) {
    if (!swipe) return;
    var dx = e.touches[0].clientX - swipe.x;
    var dy = e.touches[0].clientY - swipe.y;
    if (Math.abs(dx) < Math.abs(dy)) return;      // 纵向滚动不触发
    if (dx < 0) {
      swipe.dx = dx;
      swipe.row.style.transform = "translateX(" + Math.max(dx, -SWIPE_W) + "px)";
    }
  }, { passive: true });
  document.getElementById("list").addEventListener("touchend", function () {
    if (!swipe) return;
    var row = swipe.row;
    row.style.transition = "";
    if (swipe.dx < -50) {                          // 滑到位：停住，露出移除
      row.style.transform = "translateX(-" + SWIPE_W + "px)";
      swipeLock = true;                            // 松手后这次不触发单题重做
      setTimeout(function () { swipeLock = false; }, 350);
    } else {
      row.style.transform = "";
      if (swipe.dx < -10) swipeLock = true, setTimeout(function () { swipeLock = false; }, 250);
    }
    swipe = null;
  });

  /* ---- 电脑：右键移除 ---- */
  document.getElementById("list").addEventListener("contextmenu", function (e) {
    var row = e.target.closest(".q-row");
    if (!row) return;
    e.preventDefault();
    removeFlow(row.getAttribute("data-k"));
  });

  function launch(ids, label) {
    if (!ids || !ids.length) return;
    try { sessionStorage.setItem("yilu-return", JSON.stringify("wrong.html?v=20261004")); } catch (e) {}
    sessionStorage.setItem("yilu-launch", JSON.stringify({ ids: ids, mode: "practice", label: label }));
    location.href = "quiz.html?v=20261004";
  }

  document.getElementById("seg-due").addEventListener("click", function () {
    dueOnly = true; this.classList.add("on");
    document.getElementById("seg-all").classList.remove("on"); render();
  });
  document.getElementById("seg-all").addEventListener("click", function () {
    dueOnly = false; this.classList.add("on");
    document.getElementById("seg-due").classList.remove("on"); render();
  });
  document.getElementById("btn-review").addEventListener("click", function () {
    var ids = App.dueIdsGrouped();
    if (!ids.length) return;
    var n = App.wrongGroups(true).length;
    launch(ids, "考点回炉 · " + n + "个考点" + ids.length + "题");
  });
  document.getElementById("btn-export").addEventListener("click", function () {
    var lines = ["#separator:tab", "#html:false"];
    App.wrongGroups(false).forEach(function (g) {
      g.items.forEach(function (w) {
        var q = w.q;
        var back = (App.hasAnswer(q) ? App.ansText(q) + ". " + q.options[Array.isArray(q.answer) ? q.answer[0] : q.answer] + "\n" : "")
          + "考点：" + g.point + "\n" + (q.explain || "");
        lines.push(q.stem.replace(/\t/g, " ") + "\t" + back.replace(/\t/g, " ").replace(/\n/g, " "));
      });
    });
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.download = "医路研途-错题anki.txt";
    a.href = URL.createObjectURL(blob);
    a.click();
  });
  render();

  /* ---- 复习间隔设置 ---- */
  function renderSettings() {
    var st = App.stages();
    document.getElementById("st-input").value = st.join(",");
    document.getElementById("st-show").textContent = st.join("/");
  }
  renderSettings();
  document.getElementById("st-save").addEventListener("click", function () {
    var msg = document.getElementById("st-msg");
    var tokens = document.getElementById("st-input").value.trim().split(/[,，\s]+/);
    var days = tokens.map(Number);
    if (days.length < 2 || days.length > 8 || !tokens.every(function(x) { return /^\d+$/.test(x); }) || !days.every(function(x,i) { return Number.isInteger(x) && x > 0 && x <= 365 && (!i || x > days[i-1]); })) {
      msg.textContent = "请填 2–8 个递增的整数天数（1–365），用逗号分隔";
      msg.className = "msg err"; return;
    }
    var s = App.settingsLoad(); s.stages = days;
    App.settingsSave(s);
    renderSettings(); render();
    msg.textContent = "已保存：" + days.join("/") + " 天，后续复习按新间隔排期";
    msg.className = "msg ok";
  });
  document.getElementById("st-reset").addEventListener("click", function () {
    var s = App.settingsLoad(); s.stages = null;
    App.settingsSave(s);
    document.getElementById("st-input").value = App.stages().join(",");
    renderSettings(); render();
    var msg = document.getElementById("st-msg");
    msg.textContent = "已恢复默认 " + App.stages().join("/");
    msg.className = "msg ok";
  });
