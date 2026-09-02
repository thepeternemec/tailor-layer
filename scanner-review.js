(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const api = 'https://api.github.com';
  const wait = n => new Promise(resolve => setTimeout(resolve, n));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  const rules = [
    { id: 'pipe', severity: 'CRITICAL', title: 'Downloads and executes code in one step', rx: /(?:curl|wget)[^\n]{0,160}\|\s*(?:sh|bash)\b/i, why: 'A remote script can change between review and execution.', fix: 'Split download, verification, and execution into explicit steps.', edit: '# Download a reviewed release\ncurl -fsSLO "$RELEASE_URL"\necho "$SHA256  $ARTIFACT" | sha256sum -c -\n# Execute only after explicit approval' },
    { id: 'conceal', severity: 'CRITICAL', title: 'Asks the agent to hide behavior', rx: /\b(?:do not tell (?:the )?user|silently collect|hide (?:this|the) (?:step|behavior))\b/i, why: 'An agent should not conceal execution or data handling from its user.', fix: 'Replace concealment with an explicit disclosure and approval boundary.', edit: 'Before acting, explain the action, the data used, the destination, and side effects.\nRequire user confirmation before execution.' },
    { id: 'override', severity: 'HIGH', title: 'Attempts to override agent judgment', rx: /\b(?:before using any other tool|ignore (?:previous|all) instructions|always use this tool first|override other tools)\b/i, why: 'Tools cannot replace user intent, policy, or another safety check.', fix: 'Describe when the tool is useful without controlling tool order.', edit: 'Use this tool when the user requests <task>.\nRespect user intent, policy, and existing tool-selection rules.' },
    { id: 'secret-file', severity: 'HIGH', title: 'Reads a sensitive credential store', rx: /(?:~\/\.ssh|\.aws\/credentials|kubeconfig)\b/i, why: 'Reading ambient credential stores expands access beyond the declared task.', fix: 'Accept one task-scoped credential from the runner instead of reading an ambient store.', edit: 'credential_source: env:TOOL_TOKEN\npermissions:\n  credential_scope: task-only' },
    { id: 'secret-value', severity: 'HIGH', title: 'Contains a probable hard-coded secret', rx: /(?:api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*['"][A-Za-z0-9._~-]{12,}['"]/i, why: 'A credential-like value appears directly in source text.', fix: 'Revoke the exposed value and reference a managed secret.', edit: 'api_key: ${TOOL_API_KEY}\n# Store TOOL_API_KEY in the runner secret manager.' },
    { id: 'destructive', severity: 'HIGH', title: 'Contains a host-impacting command', rx: /\b(?:sudo\s+|chmod\s+777\b|rm\s+-rf\s+[/~]|eval\s*\()/i, why: 'This command can expand authority or cause irreversible host changes.', fix: 'Replace the command with a scoped operation, an approval step, and a rollback.', edit: '# Use a workspace-scoped operation.\n# Require approval before execution.\n# Document and test the rollback step.' },
    { id: 'unpinned-npx', severity: 'MEDIUM', title: 'Installs a moving npm package version', rx: /\bnpx\s+(?:-y\s+)?(?![^\s]+@\d+(?:\.\d+){0,2}\b)[^\s]+/i, why: 'The package resolved today may not be the one you reviewed.', fix: 'Pin the exact reviewed package version.', edit: 'npx <package>@<reviewed-version>' },
    { id: 'broad-permission', severity: 'MEDIUM', title: 'Requests broad shell permissions', rx: /\b(?:permissions?|capabilities?)\s*:\s*(?:\*|all|write-all|shell|bash)\b/i, why: 'The declared authority is wider than a narrowly scoped agent task.', fix: 'Start read-only and deny shell and network access unless the task proves it needs them.', edit: 'permissions:\n  workspace: read\n  shell: deny\n  network: allowlisted' },
    { id: 'endpoint', severity: 'INFO', title: 'Declares an external service endpoint', rx: /\bhttps?:\/\/(?!github\.com|api\.github\.com|npmjs\.com)[^\s'"<>]+/i, why: 'External services create an outbound data boundary to validate.', fix: 'Declare the host, purpose, data sent, authentication, and approval rule.', edit: 'outbound_hosts:\n  - host: <hostname>\n    purpose: <data sent and why>\n    approval: required' }
  ];

  const style = document.createElement('style');
  style.textContent = [
    '.scanner .mode{display:none!important}',
    '.scanner .scan-panel>p{max-width:650px;margin:5px 0 18px;line-height:1.55}',
    '.scanner .preview strong{font-size:13px}',
    '.scan-results{margin:28px 0 0;padding:28px;border:1px solid #383838;border-radius:14px;background:rgba(12,12,12,.96);box-shadow:0 26px 90px #0008;opacity:0;transform:translateY(12px);transition:opacity .42s ease,transform .5s cubic-bezier(.16,1,.3,1);scroll-margin-top:88px}',
    '.scan-results.ready{opacity:1;transform:none}',
    '.scan-result-head{display:grid;grid-template-columns:126px minmax(0,1fr) auto;gap:24px;align-items:center;padding-bottom:26px;border-bottom:1px solid #303030}',
    '.scan-result-score{display:grid;place-content:center;width:118px;height:118px;border:1px solid #4a4a4a;border-radius:50%;text-align:center;background:#0a0a0a}',
    '.scan-result-score strong{font-size:44px;font-weight:500;line-height:1;letter-spacing:-.08em}',
    '.scan-result-score span{margin-top:5px;color:#8e8e89;font:9px DM Mono,monospace}',
    '.scan-result-head h2{margin:8px 0 7px;font-size:clamp(25px,3vw,39px);font-weight:500;line-height:1.03;letter-spacing:-.065em}',
    '.scan-result-head p{max-width:620px;margin:0;color:#9e9e99;font-size:12px;line-height:1.6}',
    '.scan-result-verdict{align-self:start;padding:7px 9px;border:1px solid #4a4a4a;border-radius:6px;color:#c8c8c2;font:9px DM Mono,monospace;white-space:nowrap}',
    '.scan-result-meta{color:#8c8c87;font:9px DM Mono,monospace;letter-spacing:.04em}',
    '.scan-result-metrics{display:grid;grid-template-columns:repeat(3,1fr);margin:22px 0 30px;border:1px solid #303030;border-right:0}',
    '.scan-result-metric{padding:14px 16px;border-right:1px solid #303030}',
    '.scan-result-metric b{display:block;font-size:21px;font-weight:500;letter-spacing:-.04em}',
    '.scan-result-metric span{color:#8d8d88;font:9px DM Mono,monospace}',
    '.scan-plan-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:13px}',
    '.scan-plan-head h3{margin:0;font-size:18px;font-weight:500;letter-spacing:-.04em}',
    '.scan-plan-head p{max-width:440px;margin:0;color:#8f8f8a;font-size:11px;line-height:1.5;text-align:right}',
    '.scan-action-list{display:grid;gap:10px}',
    '.scan-action{border:1px solid #343434;border-radius:10px;background:#0d0d0d;overflow:hidden}',
    '.scan-action[data-severity="CRITICAL"],.scan-action[data-severity="HIGH"]{border-left:3px solid #ef6a62}',
    '.scan-action[data-severity="MEDIUM"]{border-left:3px solid #f2aa50}',
    '.scan-action[data-severity="INFO"]{border-left:3px solid #72c68d}',
    '.scan-action-top{display:flex;align-items:start;justify-content:space-between;gap:16px;padding:17px 18px 14px}',
    '.scan-action-priority{display:block;margin-bottom:6px;color:#91918c;font:9px DM Mono,monospace;letter-spacing:.07em}',
    '.scan-action h4{margin:0;font-size:14px;font-weight:500}',
    '.scan-source{display:inline-block;margin-top:7px;color:#bebeb8;font:10px DM Mono,monospace;text-decoration:underline;text-decoration-color:#4f4f4f;text-underline-offset:3px}',
    '.scan-source:hover{color:#fff;text-decoration-color:#fff}',
    '.scan-action-body{display:grid;grid-template-columns:.75fr 1.25fr;gap:20px;padding:16px 18px;border-top:1px solid #292929;background:#0a0a0a}',
    '.scan-action-body p{margin:0;color:#9d9d98;font-size:11px;line-height:1.6}',
    '.scan-action-body p+p{margin-top:10px}',
    '.scan-edit{padding:14px;border:1px solid #333;border-radius:8px;background:#0d0d0d}',
    '.scan-edit-head{display:flex;justify-content:space-between;gap:12px;align-items:center}',
    '.scan-edit-head b{font-size:11px;font-weight:500}',
    '.scan-copy{padding:5px 7px;border:1px solid #424242;border-radius:5px;background:transparent;color:#cfcfc9;font-size:9px}',
    '.scan-copy:hover{border-color:#777;background:#181818}',
    '.scan-edit pre,.scan-match code{display:block;margin:11px 0 0;padding:10px;border-radius:6px;background:#070707;color:#c9c9c3;font:9px/1.55 DM Mono,monospace;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.scan-match{margin-top:10px}',
    '.scan-match summary{cursor:pointer;color:#8e8e89;font-size:10px}',
    '.scan-launch-plan{margin-top:30px;padding-top:24px;border-top:1px solid #303030}',
    '.scan-launch-plan .scan-plan-head{margin-bottom:0}',
    '.scan-defaults{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:24px}',
    '.scan-default{padding:15px;border:1px solid #303030;border-radius:9px;background:#0c0c0c}',
    '.scan-default span{color:#858580;font:9px DM Mono,monospace}',
    '.scan-default b{display:block;margin-top:10px;font-size:12px;font-weight:500}',
    '.scan-default p{margin:5px 0 0;color:#8f8f8a;font-size:10px;line-height:1.5}',
    '.scan-result-actions{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:24px;padding-top:20px;border-top:1px solid #303030}',
    '.scan-result-actions>div{display:flex;gap:8px;flex-wrap:wrap}',
    '@media(max-width:760px){.scan-result-head{grid-template-columns:96px 1fr}.scan-result-score{width:90px;height:90px}.scan-result-score strong{font-size:34px}.scan-result-verdict{grid-column:1/-1;justify-self:start}.scan-action-body{grid-template-columns:1fr}.scan-defaults{grid-template-columns:1fr}.scan-plan-head{align-items:start;flex-direction:column;gap:5px}.scan-plan-head p{text-align:left}.scan-results{padding:22px}}',
    '@media(max-width:620px){.toolbar-link:nth-of-type(2),.toolbar-link:nth-of-type(3){display:none}}',
    '@media(max-width:520px){.scan-result-head{grid-template-columns:1fr}.scan-result-score{width:82px;height:82px}.scan-result-metrics{grid-template-columns:1fr}.scan-result-metric{border-bottom:1px solid #303030}.scan-result-metric:last-child{border-bottom:0}.scan-action-top{flex-direction:column}.scan-result-actions,.scan-result-actions>div{width:100%}.scan-result-actions .button{flex:1;justify-content:center}.scan-results{padding:18px}}',
    '@media(prefers-reduced-motion:reduce){.scan-results{transition:none}}'
  ].join('');
  document.head.append(style);

  const lineAt = (text, index) => {
    const line = text.slice(0, index).split('\n').length;
    return { line, excerpt: ((text.split('\n')[line - 1]) || '').trim().slice(0, 180) || 'Pattern spans multiple lines' };
  };
  const analyze = (text, file) => rules.flatMap(rule => {
    const match = rule.rx.exec(text);
    if (!match) return [];
    const at = lineAt(text, match.index);
    return [{ ...rule, file, line: at.line, excerpt: at.excerpt, matched: match[0] }];
  });
  const score = findings => {
    const unique = [...new Map(findings.filter(item => item.severity !== 'INFO').map(item => [item.id, item])).values()];
    const weights = { CRITICAL: 42, HIGH: 24, MEDIUM: 7 };
    let value = Math.max(0, 100 - unique.reduce((total, item) => total + weights[item.severity], 0));
    const worst = unique.some(item => item.severity === 'CRITICAL') ? 'CRITICAL' : unique.some(item => item.severity === 'HIGH') ? 'HIGH' : unique.some(item => item.severity === 'MEDIUM') ? 'MEDIUM' : 'NONE';
    if (worst === 'CRITICAL') value = Math.min(value, 20);
    if (worst === 'HIGH') value = Math.min(value, 55);
    return { value, grade: value >= 90 ? 'A' : value >= 80 ? 'B' : value >= 65 ? 'C' : value >= 45 ? 'D' : 'F', worst, decision: worst === 'CRITICAL' ? 'Block installation' : worst === 'HIGH' ? 'Review and remediate' : worst === 'MEDIUM' ? 'Safe to evaluate with review' : 'Safe to evaluate', unique };
  };
  const githubPath = (repo, ref, file, route = 'blob') => 'https://github.com/' + repo.split('/').map(encodeURIComponent).join('/') + '/' + route + '/' + encodeURIComponent(ref) + '/' + file.split('/').map(encodeURIComponent).join('/');
  const priority = item => item.severity === 'CRITICAL' || item.severity === 'HIGH' ? 'EDIT BEFORE INSTALL' : item.severity === 'MEDIUM' ? 'EDIT BEFORE PRODUCTION' : 'VERIFY OUTBOUND BOUNDARY';
  const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, INFO: 3 };
  const orderFindings = findings => [...findings].sort((a, b) => riskOrder[a.severity] - riskOrder[b.severity]);
  const endpointHost = item => {
    try { return new URL(String(item.matched || '').replace(/[),.;]+$/, '')).hostname; } catch { return 'declared-host.example'; }
  };
  const reviewItems = findings => {
    const seen = new Set();
    return orderFindings(findings).flatMap(item => {
      const host = item.id === 'endpoint' ? endpointHost(item) : '';
      const key = item.id === 'endpoint' ? item.id + ':' + host : item.id + ':' + item.file + ':' + item.line;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ ...item, host, edit: item.id === 'endpoint' ? item.edit.replace('<hostname>', host) : item.edit }];
    });
  };
  const actionCard = (item, repo, branch, revision, index) => {
    const source = githubPath(repo, revision || branch, item.file) + '#L' + item.line;
    const edit = githubPath(repo, branch, item.file, 'edit') + '#L' + item.line;
    return '<article class="scan-action" data-severity="' + item.severity + '"><div class="scan-action-top"><div><span class="scan-action-priority">' + priority(item) + ' · ' + item.severity + '</span><h4>' + escape(item.title) + '</h4><a class="scan-source" href="' + source + '" target="_blank" rel="noopener">' + escape(item.file) + ':' + item.line + ' ↗</a></div><a class="button ghost" href="' + edit + '" target="_blank" rel="noopener">Edit file on GitHub ↗</a></div><div class="scan-action-body"><div><p><b>Why this matters.</b> ' + escape(item.why) + '</p><p><b>Recommended change.</b> ' + escape(item.fix) + '</p><details class="scan-match"><summary>Show the matched line</summary><code>' + escape(item.excerpt) + '</code></details></div><div class="scan-edit"><div class="scan-edit-head"><b>Copy-ready edit pattern</b><button class="scan-copy" type="button" data-copy-edit="' + index + '">Copy edit</button></div><pre><code>' + escape(item.edit) + '</code></pre></div></div></article>';
  };
  const planText = (repo, findings, files, branch, revision) => {
    const ordered = reviewItems(findings);
    const lines = ['# Tailor Layer edit plan', '', 'Repository: ' + repo, 'Reviewed ref: ' + (revision || branch), 'Files reviewed: ' + files, ''];
    ordered.slice(0, 12).forEach((item, index) => lines.push('## ' + (index + 1) + '. ' + item.title, 'Priority: ' + priority(item), 'Source: ' + item.file + ':' + item.line, 'Why: ' + item.why, 'Change: ' + item.fix, '', item.edit, ''));
    lines.push('## Safe first-run defaults', '- Pin the reviewed commit or release.', '- Deny credentials and shell access by default.', '- Allow only reviewed outbound hosts.', '- Run once in a disposable workspace before production.');
    return lines.join('\n');
  };
  const render = (repo, findings, files, branch, source, revision) => {
    const result = score(findings);
    const ordered = reviewItems(findings);
    const changes = ordered.filter(item => item.severity !== 'INFO');
    const boundaries = ordered.filter(item => item.severity === 'INFO');
    const blockers = changes.filter(item => item.severity === 'CRITICAL' || item.severity === 'HIGH');
    const headline = blockers.length ? 'Make ' + blockers.length + ' change' + (blockers.length === 1 ? '' : 's') + ' before installing.' : changes.length ? 'Review ' + changes.length + ' change' + (changes.length === 1 ? '' : 's') + ' before production.' : 'No blocking patterns found. Lock down the first run.';
    const explanation = blockers.length ? 'Tailor Layer ordered the highest-risk edits first and attached each one to the exact source line.' : changes.length ? 'The repository can be evaluated in isolation after the recommended scope changes are reviewed.' : 'The static scan is clear, but runtime authority, release integrity, and outbound access still need explicit limits.';
    const cards = ordered.length ? ordered.slice(0, 12).map((item, index) => actionCard(item, repo, branch, revision, index)).join('') : '<div class="scan-action" data-severity="INFO"><div class="scan-action-top"><div><span class="scan-action-priority">NO MATCHED RISKY PATTERNS</span><h4>Move directly to safe first-run controls</h4></div></div><div class="scan-action-body"><div><p>Tailor Layer checked agent instructions, execution paths, credentials, package pinning, permissions, and declared endpoints.</p></div><div class="scan-edit"><div class="scan-edit-head"><b>Recommended next move</b></div><pre><code>Pin the reviewed commit.\nStart without credentials.\nAllowlist only required hosts.\nRun in a disposable workspace.</code></pre></div></div></div>';
    return '<div class="scan-result-head"><div class="scan-result-score"><strong>' + result.value + '</strong><span>/ 100 · ' + result.grade + '</span></div><div><div class="scan-result-meta">AUTOMATED REVIEW · ' + escape(repo) + ' · ' + escape((revision || branch).slice(0, 12)) + '</div><h2>' + headline + '</h2><p>' + explanation + ' This is a static review, not proof of runtime safety.</p></div><span class="scan-result-verdict">' + escape(result.decision.toUpperCase()) + '</span></div><div class="scan-result-metrics"><div class="scan-result-metric"><b>' + files + '</b><span>FILES REVIEWED</span></div><div class="scan-result-metric"><b>' + changes.length + '</b><span>RECOMMENDED EDITS</span></div><div class="scan-result-metric"><b>' + boundaries.length + '</b><span>HOSTS TO VERIFY</span></div></div><section><div class="scan-plan-head"><h3>Recommended edit plan</h3><p>One queue, ordered by risk. Every item combines source evidence with the change to make.</p></div><div class="scan-action-list">' + cards + '</div></section><section class="scan-launch-plan"><div class="scan-plan-head"><h3>Safe first-run plan</h3><p>The reviewed commit and discovered hosts are already attached. Confirm the remaining limits before launch.</p></div><div class="scan-defaults"><div class="scan-default"><span>01 · PIN</span><b>Keep the reviewed version</b><p>Record commit ' + escape((revision || branch).slice(0, 12)) + ' before installation.</p></div><div class="scan-default"><span>02 · ISOLATE</span><b>Use a disposable workspace</b><p>Start without production data, credentials, or host-wide access.</p></div><div class="scan-default"><span>03 · OBSERVE</span><b>Compare behavior to the plan</b><p>Stop if commands, destinations, or requested authority drift.</p></div></div></section><div class="scan-result-actions"><button class="button ghost" type="button" id="scan-again">Scan another repository</button><div><button class="button ghost" type="button" id="copy-fix-plan">Copy complete edit plan</button><button class="button" type="button" id="use-first-run">Complete launch plan →</button></div></div><p class="scan-result-meta" style="margin:14px 0 0">Source: ' + escape(source) + '</p>';
  };
  const show = (repo, findings, files, branch, source, revision) => {
    window.dispatchEvent(new CustomEvent('tailorlayer:review-ready', {
      detail: { repo, findings, files, branch, source, revision, score: score(findings) }
    }));
    results.innerHTML = render(repo, findings, files, branch, source, revision);
    results.hidden = false;
    requestAnimationFrame(() => results.classList.add('ready'));
    results.querySelectorAll('[data-copy-edit]').forEach(button => button.onclick = async event => {
      const item = reviewItems(findings)[Number(button.dataset.copyEdit)];
      try { await navigator.clipboard.writeText(item.edit); event.currentTarget.textContent = 'Copied'; } catch { event.currentTarget.textContent = 'Copy unavailable'; }
    });
    $('#copy-fix-plan').onclick = async event => {
      try { await navigator.clipboard.writeText(planText(repo, findings, files, branch, revision)); event.currentTarget.textContent = 'Edit plan copied'; } catch { event.currentTarget.textContent = 'Copy unavailable'; }
    };
    $('#scan-again').onclick = () => { input.focus(); input.select(); scanner.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    $('#use-first-run').onclick = event => window.dispatchEvent(new CustomEvent('tailorlayer:open-first-run', { detail: { trigger: event.currentTarget, focus: 'pin' } }));
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const flatten = (nodes, prefix = '') => nodes.flatMap(node => node.type === 'file' ? [prefix + node.name] : flatten(node.files || [], prefix + node.name + '/'));
  const parse = value => {
    const match = value.trim().match(/(?:github\.com[/:])([^/\s]+)\/([^/\s#?]+)/i);
    if (!match) throw Error('Enter a GitHub repository URL, for example github.com/owner/repository.');
    return { owner: match[1], repo: match[2].replace(/\.git$/i, '') };
  };
  const allowed = /^(?:[^/]+\/)*(?:SKILL\.md|README(?:\.md)?|AGENTS\.md|CLAUDE\.md|Dockerfile|.+\.(?:md|mdx|json|ya?ml|toml|ini|cfg|conf|txt|mcp|[cm]?js|tsx?|py|sh|ps1))$/i;

  const scanner = $('#scanner');
  const status = $('#scan-status');
  const input = $('#scan-input');
  const results = document.createElement('section');
  results.id = 'scan-results';
  results.className = 'scan-results';
  results.hidden = true;
  results.setAttribute('aria-live', 'polite');
  scanner.insertAdjacentElement('afterend', results);
  scanner.querySelector('.scan-panel>p').textContent = 'Paste one public GitHub URL. Tailor Layer finds agent-facing files, traces risky behavior, and builds a prioritized edit plan.';
  scanner.querySelector('.preview strong').textContent = 'One scan. Evidence, fixes, and launch limits.';
  scanner.querySelector('.preview small').textContent = 'exact files · suggested edits · safe first run';
  scanner.querySelector('.grade').textContent = '→';
  input.placeholder = 'https://github.com/owner/repository';
  input.setAttribute('aria-label', 'Public GitHub repository URL');
  $('#scan-button').textContent = 'Scan repository →';
  const steps = $$('.scan-step');
  const stage = index => steps.forEach((step, i) => step.className = 'scan-step ' + (i < index ? 'done' : i === index ? 'active' : ''));
  const finish = () => {
    scanner.classList.remove('scanning');
    $('#scan-button').disabled = false;
    $('#scan-button').textContent = 'Scan repository →';
    setTimeout(() => steps.forEach(step => step.className = 'scan-step'), 1000);
  };
  $('#scan-button').onclick = async () => {
    try {
      const value = input.value.trim();
      results.classList.remove('ready');
      results.hidden = true;
      scanner.classList.add('scanning');
      $('#scan-button').disabled = true;
      $('#scan-button').textContent = 'Scanning…';
      stage(0);
      status.textContent = 'Mapping repository artifacts…';
      const repo = parse(value);
      let branch = 'main';
      let revision = branch;
      let files = [];
      let source = 'GitHub API';
      const meta = await fetch(api + '/repos/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.repo));
      if (meta.ok) {
        const info = await meta.json();
        branch = info.default_branch;
        const branchInfo = await fetch(api + '/repos/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.repo) + '/branches/' + encodeURIComponent(branch)).then(response => response.ok ? response.json() : null);
        revision = branchInfo?.commit?.sha || branch;
        const tree = await fetch(api + '/repos/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.repo) + '/git/trees/' + encodeURIComponent(branch) + '?recursive=1').then(response => response.json());
        files = (tree.tree || []).filter(item => item.type === 'blob').map(item => item.path);
      } else {
        source = 'jsDelivr fallback — GitHub API rate-limited';
        let manifest;
        for (const candidate of ['main', 'master']) {
          const response = await fetch('https://data.jsdelivr.com/v1/package/gh/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.repo) + '@' + candidate);
          if (response.ok) { manifest = await response.json(); branch = candidate; break; }
        }
        if (!manifest) throw Error(meta.status === 403 ? 'GitHub is rate-limited and the public fallback is unavailable. Try again shortly.' : 'Repository not found or unavailable.');
        files = flatten(manifest.files || []);
        revision = branch;
      }
      const selected = files.filter(file => allowed.test(file) && !/node_modules|dist|build|\.git/.test(file)).slice(0, 60);
      if (!selected.length) throw Error('No supported agent artifacts were found.');
      stage(1);
      status.textContent = 'Reading ' + selected.length + ' supported files…';
      const docs = await Promise.all(selected.map(async file => {
        const url = source === 'GitHub API'
          ? 'https://raw.githubusercontent.com/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.repo) + '/' + encodeURIComponent(revision) + '/' + file.split('/').map(encodeURIComponent).join('/')
          : 'https://cdn.jsdelivr.net/gh/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.repo) + '@' + encodeURIComponent(branch) + '/' + file;
        const response = await fetch(url);
        if (!response.ok) return null;
        try {
          return { file, text: await response.text() };
        } catch { return null; }
      }));
      stage(2);
      status.textContent = 'Reviewing authority, instructions, and execution…';
      await wait(350);
      const readable = docs.filter(Boolean);
      const findings = readable.flatMap(doc => analyze(doc.text, doc.file));
      stage(3);
      status.textContent = 'Building prioritized edits…';
      await wait(250);
      show(repo.owner + '/' + repo.repo, findings, readable.length, branch, source, revision);
      status.textContent = 'Edit plan ready · ' + score(findings).value + '/100';
    } catch (error) {
      status.textContent = error.message || 'The scan could not be completed.';
    } finally {
      finish();
    }
  };
  input.onkeydown = event => { if (event.key === 'Enter') $('#scan-button').click(); };
})();

(() => {
  const menu = document.querySelector('#explore-menu');
  const trigger = document.querySelector('#explore-button');
  if (!menu || !trigger) return;
  const close = () => { menu.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); };
  const toggle = event => {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    trigger.setAttribute('aria-expanded', String(isOpen));
  };
  trigger.onclick = toggle;
  menu.querySelectorAll('a[href^="#"]').forEach(link => link.onclick = () => close());
  document.addEventListener('click', event => { if (!menu.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
})();
