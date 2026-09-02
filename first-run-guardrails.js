(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const hostPattern = /https?:\/\/[^\s'"<>]+/gi;

  const state = {
    active: 'pin',
    artifact: 'No review attached',
    reviewedRef: '',
    hosts: [],
    allowedHosts: new Set(),
    isolation: 'Disposable sandbox',
    authority: {
      workspace: true,
      network: false,
      commands: false,
      credentials: false
    },
    trigger: null
  };

  const stages = [
    {
      id: 'pin',
      number: '01',
      label: 'Pin',
      title: 'Pin the exact artifact you reviewed.',
      copy: 'A tag can move. A branch will move. Record a commit SHA, immutable release, or checksum before the integration is allowed to run.'
    },
    {
      id: 'isolate',
      number: '02',
      label: 'Isolate',
      title: 'Make the first run disposable.',
      copy: 'Start with a workspace that can be deleted and contains no ambient credentials, production data, or trusted tool configuration.'
    },
    {
      id: 'hosts',
      number: '03',
      label: 'Verify hosts',
      title: 'Approve each outbound destination deliberately.',
      copy: 'A hostname is a data boundary. Confirm its owner, request payload, authentication, retention, and failure behavior before allowing network access.'
    },
    {
      id: 'authority',
      number: '04',
      label: 'Scope authority',
      title: 'Grant the smallest capability set that can finish the task.',
      copy: 'Begin with read-only, no credentials, no shell access, and a host allowlist. Expand a single control only when there is a named need.'
    }
  ];

  const style = document.createElement('style');
  style.textContent = [
    '.guardrail-section{padding:34px 0 56px}',
    '.guardrail-bridge{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:32px;align-items:end;margin:0 2px 22px;padding:0 0 20px;border-bottom:1px solid #303030}',
    '.guardrail-bridge p{max-width:520px;margin:8px 0 0;color:#9b9b96;font-size:12px;line-height:1.6}',
    '.guardrail-bridge ol{display:grid;grid-template-columns:repeat(3,minmax(96px,1fr));gap:20px;min-width:420px;margin:0;padding:0;list-style:none}',
    '.guardrail-bridge li{padding-left:12px;border-left:1px solid #424242}',
    '.guardrail-bridge span{display:block;color:#81817c;font:9px DM Mono,monospace;letter-spacing:.08em}',
    '.guardrail-bridge b{display:block;margin-top:5px;font-size:12px;font-weight:500}',
    '.guardrail-bridge small{display:block;margin-top:3px;color:#858580;font-size:10px;line-height:1.35}',
    '.guardrail-shell{position:relative;overflow:hidden;padding:30px;border:1px solid #343434;border-radius:15px;background:linear-gradient(135deg,#111 0%,#090909 70%);box-shadow:0 20px 80px #0005}',
    '.guardrail-shell:before{content:"";position:absolute;inset:auto -16% -85% 34%;height:240px;background:radial-gradient(ellipse,rgba(210,210,196,.14),transparent 68%);filter:blur(12px);pointer-events:none}',
    '.guardrail-heading{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:end}',
    '.guardrail-heading h2{max-width:620px;margin:7px 0 0;font-size:clamp(30px,4vw,51px);font-weight:500;line-height:.98;letter-spacing:-.075em}',
    '.guardrail-heading p{max-width:555px;margin:15px 0 0;color:#aaa;font-size:14px;line-height:1.6}',
    '.guardrail-trigger{position:relative;overflow:hidden;flex:0 0 auto;min-width:184px;transition:transform .22s cubic-bezier(.2,.8,.2,1),box-shadow .22s ease}',
    '.guardrail-trigger:before{content:"";position:absolute;width:12px;height:12px;left:var(--ripple-x,50%);top:var(--ripple-y,50%);border-radius:50%;background:#fff8;transform:translate(-50%,-50%) scale(0);transition:transform .5s ease,opacity .5s ease;opacity:0}',
    '.guardrail-trigger.rippling:before{transform:translate(-50%,-50%) scale(20);opacity:1}',
    '.guardrail-trigger span{position:relative;margin-left:8px;font-size:18px;transition:transform .2s ease}',
    '.guardrail-trigger:hover span{transform:translateX(3px)}',
    '.guardrail-preview{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:30px;border:1px solid #343434;border-radius:10px;overflow:hidden;background:#343434}',
    '.guardrail-preview button{min-height:128px;padding:17px;border:0;background:#0e0e0e;color:#b5b5b0;text-align:left;transition:background .28s ease,color .28s ease,transform .28s cubic-bezier(.2,.8,.2,1)}',
    '.guardrail-preview button:hover{position:relative;z-index:1;background:#171717;color:#eee;transform:translateY(-3px)}',
    '.guardrail-preview span{display:block;color:#777;font:10px DM Mono,monospace;letter-spacing:.08em}',
    '.guardrail-preview b{display:block;margin-top:28px;font-size:15px;font-weight:500;letter-spacing:-.03em}',
    '.guardrail-preview small{display:block;margin-top:6px;color:#8d8d88;font-size:11px;line-height:1.45}',
    '.guardrail-dialog{width:min(1060px,100%);padding:0!important;overflow:auto!important;background:#0d0d0d!important;border-color:#3b3b3b!important}',
    '.guardrail-top{display:flex;align-items:start;justify-content:space-between;gap:24px;padding:28px 30px 25px;border-bottom:1px solid #303030;background:linear-gradient(115deg,#151515,#0d0d0d 65%)}',
    '.guardrail-top .icon-btn{display:inline-grid;place-items:center;flex:0 0 auto;width:42px;height:42px;padding:0;border-radius:10px;line-height:1;font-size:27px;cursor:pointer;transform:translateZ(0);transition:transform .28s cubic-bezier(.16,1,.3,1),background .24s ease,border-color .24s ease,box-shadow .24s ease}',
    '.guardrail-top .icon-btn:hover{border-color:#d8d8d2;background:#eaeae6;color:#101010;box-shadow:0 8px 24px #0006;transform:rotate(90deg) scale(1.06)}',
    '.guardrail-top .icon-btn:active{transform:rotate(90deg) scale(.94)}',
    '.guardrail-top .icon-btn:focus-visible{outline:2px solid #f0f0ea;outline-offset:3px}',
    '.guardrail-kicker{margin:0;color:#aaa;font:10px DM Mono,monospace;letter-spacing:.09em}',
    '.guardrail-top h2{margin:12px 0 0!important;font-size:31px!important;letter-spacing:-.065em!important}',
    '.guardrail-top p{margin:14px 0 0;max-width:670px;color:#999;font-size:13px;line-height:1.6}',
    '.guardrail-tabs{display:flex;gap:6px;overflow:auto;padding:18px 28px 3px;border-bottom:1px solid #303030;scrollbar-width:none}',
    '.guardrail-tab{position:relative;display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:9px 12px 11px;border:0;border-bottom:2px solid transparent;background:transparent;color:#888;font-size:12px;transition:color .22s ease,border-color .22s ease,background .22s ease}',
    '.guardrail-tab span{display:grid;place-items:center;width:18px;height:18px;border:1px solid #454545;border-radius:50%;font:9px DM Mono,monospace;transition:background .22s ease,color .22s ease}',
    '.guardrail-tab:hover,.guardrail-tab[aria-selected="true"]{color:#f1f1ed;background:#141414}',
    '.guardrail-tab[aria-selected="true"]{border-color:#e7e7e2}',
    '.guardrail-tab[aria-selected="true"] span{border-color:#e7e7e2;background:#e7e7e2;color:#111}',
    '.guardrail-stage{display:none;padding:28px 30px 0;animation:guardrail-in .36s cubic-bezier(.16,1,.3,1) both}',
    '.guardrail-stage.active{display:block}',
    '@keyframes guardrail-in{from{opacity:0;transform:translateY(9px) scale(.99)}to{opacity:1;transform:none}}',
    '.guardrail-stage-head{display:grid;grid-template-columns:1.05fr .95fr;gap:42px;align-items:end;margin-bottom:24px}',
    '.guardrail-stage-head h3{margin:0;font-size:25px;font-weight:500;letter-spacing:-.055em}',
    '.guardrail-stage-head p{margin:0;color:#aaa;font-size:13px;line-height:1.65}',
    '.guardrail-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}',
    '.guardrail-card{padding:20px;border:1px solid #363636;border-radius:12px;background:#111}',
    '.guardrail-card b{font-size:12px;font-weight:500}',
    '.guardrail-card p{margin:6px 0 0;color:#999;font-size:12px;line-height:1.55}',
    '.guardrail-field{margin-top:16px}',
    '.guardrail-field label{display:block;margin-bottom:6px;color:#aaa;font:10px DM Mono,monospace;letter-spacing:.06em}',
    '.guardrail-field input,.host-add input{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #3b3b3b;border-radius:7px;background:#090909;color:#eee;font:12px DM Mono,monospace;outline:none;transition:border-color .2s ease,box-shadow .2s ease}',
    '.guardrail-field input:focus,.host-add input:focus{border-color:#d9d9d2;box-shadow:0 0 0 3px #e8e8e812}',
    '.guardrail-hint{display:flex;align-items:start;gap:8px;margin-top:12px;color:#b8b8b2;font-size:11px;line-height:1.45}',
    '.guardrail-hint:before{content:"i";display:grid;place-items:center;flex:0 0 auto;width:15px;height:15px;border:1px solid #555;border-radius:50%;font:9px DM Mono,monospace;color:#aaa}',
    '.isolation-options{display:grid;gap:7px;margin-top:14px}',
    '.isolation-option{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid #363636;border-radius:8px;background:#0c0c0c;cursor:pointer;transition:border-color .2s ease,background .2s ease}',
    '.isolation-option input{position:absolute;opacity:0;pointer-events:none}',
    '.isolation-dot{display:grid;place-items:center;flex:0 0 auto;width:17px;height:17px;margin-top:1px;border:1px solid #555;border-radius:50%;font-size:10px;color:#111}',
    '.isolation-option:has(input:checked){border-color:#d9d9d3;background:#181818}',
    '.isolation-option:has(input:checked) .isolation-dot{border-color:#e8e8e3;background:#e8e8e3}',
    '.isolation-option strong{display:block;font-size:12px;font-weight:500}',
    '.isolation-option small{display:block;margin-top:3px;color:#94948f;font-size:11px;line-height:1.4}',
    '.host-add{display:flex;gap:7px;margin:13px 0 0}',
    '.host-add input{min-width:0}',
    '.host-add .button{flex:0 0 auto;padding:8px 11px;font-size:11px}',
    '.host-list{display:grid;gap:7px;margin-top:13px}',
    '.host-row{display:flex;align-items:center;gap:9px;padding:10px 11px;border:1px solid #373737;border-radius:8px;background:#0c0c0c}',
    '.host-row .host-dot{width:7px;height:7px;border-radius:50%;background:#777;box-shadow:0 0 0 3px #7772}',
    '.host-row.allowed{border-color:#496244;background:#111811}',
    '.host-row.allowed .host-dot{background:#8bbb7a;box-shadow:0 0 0 3px #8bbb7a23}',
    '.host-row span:nth-child(2){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:11px DM Mono,monospace}',
    '.host-row .host-status{margin-left:auto;color:#9a9a95;font:9px DM Mono,monospace;letter-spacing:.05em}',
    '.host-row button{flex:0 0 auto;padding:5px 7px;border:1px solid #414141;border-radius:5px;background:transparent;color:#c9c9c3;font-size:10px}',
    '.host-row.allowed button{border-color:#6e9466;color:#b7d3ad}',
    '.host-empty{padding:12px;border:1px dashed #3b3b3b;border-radius:8px;color:#999;font-size:11px;line-height:1.55}',
    '.authority-list{display:grid;gap:7px;margin-top:14px}',
    '.authority-row{display:flex;align-items:center;gap:11px;padding:11px;border:1px solid #363636;border-radius:8px;background:#0c0c0c;cursor:pointer}',
    '.authority-row input{position:absolute;opacity:0;pointer-events:none}',
    '.authority-switch{position:relative;flex:0 0 auto;width:28px;height:17px;border:1px solid #555;border-radius:999px;background:#191919;transition:background .2s ease,border-color .2s ease}',
    '.authority-switch:after{content:"";position:absolute;top:3px;left:3px;width:9px;height:9px;border-radius:50%;background:#878782;transition:transform .2s cubic-bezier(.2,.8,.2,1),background .2s ease}',
    '.authority-row:has(input:checked){border-color:#565e52;background:#101410}',
    '.authority-row:has(input:checked) .authority-switch{border-color:#8a9f82;background:#70906a}',
    '.authority-row:has(input:checked) .authority-switch:after{transform:translateX(11px);background:#f0f0eb}',
    '.authority-row b{display:block;font-size:12px;font-weight:500}',
    '.authority-row small{display:block;margin-top:2px;color:#94948f;font-size:10px;line-height:1.35}',
    '.guardrail-accordion{margin-top:12px;border-top:1px solid #303030}',
    '.guardrail-accordion button{display:flex;align-items:center;justify-content:space-between;width:100%;padding:13px 0;border:0;background:transparent;color:#deded9;text-align:left;font-size:11px}',
    '.guardrail-accordion button span{font-size:17px;line-height:1;transition:transform .22s ease}',
    '.guardrail-accordion.open button span{transform:rotate(45deg)}',
    '.guardrail-accordion p{display:grid;grid-template-rows:0fr;margin:0;color:#999;font-size:11px;line-height:1.55;transition:grid-template-rows .28s ease,margin .28s ease}',
    '.guardrail-accordion p i{overflow:hidden;font-style:normal}',
    '.guardrail-accordion.open p{grid-template-rows:1fr;margin:0 0 13px}',
    '.guardrail-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin:26px 30px 0;border:1px solid #303030;border-radius:12px;overflow:hidden;background:#303030}',
    '.guardrail-summary-item{min-height:108px;padding:18px 20px;background:#0d0d0d}',
    '.guardrail-summary-item span{display:block;color:#888;font:9px DM Mono,monospace;letter-spacing:.06em}',
    '.guardrail-summary-item b{display:block;margin-top:11px;font-size:12px;font-weight:500;line-height:1.45;overflow-wrap:anywhere}',
    '.guardrail-summary-item b.ready{color:#b4d5aa}',
    '.guardrail-policy{max-height:0;margin:0 30px;overflow:hidden;opacity:0;transition:max-height .46s cubic-bezier(.16,1,.3,1),margin .32s ease,opacity .25s ease}',
    '.guardrail-policy.open{max-height:530px;margin-top:24px;opacity:1}',
    '.guardrail-policy-inner{padding:16px 18px;border:1px solid #3a3a3a;border-radius:12px;background:#0a0a0a}',
    '.guardrail-policy-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-bottom:12px;border-bottom:1px solid #303030}',
    '.guardrail-policy-head b{font-size:12px;font-weight:500}',
    '.guardrail-policy-head span{color:#92928c;font:9px DM Mono,monospace;letter-spacing:.04em}',
    '.guardrail-policy pre{max-height:338px;margin:14px 0 0;overflow:auto;color:#d5d5cf;font:10px/1.62 DM Mono,monospace;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2}',
    '.guardrail-actions{position:sticky;z-index:1;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:22px;padding:20px 30px;border-top:1px solid #303030;background:#111}',
    '.guardrail-status{color:#a8a8a2;font-size:11px;line-height:1.45}',
    '.guardrail-status b{color:#e2e2dc;font-weight:500}',
    '.guardrail-actions-group{display:flex;gap:7px;flex:0 0 auto}',
    '.guardrail-actions .button:disabled{cursor:not-allowed;opacity:.46;transform:none;background:#777;color:#202020;border-color:#777}',
    '@media(max-width:760px){.guardrail-bridge,.guardrail-heading,.guardrail-stage-head,.guardrail-grid{grid-template-columns:1fr}.guardrail-bridge ol{min-width:0}.guardrail-heading{align-items:start}.guardrail-heading .guardrail-trigger{justify-self:start}.guardrail-preview{grid-template-columns:1fr 1fr}.guardrail-dialog{max-height:94vh!important}.guardrail-summary{grid-template-columns:1fr 1fr;margin-left:20px;margin-right:20px}}',
    '@media(max-width:520px){.guardrail-section{padding-top:28px}.guardrail-bridge{gap:16px;margin-bottom:18px;padding-bottom:18px}.guardrail-bridge ol{grid-template-columns:1fr 1fr;gap:12px}.guardrail-shell{padding:22px}.guardrail-preview{grid-template-columns:1fr}.guardrail-preview button{min-height:92px}.guardrail-top,.guardrail-stage{padding-left:20px;padding-right:20px}.guardrail-top{padding-top:23px;padding-bottom:21px}.guardrail-top .icon-btn{width:38px;height:38px}.guardrail-tabs{padding-left:14px;padding-right:14px}.guardrail-summary{margin:20px 20px 0;grid-template-columns:1fr}.guardrail-policy{margin-left:20px;margin-right:20px}.guardrail-policy.open{margin-top:20px}.guardrail-actions{padding:16px 20px;align-items:flex-start;flex-direction:column}.guardrail-actions-group{width:100%;flex-wrap:wrap}.guardrail-actions-group .button{flex:1}.host-add{flex-wrap:wrap}.host-add .button{width:100%}}',
    '@media(prefers-reduced-motion:reduce){.guardrail-top .icon-btn,.guardrail-trigger,.guardrail-preview button,.guardrail-stage{transition:none!important;animation:none!important}}'
  ].join('');
  document.head.append(style);

  const mount = () => {
    if (document.querySelector('#guardrail-dialog')) return;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'guardrail-dialog';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<section class="dialog guardrail-dialog" role="dialog" aria-modal="true" aria-labelledby="guardrail-title">' +
        '<div class="guardrail-top"><div><p class="guardrail-kicker">TAILOR LAYER / SCAN / LAUNCH PLAN</p><h2 id="guardrail-title">Apply safe limits before running.</h2><p id="guardrail-context">Scan a repository to attach its reviewed version, outbound hosts, and recommended authority limits.</p></div><button class="icon-btn" type="button" data-close-guardrails aria-label="Close launch plan">×</button></div>' +
        '<div class="guardrail-tabs" role="tablist" aria-label="First-run plan stages">' +
          stages.map(stage => '<button class="guardrail-tab" type="button" role="tab" aria-selected="' + (stage.id === state.active) + '" aria-controls="guardrail-' + stage.id + '" data-guardrail-stage="' + stage.id + '"><span>' + stage.number + '</span>' + stage.label + '</button>').join('') +
        '</div>' +
        '<div id="guardrail-panels"></div>' +
        '<div class="guardrail-summary" aria-live="polite">' +
          '<div class="guardrail-summary-item"><span>REVIEWED ARTIFACT</span><b id="summary-artifact">No review attached</b></div>' +
          '<div class="guardrail-summary-item"><span>VERSION PIN</span><b id="summary-pin">Required</b></div>' +
          '<div class="guardrail-summary-item"><span>OUTBOUND HOSTS</span><b id="summary-hosts">None approved</b></div>' +
          '<div class="guardrail-summary-item"><span>AUTHORITY</span><b id="summary-authority">Minimal by default</b></div>' +
        '</div>' +
        '<section class="guardrail-policy" id="guardrail-policy" aria-label="Copy-ready launch policy" aria-hidden="true"><div class="guardrail-policy-inner"><div class="guardrail-policy-head"><b>Copy-ready launch policy</b><span>.tailor-layer/first-run.yaml</span></div><pre><code id="guardrail-policy-code"></code></pre></div></section>' +
        '<div class="guardrail-actions"><div class="guardrail-status" id="guardrail-status"><b>Draft contract.</b> Set an immutable reference before the first run.</div><div class="guardrail-actions-group"><button class="button ghost" type="button" data-close-guardrails>Close</button><button class="button ghost" type="button" id="preview-guardrail-plan">Preview YAML</button><button class="button" type="button" id="copy-guardrail-plan">Copy YAML policy</button></div></div>' +
      '</section>';
    document.body.append(overlay);
    render();
    bind();
  };

  const panel = stage => {
    const head = '<div class="guardrail-stage-head"><div><h3>' + escape(stage.title) + '</h3></div><p>' + escape(stage.copy) + '</p></div>';
    if (stage.id === 'pin') {
      return '<section class="guardrail-stage ' + (state.active === stage.id ? 'active' : '') + '" id="guardrail-pin" role="tabpanel" aria-label="' + stage.label + '">' + head +
        '<div class="guardrail-grid"><div class="guardrail-card"><b>Immutable reference</b><p>Record the exact version you reviewed. Prefer a full commit SHA or a release artifact with a published checksum.</p><div class="guardrail-field"><label for="guardrail-ref">COMMIT SHA, VERSION, OR CHECKSUM</label><input id="guardrail-ref" autocomplete="off" placeholder="Example: 4f3e9c… or release@1.4.2" value="' + escape(state.reviewedRef) + '"></div><div class="guardrail-hint">Do not treat main, latest, or an unverified tag as a pin.</div></div><div class="guardrail-card"><b>Review context</b><p><strong id="pin-artifact">' + escape(state.artifact) + '</strong></p><p>When the repository is scanned again, compare this reference against the candidate with Drift review before replacing it.</p><div class="guardrail-accordion" data-guardrail-accordion><button type="button" aria-expanded="false">Why a pin matters <span>+</span></button><p><i>Remote packages, branches, and release tags can change after a review. A pin makes the thing you run addressable, comparable, and reversible.</i></p></div></div></div></section>';
    }
    if (stage.id === 'isolate') {
      return '<section class="guardrail-stage ' + (state.active === stage.id ? 'active' : '') + '" id="guardrail-isolate" role="tabpanel" aria-label="' + stage.label + '">' + head +
        '<div class="guardrail-grid"><div class="guardrail-card"><b>First-run environment</b><p>Choose an environment you can reset after the review. Do not mount a personal home directory or production workspace.</p><div class="isolation-options">' +
          isolationOption('Disposable sandbox', 'No ambient credentials, persistent files, or production data.') +
          isolationOption('Temporary worktree', 'A narrow checked-out copy with a clean, reviewable diff.') +
          isolationOption('Container profile', 'A minimal image with a read-only mount and restricted network.') +
        '</div></div><div class="guardrail-card"><b>First-run boundary</b><p>Keep the first run observable and bounded. Capture what it attempts, then delete the environment if the observed behavior does not match the review.</p><div class="guardrail-accordion" data-guardrail-accordion><button type="button" aria-expanded="false">Isolation checklist <span>+</span></button><p><i>Use test data, a new least-privilege credential only if one is essential, no browser profile, no SSH agent, and an explicit workspace mount.</i></p></div></div></div></section>';
    }
    if (stage.id === 'hosts') {
      return '<section class="guardrail-stage ' + (state.active === stage.id ? 'active' : '') + '" id="guardrail-hosts" role="tabpanel" aria-label="' + stage.label + '">' + head +
        '<div class="guardrail-grid"><div class="guardrail-card"><b>Evidence-derived host candidates</b><p>Approve a hostname only after validating its purpose and the data it receives. Static review reveals candidates, not a complete runtime traffic trace; new hosts remain blocked by default.</p><div class="host-add"><input id="guardrail-host-input" autocomplete="off" inputmode="url" placeholder="api.example.com"><button class="button ghost" type="button" id="add-guardrail-host">Add host</button></div><div class="host-list" id="guardrail-host-list"></div></div><div class="guardrail-card"><b>Review before allow</b><p>Use a host owner you can identify, an encrypted transport, the minimum request data, and a documented authentication path.</p><div class="guardrail-accordion" data-guardrail-accordion><button type="button" aria-expanded="false">Questions for every host <span>+</span></button><p><i>What leaves the agent? Who receives it? Which credential authenticates it? How long is it retained? What happens if the host is unavailable or malicious?</i></p></div></div></div></section>';
    }
    return '<section class="guardrail-stage ' + (state.active === stage.id ? 'active' : '') + '" id="guardrail-authority" role="tabpanel" aria-label="' + stage.label + '">' + head +
      '<div class="guardrail-grid"><div class="guardrail-card"><b>Least-privilege controls</b><p>Enable only controls that have a named task requirement. A later expansion should be separately reviewed.</p><div class="authority-list">' +
        authorityOption('workspace', 'Read a narrow workspace', 'Limit access to the folder required for this task.') +
        authorityOption('network', 'Network to approved hosts', 'Only the allowlisted destinations can be contacted.') +
        authorityOption('commands', 'One-time command approval', 'Ask before each command that changes the host or workspace.') +
        authorityOption('credentials', 'Task-scoped credential', 'Use a newly created credential with only the required permission.') +
      '</div></div><div class="guardrail-card"><b>Default deny is useful</b><p>Start with commands and credentials disabled. If the task cannot finish, make the smallest, time-bound exception and record why it was needed.</p><div class="guardrail-accordion" data-guardrail-accordion><button type="button" aria-expanded="false">Authority decision note <span>+</span></button><p><i>This contract is a review aid, not an enforcement layer. Apply the same choices in the agent runtime, sandbox, token scopes, and network policy.</i></p></div></div></div></section>';
  };

  const isolationOption = (value, copy) => '<label class="isolation-option"><input type="radio" name="guardrail-isolation" value="' + escape(value) + '"' + (state.isolation === value ? ' checked' : '') + '><span class="isolation-dot">✓</span><span><strong>' + escape(value) + '</strong><small>' + escape(copy) + '</small></span></label>';
  const authorityOption = (key, title, copy) => '<label class="authority-row"><input type="checkbox" data-authority="' + key + '"' + (state.authority[key] ? ' checked' : '') + '><span class="authority-switch"></span><span><b>' + escape(title) + '</b><small>' + escape(copy) + '</small></span></label>';

  const render = () => {
    const container = $('#guardrail-panels');
    if (!container) return;
    container.innerHTML = stages.map(panel).join('');
    renderHosts();
    updateSummary();
  };

  const renderHosts = () => {
    const list = $('#guardrail-host-list');
    if (!list) return;
    if (!state.hosts.length) {
      list.innerHTML = '<div class="host-empty">No external hostname candidate was discovered in the attached static review. Add a host only if the first run needs one; otherwise keep outbound access disabled.</div>';
      return;
    }
    list.innerHTML = state.hosts.map(host => {
      const allowed = state.allowedHosts.has(host);
      return '<div class="host-row ' + (allowed ? 'allowed' : '') + '"><span class="host-dot"></span><span>' + escape(host) + '</span><span class="host-status">' + (allowed ? 'APPROVED' : 'UNVERIFIED') + '</span><button type="button" data-host-toggle="' + escape(host) + '">' + (allowed ? 'Remove' : 'Approve') + '</button></div>';
    }).join('');
  };

  const yamlValue = value => JSON.stringify(String(value ?? ''));

  const launchReadiness = reference => {
    const pinned = Boolean(reference);
    const everyHostApproved = !state.hosts.length || state.hosts.every(host => state.allowedHosts.has(host));
    const networkScoped = !state.hosts.length || state.authority.network;
    return { pinned, everyHostApproved, networkScoped, ready: pinned && everyHostApproved && networkScoped };
  };

  const buildPolicy = reference => {
    const resolvedReference = reference || state.reviewedRef.trim() || 'NOT_SET';
    const authority = {
      workspace: state.authority.workspace ? 'read-scoped' : 'deny',
      network: state.authority.network ? 'allowlist' : 'deny',
      commands: state.authority.commands ? 'approval-required' : 'deny',
      credentials: state.authority.credentials ? 'task-scoped' : 'deny'
    };
    const lines = [
      '# Tailor Layer first-run policy',
      '# Save as .tailor-layer/first-run.yaml, then apply it to your agent runner,',
      '# sandbox, credential scopes, and network controls before launch.',
      '# This file records the reviewed policy; it does not enforce controls by itself.',
      'schema: ' + yamlValue('tailor-layer/launch-policy/v1'),
      'artifact:',
      '  source: ' + yamlValue(state.artifact),
      '  immutable_ref: ' + yamlValue(resolvedReference),
      'review:',
      '  mode: ' + yamlValue('static repository review'),
      '  first_run_only: true',
      'first_run:',
      '  isolation:',
      '    profile: ' + yamlValue(state.isolation),
      '    disposable: true',
      '    reset_after_run: true',
      '  authority:',
      '    workspace: ' + yamlValue(authority.workspace),
      '    network: ' + yamlValue(authority.network),
      '    commands: ' + yamlValue(authority.commands),
      '    credentials: ' + yamlValue(authority.credentials),
      '  network:'
    ];
    if (state.hosts.length) {
      lines.push('    mode: ' + yamlValue('allowlist'));
      lines.push('    allowed_hosts:');
      state.hosts.forEach(host => lines.push('      - ' + yamlValue(host)));
    } else {
      lines.push('    mode: ' + yamlValue('deny'));
      lines.push('    allowed_hosts: []');
    }
    lines.push(
      'verification:',
      '  before_launch:',
      '    - ' + yamlValue('Resolve the immutable reference and compare it with the reviewed artifact.'),
      '    - ' + yamlValue('Apply the isolation profile and the authority limits above.'),
      '    - ' + yamlValue('Stop the run if observed commands, credentials, or destinations differ from this policy.'),
      '  after_run:',
      '    - ' + yamlValue('Discard the first-run environment and record any required policy changes.')
    );
    return lines.join('\n');
  };

  const updatePolicyPreview = reference => {
    const output = $('#guardrail-policy-code');
    if (output) output.textContent = buildPolicy(reference);
  };

  const togglePolicyPreview = open => {
    const panel = $('#guardrail-policy');
    const button = $('#preview-guardrail-plan');
    if (!panel) return;
    const shouldOpen = typeof open === 'boolean' ? open : !panel.classList.contains('open');
    panel.classList.toggle('open', shouldOpen);
    panel.setAttribute('aria-hidden', String(!shouldOpen));
    if (button) button.textContent = shouldOpen ? 'Hide YAML' : 'Preview YAML';
    if (shouldOpen) updatePolicyPreview($('#guardrail-ref')?.value.trim() || state.reviewedRef.trim());
  };

  const updateSummary = () => {
    const reference = $('#guardrail-ref') ? $('#guardrail-ref').value.trim() : state.reviewedRef.trim();
    const count = state.allowedHosts.size;
    const enabled = Object.values(state.authority).filter(Boolean).length;
    const readiness = launchReadiness(reference);
    $('#summary-artifact').textContent = state.artifact;
    $('#summary-pin').textContent = readiness.pinned ? reference : 'Required';
    $('#summary-pin').classList.toggle('ready', readiness.pinned);
    $('#summary-hosts').textContent = state.hosts.length ? count + ' of ' + state.hosts.length + ' approved' : 'No host required';
    $('#summary-hosts').classList.toggle('ready', readiness.everyHostApproved);
    $('#summary-authority').textContent = enabled ? enabled + ' scoped control' + (enabled === 1 ? '' : 's') : 'No authority granted';
    $('#summary-authority').classList.toggle('ready', enabled <= 2);
    const copy = $('#copy-guardrail-plan');
    if (copy) {
      copy.disabled = !readiness.ready;
      copy.setAttribute('aria-disabled', String(!readiness.ready));
    }
    $('#guardrail-status').innerHTML = readiness.ready
      ? '<b>First-run policy ready.</b> Copy the YAML, save it as .tailor-layer/first-run.yaml, then apply it to ' + escape(state.isolation.toLowerCase()) + '.'
      : '<b>Draft policy.</b> ' + (!readiness.pinned
        ? 'Set an immutable reference'
        : !readiness.everyHostApproved
          ? 'Approve every discovered outbound host'
          : 'Enable network to approved hosts') + ' before the policy can be copied.';
    updatePolicyPreview(reference);
  };

  const activate = id => {
    state.active = id;
    $$('.guardrail-tab').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.guardrailStage === id)));
    $$('.guardrail-stage').forEach(stage => stage.classList.toggle('active', stage.id === 'guardrail-' + id));
  };

  const open = (trigger, focus) => {
    const dialog = $('#guardrail-dialog');
    if (!dialog) return;
    state.trigger = trigger || document.activeElement;
    dialog.classList.add('show');
    dialog.setAttribute('aria-hidden', 'false');
    if (focus) activate(focus);
    setTimeout(() => $('.guardrail-tab[aria-selected="true"]', dialog)?.focus(), 20);
  };

  const close = () => {
    const dialog = $('#guardrail-dialog');
    if (!dialog) return;
    dialog.classList.remove('show');
    dialog.setAttribute('aria-hidden', 'true');
    state.trigger?.focus?.();
  };

  const addHost = value => {
    const raw = String(value || '').trim();
    if (!raw) return;
    let host = raw.replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').toLowerCase();
    if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host) || !host.includes('.')) {
      const input = $('#guardrail-host-input');
      if (input) { input.setCustomValidity('Enter a hostname such as api.example.com.'); input.reportValidity(); input.setCustomValidity(''); }
      return;
    }
    if (!state.hosts.includes(host)) state.hosts.push(host);
    const input = $('#guardrail-host-input');
    if (input) input.value = '';
    renderHosts();
    updateSummary();
  };

  const reviewContext = detail => {
    if (!detail) return;
    state.artifact = detail.repo || state.artifact;
    state.reviewedRef = detail.revision || '';
    const discovered = new Set();
    (detail.findings || []).forEach(finding => {
      const matches = String(finding.excerpt || '').match(hostPattern) || [];
      matches.forEach(value => {
        const candidate = value.replace(/[),.;!?]+$/, '');
        try { discovered.add(new URL(candidate).host.toLowerCase()); } catch {}
      });
    });
    state.hosts = [...discovered];
    state.allowedHosts.clear();
    const context = $('#guardrail-context');
    if (context) context.textContent = state.reviewedRef
      ? state.artifact + ' was reviewed at commit ' + state.reviewedRef.slice(0, 12) + '. Verify the discovered hosts and authority before the first run.'
      : state.artifact + ' was reviewed from ' + (detail.branch || 'the selected source') + '. Pin a release or commit before the first run.';
    render();
  };

  const copyPlan = async () => {
    const reference = ($('#guardrail-ref')?.value || state.reviewedRef || '').trim();
    const readiness = launchReadiness(reference);
    const button = $('#copy-guardrail-plan');
    if (!readiness.ready) {
      togglePolicyPreview(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(buildPolicy(reference));
      button.textContent = 'YAML copied';
      setTimeout(() => { button.textContent = 'Copy YAML policy'; }, 1400);
    } catch {
      button.textContent = 'Copy unavailable';
    }
  };

  const bind = () => {
    document.addEventListener('click', event => {
      const launch = event.target.closest('[data-open-guardrails]');
      if (launch) {
        const rect = launch.getBoundingClientRect();
        launch.style.setProperty('--ripple-x', ((event.clientX - rect.left) / rect.width * 100) + '%');
        launch.style.setProperty('--ripple-y', ((event.clientY - rect.top) / rect.height * 100) + '%');
        launch.classList.add('rippling');
        setTimeout(() => launch.classList.remove('rippling'), 420);
        open(launch, launch.dataset.guardrailFocus);
        return;
      }
      if (event.target.closest('[data-close-guardrails]')) { close(); return; }
      if (event.target.id === 'guardrail-dialog') { close(); return; }
      const tab = event.target.closest('[data-guardrail-stage]');
      if (tab) { activate(tab.dataset.guardrailStage); return; }
      const accordion = event.target.closest('[data-guardrail-accordion] button');
      if (accordion) {
        const root = accordion.closest('[data-guardrail-accordion]');
        const openNow = root.classList.toggle('open');
        accordion.setAttribute('aria-expanded', String(openNow));
        return;
      }
      const hostButton = event.target.closest('[data-host-toggle]');
      if (hostButton) {
        const host = hostButton.dataset.hostToggle;
        state.allowedHosts.has(host) ? state.allowedHosts.delete(host) : state.allowedHosts.add(host);
        renderHosts();
        updateSummary();
        return;
      }
      if (event.target.id === 'add-guardrail-host') { addHost($('#guardrail-host-input')?.value); return; }
      if (event.target.id === 'preview-guardrail-plan') { togglePolicyPreview(); return; }
      if (event.target.id === 'copy-guardrail-plan') { copyPlan(); }
    });
    document.addEventListener('change', event => {
      if (event.target.name === 'guardrail-isolation') {
        state.isolation = event.target.value;
        updateSummary();
      }
      if (event.target.matches('[data-authority]')) {
        state.authority[event.target.dataset.authority] = event.target.checked;
        updateSummary();
      }
    });
    document.addEventListener('input', event => {
      if (event.target.id === 'guardrail-ref') {
        state.reviewedRef = event.target.value;
        updateSummary();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && $('#guardrail-dialog')?.classList.contains('show')) close();
      if (event.key === 'Enter' && event.target.id === 'guardrail-host-input') {
        event.preventDefault();
        addHost(event.target.value);
      }
    });
    window.addEventListener('tailorlayer:review-ready', event => reviewContext(event.detail));
    window.addEventListener('tailorlayer:open-first-run', event => open(event.detail?.trigger, event.detail?.focus || 'pin'));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
