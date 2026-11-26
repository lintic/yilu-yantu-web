/* 首页独立初始化：倒计时无需等待题库加载。 */
(function () {
  'use strict';
  var counter = document.getElementById('home-days');
  var hero = document.querySelector('.hero');
  if (!counter || !hero) return;
  var target = Date.parse(counter.dataset.examTarget), visible = true, timer;
  function refresh() {
    clearTimeout(timer);
    var now = Date.now(), days = Math.max(0, Math.ceil((target - now) / 86400000));
    counter.textContent = Number.isFinite(days) ? String(days) : '—';
    hero.classList.toggle('motion-paused', document.hidden || !visible);
    // Refresh only when the displayed day changes; no per-second timer.
    if (!document.hidden && days > 0) {
      var next = target - (days - 1) * 86400000 - now;
      timer = setTimeout(refresh, Math.max(1000, next + 100));
    }
  }
  document.addEventListener('visibilitychange', refresh);
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      hero.classList.toggle('motion-paused', document.hidden || !visible);
    });
    observer.observe(hero);
  }
  refresh();
})();
