(() => {
  'use strict';

  const headingSelector = 'h1, h2, h3, h4, h5, h6';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches || !('IntersectionObserver' in window)) return;

  const wordClass = 'heading-reveal-word';
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      entry.target.classList.toggle('is-in-view', entry.isIntersecting);
    });
  }, {
    threshold: 0,
    rootMargin: '0px 0px -8% 0px'
  });

  function prepareHeading(heading) {
    if (heading.dataset.headingRevealReady !== 'true') {
      heading.dataset.headingRevealReady = 'true';
      heading.classList.add('heading-reveal-ready');
      observer.observe(heading);
    }

    const text = heading.textContent.replace(/\s+/g, ' ').trim();
    if (!heading.hasAttribute('aria-label') || heading.dataset.headingGeneratedLabel === 'true') {
      heading.setAttribute('aria-label', text);
      heading.dataset.headingGeneratedLabel = 'true';
    }

    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent.trim() && !node.parentElement?.classList.contains(wordClass)) {
        textNodes.push(node);
      }
    }

    textNodes.forEach(node => {
      const fragment = document.createDocumentFragment();
      const parts = node.textContent.split(/(\s+)/);
      let wordIndex = heading.querySelectorAll(`.${wordClass}`).length;
      parts.forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          fragment.append(document.createTextNode(part));
          return;
        }

        const word = document.createElement('span');
        word.className = wordClass;
        word.style.setProperty('--word-delay', `${Math.min(wordIndex * 32, 352)}ms`);
        word.setAttribute('aria-hidden', 'true');
        word.textContent = part;
        fragment.append(word);
        wordIndex += 1;
      });
      node.replaceWith(fragment);
    });
  }

  function prepareSubtree(root) {
    if (!(root instanceof Element)) return;
    if (root.matches(headingSelector)) prepareHeading(root);
    root.querySelectorAll(headingSelector).forEach(prepareHeading);
  }

  prepareSubtree(document.body);

  const mutations = new MutationObserver(records => {
    records.forEach(record => {
      if (record.target instanceof Element && record.target.matches(headingSelector)) {
        prepareHeading(record.target);
      }
      record.addedNodes.forEach(prepareSubtree);
    });
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  reducedMotion.addEventListener('change', event => {
    if (event.matches) {
      mutations.disconnect();
      observer.disconnect();
      document.querySelectorAll('.heading-reveal-ready').forEach(heading => {
        heading.classList.add('is-in-view');
      });
    }
  });
})();
