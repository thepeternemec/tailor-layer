(() => {
  'use strict';
  const style = document.createElement('style');
  style.textContent = '.score-dialog{max-width:900px!important}.score-model{display:grid;grid-template-columns:1fr 22px 1.3fr 22px 1fr;gap:10px;align-items:stretch;margin:20px 0;padding:12px;border:1px solid #363636;border-radius:9px;background:#0c0c0c}.score-model>div{padding:8px}.score-model span{display:block;color:#999;font:10px DM Mono,monospace;letter-spacing:.04em}.score-model strong{display:block;margin:6px 0;font-size:25px;font-weight:500;letter-spacing:-.06em}.score-model small{display:block;color:#999;font-size:10px;line-height:1.35}.score-model i{display:grid;place-items:center;color:#777;font-style:normal}.score-tabs{display:flex;gap:5px;overflow:auto;margin:20px 0 0;padding-bottom:2px}.score-tabs button{flex:0 0 auto;border:1px solid #393939;border-radius:6px;background:transparent;color:#aaa;padding:7px 10px;font-size:11px}.score-tabs button.active,.score-tabs button:hover{background:#e9e9e5;border-color:#e9e9e5;color:#111}.score-panel{padding:18px 0}.hidden-score{display:none}.score-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.score-steps>div,.score-review-grid>div,.score-limit{padding:13px;border:1px solid #343434;border-radius:7px;background:#0c0c0c}.score-steps b,.score-review-grid b,.score-limit b{font-size:12px}.score-steps p,.score-review-grid p,.score-limit p{margin:5px 0 0;font-size:12px;line-height:1.55}.score-weight{display:grid;grid-template-columns:150px 1fr;gap:14px;padding:12px 0;border-top:1px solid #303030}.score-weight p{margin:0;font-size:12px}.score-review-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.score-limit{margin-bottom:9px}@media(max-width:620px){.score-model{grid-template-columns:1fr;gap:4px}.score-model i{height:18px;transform:rotate(90deg)}.score-steps,.score-review-grid{grid-template-columns:1fr}.score-weight{grid-template-columns:1fr;gap:8px}}';
  document.head.append(style);
  const dialog = document.querySelector('#score-dialog');
  if (!dialog) return;
  const tabs = [...dialog.querySelectorAll('[data-score-tab]')];
  const panels = [...dialog.querySelectorAll('[data-score-panel]')];
  tabs.forEach(tab => tab.onclick = () => {
    tabs.forEach(item => item.classList.toggle('active', item === tab));
    panels.forEach(panel => panel.classList.toggle('hidden-score', panel.dataset.scorePanel !== tab.dataset.scoreTab));
  });
})();
