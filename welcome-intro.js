(() => {
  'use strict';

  const root = document.documentElement;
  const overlay = document.getElementById('welcome-intro');
  if (!overlay) {
    console.error('Welcome intro overlay is missing from the homepage.');
    return;
  }

  if (root.dataset.welcomeIntro !== 'play') {
    overlay.remove();
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const exitDelay = reducedMotion.matches ? 1100 : 3100;
  const exitDuration = reducedMotion.matches ? 180 : 760;

  window.setTimeout(() => {
    root.classList.add('welcome-leaving');
    window.setTimeout(() => {
      root.classList.remove('welcome-active', 'welcome-leaving');
      root.dataset.welcomeIntro = 'done';
      overlay.remove();
    }, exitDuration);
  }, exitDelay);
})();
