(() => {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    #score-dialog{z-index:70}.score-dialog{width:min(1040px,100%)!important;max-width:1040px!important;padding:30px!important;background:linear-gradient(145deg,#101010,#080808)!important}
    .score-dialog-top{align-items:flex-start}.score-dialog-top>div{max-width:760px}.score-dialog h2{max-width:760px;margin-top:14px;font-size:clamp(30px,4.3vw,48px);line-height:1.02;letter-spacing:-.065em}
    .score-lead{max-width:820px!important;margin:15px 0 0!important;color:#a3a39e!important;font-size:15px!important;line-height:1.7!important}
    .score-principles{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin:25px 0;background:#292929;border:1px solid #292929;border-radius:10px;overflow:hidden}
    .score-principles>div{display:grid;grid-template-columns:30px 1fr;column-gap:10px;padding:15px;background:#0b0b0b}.score-principles span{grid-row:1/3;color:#559fff;font:10px DM Mono,monospace}.score-principles b{font-size:13px;font-weight:500}.score-principles small{margin-top:3px;color:#81817c;font-size:11px;line-height:1.45}
    .score-lab{display:grid;grid-template-columns:190px 1fr;border:1px solid #303030;border-radius:13px;background:#070707;overflow:hidden;box-shadow:inset 0 1px rgba(255,255,255,.025)}
    .score-lab-result{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:315px;padding:25px;border-right:1px solid #303030;background:radial-gradient(circle at 50% 35%,rgba(50,145,255,.14),transparent 55%)}
    .score-lab-result>span{color:#777;font:10px DM Mono,monospace;letter-spacing:.08em}.score-lab-result strong{margin:16px 0 0;font-size:76px;font-weight:500;line-height:.9;letter-spacing:-.09em}.score-lab-result small{margin-top:8px;color:#777;font:10px DM Mono,monospace}.score-lab-result b{margin-top:22px;padding:6px 8px;border:1px solid #414141;border-radius:5px;color:#c4c4be;font:9px DM Mono,monospace;text-align:center;letter-spacing:.04em}
    .score-lab-result[data-tone="critical"] b{border-color:#7a3936;color:#ff8a83}.score-lab-result[data-tone="high"] b{border-color:#6c4b25;color:#ffc171}.score-lab-result[data-tone="medium"] b{border-color:#4d5570;color:#9fb8ff}.score-lab-result[data-tone="clear"] b{border-color:#315d3e;color:#83d99c}
    .score-lab-controls{padding:22px}.score-lab-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:15px}.score-lab-head span{color:#777;font:10px DM Mono,monospace;text-transform:uppercase;letter-spacing:.06em}.score-lab-head h3{margin:5px 0 0;font-size:18px;font-weight:500;letter-spacing:-.035em}.score-lab-head code{padding:7px 9px;border:1px solid #2d2d2d;border-radius:5px;background:#0d0d0d;color:#99c3ff;font:10px DM Mono,monospace;white-space:nowrap}
    .score-rule-toggles{display:grid;gap:6px}.score-rule-toggles button{display:grid;grid-template-columns:18px minmax(0,1fr) auto;gap:11px;align-items:center;width:100%;padding:11px 12px;border:1px solid #252525;border-radius:7px;background:#0b0b0b;color:#8b8b86;text-align:left;transition:border-color .18s,background .18s,color .18s,transform .3s cubic-bezier(.16,1,.3,1)}
    .score-rule-toggles button:hover{border-color:#414141;background:#111;color:#ddd;transform:translateX(2px)}.score-rule-toggles button.active{border-color:#355b8a;background:#0b1420;color:#e7e7e2}.score-rule-toggles button>i{width:14px;height:14px;border:1px solid #555;border-radius:50%;box-shadow:inset 0 0 0 3px #0b0b0b}.score-rule-toggles button.active>i{border-color:#68aaff;background:#68aaff}
    .score-rule-toggles button span{display:block}.score-rule-toggles button b{display:block;font-size:12px;font-weight:500}.score-rule-toggles button small{display:block;margin-top:2px;color:#6f6f6a;font-size:10px}.score-rule-toggles button em{color:#777;font:9px DM Mono,monospace;font-style:normal;white-space:nowrap}
    .score-tabs{display:flex;gap:3px;overflow:auto;margin:26px 0 0;padding:4px;border:1px solid #292929;border-radius:9px;background:#080808}.score-tabs:before{z-index:0!important;top:4px!important;height:calc(100% - 8px)!important;background:#202020!important}.score-tabs button{position:relative;z-index:1;flex:1 0 auto;min-height:36px;padding:8px 12px;border:0!important;border-radius:6px;background:transparent!important;color:#777!important;font-size:12px}.score-tabs button.active{color:#fff!important}.score-tabs button:hover{color:#ddd!important}
    .score-panel{padding:20px 0 2px}.hidden-score{display:none}
    .score-pipeline{display:grid;grid-template-columns:1fr 20px 1fr 20px 1fr 20px 1fr;gap:7px;align-items:stretch}.score-pipeline>div{padding:15px;border:1px solid #2b2b2b;border-radius:8px;background:#0b0b0b}.score-pipeline>i,.score-evidence-flow>i{display:grid;place-items:center;color:#3e75b6;font-style:normal}.score-pipeline span,.score-evidence-flow span,.score-boundary-grid span,.score-next>span,.score-equation>span,.score-weight-grid span{color:#5e91cc;font:9px DM Mono,monospace;letter-spacing:.06em}.score-pipeline b,.score-evidence-flow b,.score-boundary-grid b{display:block;margin-top:16px;font-size:13px;font-weight:500}.score-pipeline p,.score-evidence-flow p,.score-boundary-grid p{margin:6px 0 0;color:#898984;font-size:12px;line-height:1.55}
    .score-equation{display:grid;grid-template-columns:90px minmax(0,1fr);gap:8px 18px;align-items:center;padding:16px;border:1px solid #2d2d2d;border-radius:8px;background:#0a0a0a}.score-equation code{color:#d7d7d1;font:15px DM Mono,monospace}.score-equation p{grid-column:2;margin:0;color:#797974;font-size:11px}
    .score-weight-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:9px}.score-weight-grid>div{padding:15px;border:1px solid #292929;border-radius:8px;background:#0a0a0a}.score-weight-grid strong{display:block;margin:22px 0 10px;font-size:28px;font-weight:500;letter-spacing:-.06em}.score-weight-grid b{font-size:11px;font-weight:500}.score-weight-grid p{margin:6px 0 0;color:#7f7f7a;font-size:11px;line-height:1.5}.score-weight-grid [data-tone="critical"]{border-top-color:#9c4742}.score-weight-grid [data-tone="high"]{border-top-color:#b3742f}.score-weight-grid [data-tone="medium"]{border-top-color:#5875b7}.score-weight-grid [data-tone="info"]{border-top-color:#417b53}
    .score-evidence-flow{display:grid;grid-template-columns:1fr 24px 1fr 24px 1fr;gap:8px}.score-evidence-flow>div{padding:17px;border:1px solid #2b2b2b;border-radius:8px;background:#0a0a0a}.score-note{display:flex;align-items:center;justify-content:space-between;gap:30px;margin-top:9px;padding:15px 17px;border:1px solid #284c77;border-radius:8px;background:rgba(28,78,139,.12)}.score-note b{font-size:13px;font-weight:500}.score-note p{max-width:600px;margin:0;color:#91918c;font-size:12px;line-height:1.55}
    .score-boundary-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.score-boundary-grid>div{padding:18px;border:1px solid #2b2b2b;border-radius:8px;background:#0a0a0a}.score-boundary-grid b{font-size:16px}.score-boundary-grid p{font-size:13px}.score-next{display:grid;grid-template-columns:135px 1fr;gap:20px;align-items:center;margin-top:9px;padding:15px 18px;border:1px solid #2d2d2d;border-radius:8px;background:#0c0c0c}.score-next p{margin:0;color:#999994;font-size:13px}.score-next b{color:#e4e4df;font-weight:500}.score-next i{padding:0 8px;color:#477caf;font-style:normal}
    @media(max-width:820px){.score-dialog{padding:24px!important}.score-principles{grid-template-columns:1fr}.score-lab{grid-template-columns:150px 1fr}.score-lab-result{min-height:340px}.score-lab-head{display:block}.score-lab-head code{display:inline-block;margin-top:10px}.score-pipeline{grid-template-columns:1fr 1fr}.score-pipeline>i{display:none}.score-weight-grid{grid-template-columns:1fr 1fr}}
    @media(max-width:620px){.score-dialog{padding:20px!important}.score-dialog h2{font-size:34px}.score-lead{font-size:14px!important}.score-lab{grid-template-columns:1fr}.score-lab-result{min-height:190px;border-right:0;border-bottom:1px solid #303030}.score-lab-result strong{font-size:62px}.score-lab-result b{margin-top:14px}.score-lab-controls{padding:15px}.score-lab-head code{max-width:100%;white-space:normal;line-height:1.5}.score-rule-toggles button{grid-template-columns:18px 1fr}.score-rule-toggles button em{grid-column:2}.score-pipeline,.score-weight-grid,.score-evidence-flow,.score-boundary-grid{grid-template-columns:1fr}.score-evidence-flow>i{height:16px;transform:rotate(90deg)}.score-note,.score-next{display:block}.score-note p,.score-next p{margin-top:8px}.score-tabs button{font-size:11px}.score-principles small{font-size:11px}}
    @media(prefers-reduced-motion:reduce){.score-rule-toggles button{transition:none}.score-rule-toggles button:hover{transform:none}}
  `;
  document.head.append(style);

  const dialog = document.querySelector('#score-dialog');
  if (!dialog) return;
  const tabs = [...dialog.querySelectorAll('[data-score-tab]')];
  const panels = [...dialog.querySelectorAll('[data-score-panel]')];
  const result = dialog.querySelector('.score-lab-result');
  const value = dialog.querySelector('#score-demo-value');
  const formula = dialog.querySelector('#score-demo-formula');
  const decision = dialog.querySelector('#score-demo-decision');
  const toggles = [...dialog.querySelectorAll('[data-demo-rule]')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateIndicator = () => {
    const active = dialog.querySelector('.score-tabs .active');
    const list = active?.parentElement;
    if (!active || !list) return;
    list.style.setProperty('--sona-tab-x', `${active.offsetLeft}px`);
    list.style.setProperty('--sona-tab-width', `${active.offsetWidth}px`);
    list.style.setProperty('--sona-tab-height', `${active.offsetHeight}px`);
  };

  tabs.forEach(tab => tab.onclick = () => {
    tabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    });
    panels.forEach(panel => panel.classList.toggle('hidden-score', panel.dataset.scorePanel !== tab.dataset.scoreTab));
    requestAnimationFrame(updateIndicator);
  });

  let animationFrame;
  const animateValue = target => {
    cancelAnimationFrame(animationFrame);
    const start = Number(value.textContent) || 0;
    if (reduceMotion || start === target) {
      value.textContent = String(target);
      return;
    }
    const started = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - started) / 420);
      const eased = 1 - Math.pow(1 - progress, 3);
      value.textContent = String(Math.round(start + (target - start) * eased));
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
  };

  const updateDemo = () => {
    const active = toggles.filter(toggle => toggle.getAttribute('aria-pressed') === 'true');
    const penalties = active.filter(toggle => Number(toggle.dataset.weight) > 0).map(toggle => Number(toggle.dataset.weight));
    const raw = Math.max(0, 100 - penalties.reduce((sum, weight) => sum + weight, 0));
    const hasCritical = active.some(toggle => toggle.dataset.demoRule === 'critical');
    const hasHigh = active.some(toggle => toggle.dataset.demoRule === 'high');
    const hasMedium = active.some(toggle => toggle.dataset.demoRule === 'medium');
    const final = hasCritical ? Math.min(raw, 20) : hasHigh ? Math.min(raw, 55) : raw;
    const ceiling = hasCritical ? 20 : hasHigh ? 55 : null;
    const tone = hasCritical ? 'critical' : hasHigh ? 'high' : hasMedium ? 'medium' : 'clear';
    const label = hasCritical ? 'BLOCK INSTALLATION' : hasHigh ? 'REVIEW AND REMEDIATE' : hasMedium ? 'EVALUATE WITH REVIEW' : 'SAFE TO EVALUATE';
    const subtraction = penalties.length ? `100 − ${penalties.join(' − ')} = ${raw}` : '100 − 0 = 100';
    formula.textContent = ceiling !== null && final < raw ? `${subtraction} → ceiling ${ceiling}` : subtraction;
    decision.textContent = label;
    result.dataset.tone = tone;
    animateValue(final);
  };

  result.setAttribute('aria-live', 'polite');
  toggles.forEach(toggle => toggle.addEventListener('click', () => {
    const active = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(active));
    toggle.classList.toggle('active', active);
    updateDemo();
  }));

  new MutationObserver(() => {
    if (!dialog.classList.contains('show')) return;
    dialog.querySelector('.score-dialog').scrollTop = 0;
    requestAnimationFrame(updateIndicator);
  }).observe(dialog, { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', updateIndicator, { passive: true });
  updateDemo();
})();
