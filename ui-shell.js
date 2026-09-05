(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const openDialog = (name, trigger) => {
    const overlay = $('#' + name + '-dialog');
    if (!overlay) return;
    overlay.dataset.returnFocus = trigger?.id || '';
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
  };

  const closeDialog = overlay => {
    if (!overlay) return;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    const trigger = overlay.dataset.returnFocus && $('#' + overlay.dataset.returnFocus);
    trigger?.focus();
  };

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-dialog]');
    if (trigger) {
      if (!trigger.id) trigger.id = 'dialog-trigger-' + Math.random().toString(36).slice(2, 9);
      openDialog(trigger.dataset.dialog, trigger);
      return;
    }

    const close = event.target.closest('[data-close]');
    if (close) {
      closeDialog(close.closest('.overlay'));
      return;
    }

    if (event.target.matches('.overlay')) closeDialog(event.target);

    const accordion = event.target.closest('.acc > button');
    if (accordion) accordion.closest('.acc').classList.toggle('open');
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const overlays = $$('.overlay.show');
    closeDialog(overlays[overlays.length - 1]);
  });
})();
