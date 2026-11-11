(() => {
  'use strict';

  const toggle = document.querySelector('.nav-menu-toggle');
  const navigation = document.getElementById('primary-navigation');
  if (!toggle || !navigation) return;

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    navigation.classList.toggle('is-open', open);
  }

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  navigation.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('click', event => {
    if (event.target instanceof Element && !event.target.closest('.navbar')) setOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setOpen(false);
  });

  const desktopBreakpoint = window.matchMedia('(min-width: 1025px)');
  const resetOnDesktop = event => {
    if (event.matches) setOpen(false);
  };
  if (desktopBreakpoint.addEventListener) {
    desktopBreakpoint.addEventListener('change', resetOnDesktop);
  } else {
    desktopBreakpoint.addListener(resetOnDesktop);
  }
})();
