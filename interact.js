/* ═══ 医路研途 · 交互增强 ═══
   横向胶囊条（.chips）在电脑上支持：
   1. 按住鼠标左键拖拽滚动
   2. 鼠标悬停时滚轮直接横向滚 */
(function () {
  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    document.querySelectorAll(".chips").forEach(setup);
  }

  function setup(el) {
    var down = false, startX = 0, startLeft = 0, moved = false;

    el.addEventListener("mousedown", function (e) {
      down = true; moved = false;
      startX = e.pageX; startLeft = el.scrollLeft;
      el.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mouseup", function () {
      down = false; el.style.cursor = "";
    });
    window.addEventListener("mousemove", function (e) {
      if (!down) return;
      var dx = e.pageX - startX;
      if (Math.abs(dx) > 4) moved = true;
      el.scrollLeft = startLeft - dx;
    });
    // 拖拽后松手，避免误触发胶囊点击
    el.addEventListener("click", function (e) {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    }, true);

    // 悬停滚轮 → 横向滚
    el.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    el.style.cursor = "grab";
  }
})();
