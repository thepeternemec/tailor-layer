(() => {
  'use strict';
  const style = document.createElement('style');
  style.textContent = '[data-motion]{opacity:0;transform:translateY(20px);transition:opacity .68s ease,transform .76s cubic-bezier(.16,1,.3,1)}[data-motion].motion-in{opacity:1;transform:none}.outcome-card[data-motion]:nth-child(2){transition-delay:.06s}.outcome-card[data-motion]:nth-child(3){transition-delay:.12s}.outcome-card[data-motion]:nth-child(4){transition-delay:.18s}@media(prefers-reduced-motion:reduce){[data-motion]{opacity:1;transform:none;transition:none}}';
  document.head.append(style);

  const motion = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('motion-in');
      motion.unobserve(entry.target);
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.scanner,.outcome-card,.scope-ribbon,.open-source-inner,.footer-closure').forEach(element => {
    element.dataset.motion = '';
    motion.observe(element);
  });
})();
