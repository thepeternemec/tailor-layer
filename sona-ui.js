(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const includeRoot = (selector, root = document) => [
    ...(root.nodeType === 1 && root.matches(selector) ? [root] : []),
    ...$$(selector, root)
  ];

  const enhanceInteractiveElements = (root = document) => {
    includeRoot('.button, .toolbar-github, .icon-btn', root).forEach(element => {
      if (element.dataset.sonaMagnetic !== undefined) return;
      element.dataset.sonaMagnetic = '';
    });
  };

  enhanceInteractiveElements();
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1) enhanceInteractiveElements(node);
    }));
  }).observe(document.body, { childList: true, subtree: true });

  if (!reduceMotion) {
    document.addEventListener('pointermove', event => {
      const target = event.target.closest('[data-sona-magnetic]');
      if (!target || event.pointerType !== 'mouse') return;
      const rect = target.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const range = Math.max(70, Math.max(rect.width, rect.height) * .8);
      const pull = Math.max(0, 1 - distance / range) * .13;
      target.style.setProperty('--sona-magnetic-x', `${dx * pull}px`);
      target.style.setProperty('--sona-magnetic-y', `${dy * pull}px`);
    });
    document.addEventListener('pointerout', event => {
      const target = event.target.closest('[data-sona-magnetic]');
      if (!target || target.contains(event.relatedTarget)) return;
      target.style.setProperty('--sona-magnetic-x', '0px');
      target.style.setProperty('--sona-magnetic-y', '0px');
    });
  }

  document.addEventListener('pointerdown', event => {
    const target = event.target.closest('[data-sona-magnetic]');
    if (!target || reduceMotion || target.disabled) return;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'sona-ripple';
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    target.append(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  });

  const aurora = $('.aurora');
  const scrollProgress = document.createElement('div');
  scrollProgress.className = 'sona-scroll-progress';
  scrollProgress.setAttribute('aria-hidden', 'true');
  document.body.append(scrollProgress);
  if (aurora && !reduceMotion) {
    const mesh = { x: 50, y: 26, targetX: 50, targetY: 26, moving: false };
    const drawMesh = () => {
      mesh.x += (mesh.targetX - mesh.x) * .085;
      mesh.y += (mesh.targetY - mesh.y) * .085;
      aurora.style.setProperty('--sona-mesh-x', `${mesh.x.toFixed(2)}%`);
      aurora.style.setProperty('--sona-mesh-y', `${mesh.y.toFixed(2)}%`);
      if (Math.abs(mesh.targetX - mesh.x) + Math.abs(mesh.targetY - mesh.y) > .04) {
        requestAnimationFrame(drawMesh);
      } else {
        mesh.moving = false;
      }
    };
    document.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      mesh.targetX = Math.max(8, Math.min(92, event.clientX / innerWidth * 100));
      mesh.targetY = Math.max(8, Math.min(86, event.clientY / innerHeight * 100));
      if (!mesh.moving) {
        mesh.moving = true;
        requestAnimationFrame(drawMesh);
      }
    }, { passive: true });
  }

  const updateScrollMotion = () => {
    const maximum = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const progress = Math.max(0, Math.min(1, scrollY / maximum));
    scrollProgress.style.setProperty('--sona-scroll-progress', progress);
    if (aurora && !reduceMotion) aurora.style.setProperty('--sona-mesh-shift', `${Math.min(70, scrollY * .035)}px`);
  };
  addEventListener('scroll', updateScrollMotion, { passive: true });
  addEventListener('resize', updateScrollMotion, { passive: true });
  updateScrollMotion();

  const spotlightSelector = '.sona-spotlight, .outcome-card, .scope-ribbon, .open-source-inner, .scan-action';
  document.addEventListener('pointermove', event => {
    const card = event.target.closest(spotlightSelector);
    if (!card || event.pointerType !== 'mouse') return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--sona-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--sona-y', `${event.clientY - rect.top}px`);
    card.style.setProperty('--sona-spotlight-opacity', '1');
  });
  document.addEventListener('pointerout', event => {
    const card = event.target.closest(spotlightSelector);
    if (!card || card.contains(event.relatedTarget)) return;
    card.style.setProperty('--sona-spotlight-opacity', '0');
  });

  const splitHeading = heading => {
    if (reduceMotion || heading.dataset.sonaSplit !== undefined) return;
    const text = heading.textContent.trim();
    heading.dataset.sonaSplit = '';
    heading.setAttribute('aria-label', text);
    heading.textContent = '';
    text.split(/\s+/).forEach((word, index, words) => {
      const mask = document.createElement('span');
      const inner = document.createElement('span');
      mask.className = 'sona-word-mask';
      inner.className = 'sona-word';
      inner.setAttribute('aria-hidden', 'true');
      inner.textContent = word;
      inner.style.transitionDelay = `${Math.min(index * 45, 360)}ms`;
      mask.append(inner);
      heading.append(mask);
      if (index < words.length - 1) {
        const space = document.createElement('span');
        space.className = 'sona-word-space';
        space.setAttribute('aria-hidden', 'true');
        heading.append(space);
      }
    });
    splitObserver.observe(heading);
  };
  const splitObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('sona-split-visible');
      splitObserver.unobserve(entry.target);
    });
  }, { threshold: .2 });
  $$('.context-head h2, .open-source-inner h2').forEach(splitHeading);

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('sona-in');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .1, rootMargin: '0px 0px -7% 0px' });
  const revealElements = (root = document) => {
    const selector = '.context-head > *, .outcome-card, .scope-ribbon, .open-source-inner > *, .footer-closure .unified-footer-top > *, .scan-results > *';
    includeRoot(selector, root).forEach((element, index) => {
      if (element.classList.contains('sona-scroll-item')) return;
      element.classList.add('sona-scroll-item');
      element.style.setProperty('--sona-reveal-delay', `${Math.min(index % 4 * 70, 210)}ms`);
      if (reduceMotion) element.classList.add('sona-in');
      else revealObserver.observe(element);
    });
  };
  revealElements();

  const animateCounters = (root = document) => {
    includeRoot('[data-sona-count]', root).forEach(element => {
      if (element.dataset.sonaCounted !== undefined) return;
      element.dataset.sonaCounted = '';
      const target = Number(element.dataset.sonaCount);
      if (!Number.isFinite(target) || reduceMotion) return;
      const started = performance.now();
      const tick = now => {
        const progress = Math.min(1, (now - started) / 720);
        const eased = 1 - Math.pow(1 - progress, 4);
        element.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      element.textContent = '0';
      requestAnimationFrame(tick);
    });
  };
  animateCounters();
  addEventListener('tailorlayer:review-ready', () => requestAnimationFrame(() => {
    const results = $('#scan-results');
    if (!results) return;
    enhanceInteractiveElements(results);
    revealElements(results);
    animateCounters(results);
  }));

  const updateFluidIndicator = list => {
    const active = $('.active', list);
    if (!active) return;
    list.style.setProperty('--sona-tab-x', `${active.offsetLeft}px`);
    list.style.setProperty('--sona-tab-width', `${active.offsetWidth}px`);
    list.style.setProperty('--sona-tab-height', `${active.offsetHeight}px`);
  };
  $$('.score-tabs').forEach(list => {
    requestAnimationFrame(() => updateFluidIndicator(list));
    list.addEventListener('click', () => requestAnimationFrame(() => updateFluidIndicator(list)));
  });
  addEventListener('resize', () => $$('.score-tabs').forEach(updateFluidIndicator), { passive: true });

  const workspaceTabs = $$('.workspace-tabs [data-workspace-tab]');
  workspaceTabs.forEach(tab => tab.addEventListener('click', () => {
    workspaceTabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    const results = $('.scan-results:not([hidden])');
    if (tab.dataset.workspaceTab === 'review') {
      $('#scan-input')?.focus({ preventScroll: true });
      $('#scanner')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (results) {
      results.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    } else {
      const status = $('#scan-status');
      if (status) status.textContent = 'Run a review first to open evidence and the launch plan.';
      $('#scan-input')?.focus();
    }
  }));

  $$('.sona-dropdown').forEach(dropdown => {
    const trigger = $('.sona-dropdown-trigger', dropdown);
    const menu = $('.sona-dropdown-menu', dropdown);
    const setOpen = open => {
      dropdown.classList.toggle('open', open);
      trigger.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-hidden', String(!open));
      if (open) requestAnimationFrame(() => $('[role="menuitem"]', menu)?.focus());
    };
    trigger.addEventListener('click', event => {
      event.stopPropagation();
      setOpen(!dropdown.classList.contains('open'));
    });
    menu.addEventListener('keydown', event => {
      const items = $$('[role="menuitem"]', menu);
      const current = items.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        items[(current + direction + items.length) % items.length]?.focus();
      }
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.focus();
      }
    });
    document.addEventListener('click', event => {
      if (!dropdown.contains(event.target)) setOpen(false);
    });
  });

  let previousFocus = null;
  $$('.overlay').forEach(overlay => {
    overlay.setAttribute('aria-hidden', overlay.classList.contains('show') ? 'false' : 'true');
    const observer = new MutationObserver(() => {
      const open = overlay.classList.contains('show');
      overlay.setAttribute('aria-hidden', String(!open));
      document.body.classList.toggle('sona-dialog-open', $$('.overlay.show').length > 0);
      if (open) {
        previousFocus = document.activeElement;
        requestAnimationFrame(() => $('.icon-btn, button, a, input, textarea', overlay)?.focus());
      } else if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
      }
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const openOverlays = $$('.overlay.show');
    const overlay = openOverlays[openOverlays.length - 1];
    if (!overlay) return;
    const focusable = $$('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', overlay)
      .filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();
