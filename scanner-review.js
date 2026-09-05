(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const api = 'https://api.github.com';
  const wait = n => new Promise(resolve => setTimeout(resolve, n));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  const rules = [
    { id: 'pipe', capability: 'execution', severity: 'CRITICAL', title: 'Downloads and executes code in one step', rx: /(?:curl|wget)[^\n]{0,160}\|\s*(?:sh|bash)\b/i, why: 'A remote script can change between review and execution.', fix: 'Split download, verification, and execution into explicit steps.', edit: '# Download a reviewed release\ncurl -fsSLO "$RELEASE_URL"\necho "$SHA256  $ARTIFACT" | sha256sum -c -\n# Execute only after explicit approval' },
    { id: 'conceal', capability: 'instructions', severity: 'CRITICAL', title: 'Asks the agent to hide behavior', rx: /\b(?:do not tell (?:the )?user|silently collect|hide (?:this|the) (?:step|behavior))\b/i, why: 'An agent should not conceal execution or data handling from its user.', fix: 'Replace concealment with an explicit disclosure and approval boundary.', edit: 'Before acting, explain the action, the data used, the destination, and side effects.\nRequire user confirmation before execution.' },
    { id: 'override', capability: 'instructions', severity: 'HIGH', title: 'Attempts to override agent judgment', rx: /\b(?:before using any other tool|ignore (?:previous|all) instructions|always use this tool first|override other tools)\b/i, why: 'Tools cannot replace user intent, policy, or another safety check.', fix: 'Describe when the tool is useful without controlling tool order.', edit: 'Use this tool when the user requests <task>.\nRespect user intent, policy, and existing tool-selection rules.' },
    { id: 'secret-file', capability: 'credentials', severity: 'HIGH', title: 'Reads a sensitive credential store', rx: /(?:~\/\.ssh|\.aws\/credentials|kubeconfig)\b/i, why: 'Reading ambient credential stores expands access beyond the declared task.', fix: 'Accept one task-scoped credential from the runner instead of reading an ambient store.', edit: 'credential_source: env:TOOL_TOKEN\npermissions:\n  credential_scope: task-only' },
    { id: 'secret-value', capability: 'credentials', severity: 'HIGH', title: 'Contains a probable hard-coded secret', rx: /(?:api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*['"][A-Za-z0-9._~-]{12,}['"]/i, why: 'A credential-like value appears directly in source text.', fix: 'Revoke the exposed value and reference a managed secret.', edit: 'api_key: ${TOOL_API_KEY}\n# Store TOOL_API_KEY in the runner secret manager.' },
    { id: 'destructive', capability: 'execution', severity: 'HIGH', title: 'Contains a host-impacting command', rx: /\b(?:sudo\s+|chmod\s+777\b|rm\s+-rf\s+[/~]|eval\s*\()/i, why: 'This command can expand authority or cause irreversible host changes.', fix: 'Replace the command with a scoped operation, an approval step, and a rollback.', edit: '# Use a workspace-scoped operation.\n# Require approval before execution.\n# Document and test the rollback step.' },
    { id: 'command-api', capability: 'execution', severity: 'HIGH', title: 'Can invoke local commands', files: /\.(?:[cm]?js|tsx?|py|rb|php|go|rs|sh|ps1)$/i, rx: /(?:\bchild_process\b|\bexecSync\s*\(|\bspawnSync\s*\(|\bsubprocess\.(?:run|Popen|call)\s*\(|\bos\.system\s*\(|\bshell\s*=\s*True\b)/i, why: 'The implementation can start local commands outside the agent’s text-only reasoning boundary.', fix: 'Document the exact commands, constrain arguments, and require approval for host-changing execution.', edit: 'command_policy:\n  default: deny\n  allow:\n    - executable: <reviewed-binary>\n      args: [<fixed-or-validated-args>]\n      approval: required' },
    { id: 'install-hook', capability: 'supply-chain', severity: 'HIGH', title: 'Runs code during package installation', files: /(?:^|\/)package\.json$/i, rx: /"(?:preinstall|install|postinstall)"\s*:\s*"[^"]+"/i, why: 'Package-manager lifecycle hooks execute automatically during installation.', fix: 'Remove the hook or make installation behavior explicit, pinned, and independently reviewable.', edit: '"scripts": {\n  "setup:reviewed": "node ./scripts/setup.js"\n}\n// Run only after reviewing the pinned package and script.' },
    { id: 'docker-authority', capability: 'execution', severity: 'HIGH', title: 'Requests host-level container authority', rx: /(?:\/var\/run\/docker\.sock|--privileged\b|privileged\s*:\s*true)/i, why: 'Docker socket or privileged-container access can become host-level authority.', fix: 'Remove privileged access and mount only the narrow resources required by the task.', edit: 'security_opt:\n  - no-new-privileges:true\nread_only: true\n# Do not mount /var/run/docker.sock.' },
    { id: 'unpinned-npx', capability: 'supply-chain', severity: 'MEDIUM', title: 'Installs a moving npm package version', rx: /\bnpx\s+(?:-y\s+)?(?![^\s]+@\d+(?:\.\d+){0,2}\b)[^\s]+/i, why: 'The package resolved today may not be the one you reviewed.', fix: 'Pin the exact reviewed package version.', edit: 'npx <package>@<reviewed-version>' },
    { id: 'broad-permission', capability: 'authority', severity: 'MEDIUM', title: 'Requests broad shell permissions', rx: /\b(?:permissions?|capabilities?)\s*:\s*(?:\*|all|write-all|shell|bash)\b/i, why: 'The declared authority is wider than a narrowly scoped agent task.', fix: 'Start read-only and deny shell and network access unless the task proves it needs them.', edit: 'permissions:\n  workspace: read\n  shell: deny\n  network: allowlisted' },
    { id: 'wildcard-network', capability: 'network', severity: 'MEDIUM', title: 'Allows unrestricted outbound network access', rx: /(?:allowed?_hosts?|network|egress)[^\n]{0,80}(?:\*|0\.0\.0\.0\/0)/i, why: 'A wildcard network rule lets runtime traffic escape the reviewed host set.', fix: 'Replace wildcard egress with an explicit hostname allowlist.', edit: 'network:\n  default: deny\n  allowed_hosts:\n    - <reviewed-hostname>' },
    { id: 'filesystem-write', capability: 'filesystem', severity: 'MEDIUM', title: 'Can modify workspace files', files: /\.(?:[cm]?js|tsx?|py|rb|php|go|rs|sh|ps1)$/i, rx: /\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|unlink(?:Sync)?|rmSync|rmdirSync|\.write_text\s*\(|shutil\.rmtree\s*\(|File\.write\s*\()/i, why: 'The implementation can modify or remove workspace content.', fix: 'Limit writes to a named workspace path and require approval for deletion or overwrite.', edit: 'filesystem:\n  read: ["<task-workspace>"]\n  write: ["<task-workspace>/output"]\n  delete: deny' },
    { id: 'credential-env', capability: 'credentials', severity: 'INFO', title: 'Reads a credential from the environment', files: /\.(?:[cm]?js|tsx?|py|rb|php|go|rs)$/i, rx: /(?:process\.env\.[A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD)|os\.(?:getenv|environ\.get)\s*\(\s*['"][A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD))/i, why: 'The runtime expects a credential-bearing environment value.', fix: 'Document its exact scope and provide a new task-specific credential at runtime.', edit: 'credentials:\n  source: env:<NAME>\n  scope: <minimum-required>\n  lifetime: first-run-only' },
    { id: 'network-client', capability: 'network', severity: 'INFO', title: 'Can make outbound network requests', files: /\.(?:[cm]?js|tsx?|py|rb|php|go|rs)$/i, rx: /\b(?:fetch\s*\(|axios\.(?:get|post|put|delete)\s*\(|requests\.(?:get|post|put|delete)\s*\(|httpx\.(?:get|post|put|delete)\s*\()/i, why: 'The implementation contains an outbound request path whose runtime destination may be dynamic.', fix: 'Trace the URL source and add every allowed production hostname to the launch policy.', edit: 'network:\n  default: deny\n  allowed_hosts:\n    - <verified-runtime-host>' },
    { id: 'endpoint', capability: 'network', severity: 'INFO', title: 'Declares an external service endpoint', rx: /\bhttps?:\/\/(?!github\.com|api\.github\.com|npmjs\.com)[^\s'"<>]+/i, why: 'External services create an outbound data boundary to validate.', fix: 'Declare the host, purpose, data sent, authentication, and approval rule.', edit: 'outbound_hosts:\n  - host: <hostname>\n    purpose: <data sent and why>\n    approval: required' }
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
    '.scan-result-verdict{display:inline-flex;align-items:center;gap:7px;align-self:start;padding:5px 9px 5px 6px;border:1px solid #4a4a4a;border-radius:7px;color:#c8c8c2;font:9px DM Mono,monospace;white-space:nowrap}',
    '.scan-result-meta{color:#8c8c87;font:9px DM Mono,monospace;letter-spacing:.04em}',
    '.scan-result-metrics{display:grid;grid-template-columns:repeat(4,1fr);margin:22px 0 30px;border:1px solid #303030;border-right:0}',
    '.scan-result-metric{padding:14px 16px;border-right:1px solid #303030}',
    '.scan-result-metric b{display:block;font-size:21px;font-weight:500;letter-spacing:-.04em}',
    '.scan-result-metric span{color:#8d8d88;font:9px DM Mono,monospace}',
    '.capability-section{margin:0 0 32px;padding:0 0 30px;border-bottom:1px solid #303030}',
    '.capability-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.72fr);gap:28px;align-items:end;margin-bottom:16px}',
    '.capability-head h3{margin:0;font-size:21px;font-weight:500;letter-spacing:-.045em}',
    '.capability-head p{margin:0;color:#92928d;font-size:12px;line-height:1.55}',
    '.capability-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}',
    '.capability-card{position:relative;min-height:142px;padding:15px;border:1px solid #333;border-radius:10px;background:linear-gradient(145deg,#101010,#0a0a0a);color:#e7e7e2;text-align:left;overflow:hidden}',
    '.capability-card[data-active="true"]{cursor:pointer;transition:transform .25s cubic-bezier(.16,1,.3,1),border-color .2s ease,background .2s ease}',
    '.capability-card[data-active="true"]:hover{transform:translateY(-3px);border-color:#555;background:#141414}',
    '.capability-card:before{content:"";position:absolute;inset:auto -25% -65% 25%;height:130px;border-radius:50%;background:radial-gradient(ellipse,var(--capability-glow,rgba(121,214,145,.08)),transparent 68%);pointer-events:none}',
    '.capability-card[data-tone="block"]{--capability-color:#ff7e78;--capability-line:rgba(255,126,120,.34);--capability-glow:rgba(255,93,86,.13);border-color:var(--capability-line)}',
    '.capability-card[data-tone="review"]{--capability-color:#f4bd58;--capability-line:rgba(244,189,88,.3);--capability-glow:rgba(244,174,64,.11);border-color:var(--capability-line)}',
    '.capability-card[data-tone="observe"]{--capability-color:#79d899;--capability-line:rgba(121,216,153,.25);--capability-glow:rgba(64,190,125,.09);border-color:var(--capability-line)}',
    '.capability-card[data-tone="clear"]{--capability-color:#777;--capability-glow:rgba(255,255,255,.035)}',
    '.capability-card-top{position:relative;display:flex;align-items:center;justify-content:space-between;gap:10px}',
    '.capability-card-top span:first-child{color:#8a8a85;font:9px DM Mono,monospace;letter-spacing:.07em}',
    '.capability-state{display:inline-flex;align-items:center;gap:6px;color:var(--capability-color);font:9px DM Mono,monospace;letter-spacing:.05em}',
    '.capability-state:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor}',
    '.capability-card b{position:relative;display:block;margin-top:28px;font-size:15px;font-weight:500;letter-spacing:-.025em}',
    '.capability-card small{position:relative;display:block;margin-top:6px;color:#8e8e89;font-size:10px;line-height:1.45}',
    '.capability-card em{position:relative;display:block;margin-top:10px;color:#b5b5af;font:9px DM Mono,monospace;font-style:normal}',
    '.coverage-panel{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:center;margin-top:12px;padding:15px 16px;border:1px solid #303030;border-radius:10px;background:#0b0b0b}',
    '.coverage-copy b{display:block;font-size:12px;font-weight:500}',
    '.coverage-copy span{display:block;margin-top:4px;color:#8b8b86;font-size:10px;line-height:1.45}',
    '.coverage-types{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}',
    '.coverage-types span{padding:5px 7px;border:1px solid #343434;border-radius:5px;color:#a1a19b;font:9px DM Mono,monospace}',
    '.scan-plan-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:13px}',
    '.scan-plan-head h3{margin:0;font-size:18px;font-weight:500;letter-spacing:-.04em}',
    '.scan-plan-head p{max-width:440px;margin:0;color:#8f8f8a;font-size:11px;line-height:1.5;text-align:right}',
    '.scan-action-list{display:grid;gap:10px}',
    '.scan-action{border:1px solid #343434;border-radius:10px;background:#0d0d0d;overflow:hidden;scroll-margin-top:100px;transition:border-color .25s ease,box-shadow .25s ease}',
    '.scan-action.capability-focus{border-color:#777;box-shadow:0 0 0 3px rgba(255,255,255,.06),0 18px 50px #0008}',
    '.scan-action[data-severity="CRITICAL"],.scan-action[data-severity="HIGH"],.scan-result-verdict[data-severity="CRITICAL"],.scan-result-verdict[data-severity="HIGH"]{--severity-color:#ff6f68;--severity-bg:rgba(255,111,104,.1);--severity-line:rgba(255,111,104,.32)}',
    '.scan-action[data-severity="MEDIUM"],.scan-result-verdict[data-severity="MEDIUM"]{--severity-color:#f3b94f;--severity-bg:rgba(243,185,79,.1);--severity-line:rgba(243,185,79,.3)}',
    '.scan-action[data-severity="INFO"],.scan-action[data-severity="NONE"],.scan-result-verdict[data-severity="INFO"],.scan-result-verdict[data-severity="NONE"]{--severity-color:#71d691;--severity-bg:rgba(113,214,145,.09);--severity-line:rgba(113,214,145,.28)}',
    '.scan-action-top{display:flex;align-items:start;justify-content:space-between;gap:16px;padding:17px 18px 14px}',
    '.scan-action-heading{display:flex;align-items:flex-start;gap:12px;min-width:0}',
    '.scan-severity-icon{position:relative;display:grid;place-items:center;flex:0 0 30px;width:30px;height:30px;border:1px solid var(--severity-line);border-radius:8px;background:var(--severity-bg);color:var(--severity-color);box-shadow:inset 0 1px rgba(255,255,255,.035),0 0 18px -8px var(--severity-color)}',
    '.scan-severity-icon svg{width:16px;height:16px;overflow:visible;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;fill:none}',
    '.scan-severity-icon:after{content:"";position:absolute;inset:-1px;border:1px solid var(--severity-line);border-radius:inherit;opacity:0;animation:scan-status-pulse 2.8s cubic-bezier(.16,1,.3,1) infinite}',
    '.scan-severity-icon.compact{flex-basis:22px;width:22px;height:22px;border-radius:6px}.scan-severity-icon.compact svg{width:13px;height:13px}.scan-severity-icon.compact:after{display:none}',
    '@keyframes scan-status-pulse{0%,58%{opacity:0;transform:scale(.82)}72%{opacity:.45}100%{opacity:0;transform:scale(1.38)}}',
    '.scan-action-priority{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:6px;color:#91918c;font:9px DM Mono,monospace;letter-spacing:.07em}',
    '.scan-scope{padding:3px 5px;border:1px solid #3b3b3b;border-radius:4px;color:#b4b4ae;letter-spacing:.04em}',
    '.scan-action h4{margin:0;font-size:14px;font-weight:500}',
    '.scan-source{display:inline-block;margin-top:7px;color:#bebeb8;font:10px DM Mono,monospace;text-decoration:underline;text-decoration-color:#4f4f4f;text-underline-offset:3px}',
    '.scan-source:hover{color:#fff;text-decoration-color:#fff}',
    '.scan-source-count{display:inline-block;margin:7px 0 0 8px;color:#82827d;font:9px DM Mono,monospace}',
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
    '.scan-locations{margin-top:10px;padding-top:10px;border-top:1px solid #262626}',
    '.scan-locations summary{cursor:pointer;color:#a4a49e;font:9px DM Mono,monospace}',
    '.scan-location-list{display:grid;gap:6px;margin-top:9px}',
    '.scan-location-list a,.scan-location-list span{color:#9b9b95;font:9px/1.45 DM Mono,monospace;text-decoration:none;overflow-wrap:anywhere}',
    '.scan-location-list a:hover{color:#fff}',
    '.scan-launch-plan{margin-top:30px;padding-top:24px;border-top:1px solid #303030}',
    '.scan-launch-plan .scan-plan-head{margin-bottom:0}',
    '.scan-defaults{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:24px}',
    '.scan-default{padding:15px;border:1px solid #303030;border-radius:9px;background:#0c0c0c}',
    '.scan-default span{color:#858580;font:9px DM Mono,monospace}',
    '.scan-default b{display:block;margin-top:10px;font-size:12px;font-weight:500}',
    '.scan-default p{margin:5px 0 0;color:#8f8f8a;font-size:10px;line-height:1.5}',
    '.scan-result-actions{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:24px;padding-top:20px;border-top:1px solid #303030}',
    '.scan-result-actions>div{display:flex;gap:8px;flex-wrap:wrap}',
    '@media(max-width:760px){.scan-result-head{grid-template-columns:96px 1fr}.scan-result-score{width:90px;height:90px}.scan-result-score strong{font-size:34px}.scan-result-verdict{grid-column:1/-1;justify-self:start}.capability-head{grid-template-columns:1fr;gap:7px}.capability-grid{grid-template-columns:1fr 1fr}.coverage-panel{grid-template-columns:1fr}.coverage-types{justify-content:flex-start}.scan-action-body{grid-template-columns:1fr}.scan-defaults{grid-template-columns:1fr}.scan-plan-head{align-items:start;flex-direction:column;gap:5px}.scan-plan-head p{text-align:left}.scan-results{padding:22px}}',
    '@media(max-width:620px){.toolbar-link:nth-of-type(2),.toolbar-link:nth-of-type(3){display:none}}',
    '@media(max-width:520px){.scan-result-head{grid-template-columns:1fr}.scan-result-score{width:82px;height:82px}.scan-result-metrics{grid-template-columns:1fr 1fr}.scan-result-metric{border-bottom:1px solid #303030}.capability-grid{grid-template-columns:1fr}.capability-card{min-height:126px}.scan-action-top{flex-direction:column}.scan-result-actions,.scan-result-actions>div{width:100%}.scan-result-actions .button{flex:1;justify-content:center}.scan-results{padding:18px}}',
    '@media(prefers-reduced-motion:reduce){.scan-results{transition:none}.scan-severity-icon:after{animation:none}}'
  ].join('');
  document.head.append(style);

  const lineAt = (text, index) => {
    const line = text.slice(0, index).split('\n').length;
    return { line, excerpt: ((text.split('\n')[line - 1]) || '').trim().slice(0, 180) || 'Pattern spans multiple lines' };
  };
  const artifactScope = file => {
    if (file === 'Pasted artifact') return 'artifact';
    if (/(?:^|\/)(?:AGENTS|CLAUDE|SKILL)\.md$/i.test(file)) return 'agent instructions';
    if (/^\.github\/workflows\/|(?:^|\/)(?:Jenkinsfile|\.gitlab-ci\.ya?ml)$/i.test(file)) return 'automation';
    if (/(?:^|\/)(?:test|tests|__tests__|spec|specs)(?:\/|$)|\.(?:test|spec)\.[^.]+$/i.test(file)) return 'test';
    if (/(?:^|\/)(?:examples?|demos?|fixtures?)(?:\/|$)/i.test(file)) return 'example';
    if (/\.(?:md|mdx)$/i.test(file)) return 'documentation';
    if (/(?:^|\/)(?:package\.json|pyproject\.toml|Cargo\.toml|go\.mod|Dockerfile|Containerfile|docker-compose\.ya?ml)$/i.test(file)) return 'manifest';
    return 'runtime';
  };
  const runtimeScopes = new Set(['artifact', 'agent instructions', 'runtime', 'manifest']);
  const contextualSeverity = (rule, scope) => {
    if (scope === 'code comment') return 'INFO';
    if ((scope === 'test' || scope === 'example') && ['command-api', 'filesystem-write', 'credential-env', 'network-client'].includes(rule.id)) return 'INFO';
    if ((scope === 'test' || scope === 'example') && rule.severity === 'HIGH') return 'MEDIUM';
    return rule.severity;
  };
  const analyze = (text, file) => rules.flatMap(rule => {
    if (rule.files && file !== 'Pasted artifact' && !rule.files.test(file)) return [];
    const flags = rule.rx.flags.includes('g') ? rule.rx.flags : rule.rx.flags + 'g';
    const matcher = new RegExp(rule.rx.source, flags);
    return [...text.matchAll(matcher)].slice(0, 3).map(match => {
      const at = lineAt(text, match.index);
      let scope = artifactScope(file);
      const commentExample = /^(?:\/\/|#(?!\!)|\*)\s*/.test(at.excerpt) && ['pipe', 'destructive', 'unpinned-npx', 'broad-permission', 'docker-authority'].includes(rule.id);
      if (scope === 'runtime' && commentExample) scope = /\.(?:sh|ps1)$/i.test(file) ? 'example' : 'code comment';
      const capability = rule.id === 'endpoint' && !runtimeScopes.has(scope) ? 'reference' : rule.capability;
      return { ...rule, capability, severity: contextualSeverity(rule, scope), scope, file, line: at.line, excerpt: at.excerpt, matched: match[0] };
    });
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
  const priority = item => (item.scope === 'test' || item.scope === 'example') && item.severity === 'INFO'
    ? 'VERIFY DEVELOPMENT-ONLY'
    : item.capability === 'reference'
      ? 'REFERENCE ONLY'
    : item.severity === 'CRITICAL' || item.severity === 'HIGH'
    ? 'EDIT BEFORE INSTALL'
    : item.severity === 'MEDIUM'
      ? 'EDIT BEFORE PRODUCTION'
      : item.capability === 'network'
        ? 'VERIFY OUTBOUND BOUNDARY'
        : 'DOCUMENT BEFORE RUN';
  const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, INFO: 3 };
  const scopeOrder = { artifact: 0, 'agent instructions': 0, runtime: 1, manifest: 2, automation: 3, documentation: 4, 'code comment': 5, test: 6, example: 7 };
  const orderFindings = findings => [...findings].sort((a, b) => riskOrder[a.severity] - riskOrder[b.severity] || (scopeOrder[a.scope] ?? 9) - (scopeOrder[b.scope] ?? 9));
  const endpointHost = item => {
    const match = String(item.matched || '').match(/^https?:\/\/(?:[^/@\s]+@)?(\[[^\]]+\]|[a-z0-9.-]+)(?::\d+)?/i);
    const host = (match?.[1] || '').replace(/^\[|\]$/g, '').toLowerCase();
    return /^(?:localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3})$/.test(host) ? '' : host;
  };
  const reviewItems = findings => {
    const grouped = new Map();
    orderFindings(findings).forEach(item => {
      const host = item.id === 'endpoint' ? endpointHost(item) : '';
      if (item.id === 'endpoint' && !host) return;
      const key = item.id === 'endpoint' ? item.id + ':' + host : item.id + ':' + item.scope;
      if (!grouped.has(key)) grouped.set(key, { ...item, host, edit: item.id === 'endpoint' ? item.edit.replace('<hostname>', host) : item.edit, occurrences: [] });
      grouped.get(key).occurrences.push(item);
    });
    return [...grouped.values()].map(item => {
      const scopes = new Set(item.occurrences.map(occurrence => occurrence.scope));
      return { ...item, scope: scopes.size > 1 ? 'multiple contexts' : item.scope, sourceCount: new Set(item.occurrences.map(occurrence => occurrence.file + ':' + occurrence.line)).size };
    });
  };
  const capabilityDefinitions = [
    { id: 'instructions', label: 'Agent instructions', active: 'Can steer agent behavior', clear: 'No coercive instruction pattern found' },
    { id: 'execution', label: 'Command execution', active: 'Can execute or install code', clear: 'No execution pattern found' },
    { id: 'filesystem', label: 'Workspace access', active: 'Can change workspace files', clear: 'No write path found' },
    { id: 'credentials', label: 'Credential access', active: 'Can receive or discover credentials', clear: 'No credential path found' },
    { id: 'network', label: 'Outbound network', active: 'Can contact external services', clear: 'No outbound path found' },
    { id: 'authority', label: 'Declared authority', active: 'Requests elevated permissions', clear: 'No broad authority request found' },
    { id: 'supply-chain', label: 'Release integrity', active: 'Runs moving or install-time code', clear: 'No moving install path found' }
  ];
  const capabilityModel = findings => capabilityDefinitions.map(definition => {
    const matches = orderFindings(findings.filter(item => item.capability === definition.id));
    const uniqueSources = new Set(matches.map(item => item.file + ':' + item.line));
    const worst = matches[0]?.severity || 'NONE';
    const tone = worst === 'CRITICAL' || worst === 'HIGH' ? 'block' : worst === 'MEDIUM' ? 'review' : matches.length ? 'observe' : 'clear';
    const status = worst === 'CRITICAL' ? 'BLOCK' : worst === 'HIGH' ? 'RESTRICT' : worst === 'MEDIUM' ? 'REVIEW' : matches.length ? 'DECLARE' : 'NOT FOUND';
    return { ...definition, matches, sources: uniqueSources.size, worst, tone, status };
  });
  const capabilityCards = findings => capabilityModel(findings).map(capability => {
    const tag = capability.matches.length ? 'button' : 'div';
    const action = capability.matches.length ? ' type="button" data-capability-jump="' + capability.id + '"' : '';
    const detail = capability.matches.length
      ? capability.sources + ' source' + (capability.sources === 1 ? '' : 's') + ' · open evidence'
      : 'Static scan did not observe this capability';
    return '<' + tag + ' class="capability-card" data-tone="' + capability.tone + '" data-active="' + Boolean(capability.matches.length) + '"' + action + '><span class="capability-card-top"><span>' + escape(capability.label.toUpperCase()) + '</span><span class="capability-state">' + capability.status + '</span></span><b>' + escape(capability.matches.length ? capability.active : capability.clear) + '</b><small>' + escape(capability.matches[0]?.why || 'Treat this as no matched evidence—not proof the capability is absent at runtime.') + '</small><em>' + escape(detail) + '</em></' + tag + '>';
  }).join('');
  const categoryLabels = { instructions: 'instructions', manifests: 'manifests', automation: 'automation', scripts: 'scripts', source: 'source', configuration: 'configuration' };
  const coverageSummary = coverage => Object.entries(coverage.categories || {}).filter(([, count]) => count).map(([category, count]) => '<span>' + count + ' ' + (categoryLabels[category] || category) + '</span>').join('');
  const severityIcon = (severity, compact = false) => {
    const warning = '<path d="M12 3 21 19H3L12 3Z"/><path d="M12 8v5"/><path d="M12 16h.01"/>';
    const review = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.25"/><path d="M12 16h.01"/>';
    const clear = '<circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.2 2.4 2.4 5.3-5.4"/>';
    const drawing = severity === 'CRITICAL' || severity === 'HIGH' ? warning : severity === 'MEDIUM' ? review : clear;
    return '<span class="scan-severity-icon' + (compact ? ' compact' : '') + '" aria-hidden="true"><svg viewBox="0 0 24 24">' + drawing + '</svg></span>';
  };
  const actionCard = (item, repo, branch, revision, index, pasted) => {
    const source = pasted ? '' : githubPath(repo, revision || branch, item.file) + '#L' + item.line;
    const edit = pasted ? '' : githubPath(repo, branch, item.file, 'edit') + '#L' + item.line;
    const related = (item.occurrences || []).slice(1);
    const sourceControl = pasted
      ? '<span class="scan-source scan-source-local">' + escape(item.file) + ':' + item.line + '</span>'
      : '<a class="scan-source" href="' + source + '" target="_blank" rel="noopener">' + escape(item.file) + ':' + item.line + ' ↗</a>';
    const sourceCount = related.length ? '<span class="scan-source-count">+ ' + related.length + ' related location' + (related.length === 1 ? '' : 's') + '</span>' : '';
    const relatedSources = related.length
      ? '<details class="scan-locations"><summary>View all ' + item.sourceCount + ' matched locations</summary><div class="scan-location-list">' + related.slice(0, 12).map(occurrence => pasted
        ? '<span>' + escape(occurrence.file) + ':' + occurrence.line + ' — ' + escape(occurrence.excerpt) + '</span>'
        : '<a href="' + githubPath(repo, revision || branch, occurrence.file) + '#L' + occurrence.line + '" target="_blank" rel="noopener">' + escape(occurrence.file) + ':' + occurrence.line + ' ↗</a>').join('') + (related.length > 12 ? '<span>+ ' + (related.length - 12) + ' more matched locations</span>' : '') + '</div></details>'
      : '';
    const editControl = pasted ? '' : '<a class="button ghost" href="' + edit + '" target="_blank" rel="noopener">Edit file on GitHub ↗</a>';
    return '<article class="scan-action" data-severity="' + item.severity + '" data-capability="' + escape(item.capability || 'authority') + '"><div class="scan-action-top"><div class="scan-action-heading">' + severityIcon(item.severity) + '<div><span class="scan-action-priority"><span>' + priority(item) + ' · ' + item.severity + '</span><span class="scan-scope">' + escape(item.scope.toUpperCase()) + '</span></span><h4>' + escape(item.title) + '</h4>' + sourceControl + sourceCount + '</div></div>' + editControl + '</div><div class="scan-action-body"><div><p><b>Why this matters.</b> ' + escape(item.why) + '</p><p><b>Recommended change.</b> ' + escape(item.fix) + '</p><details class="scan-match"><summary>Show the matched line</summary><code>' + escape(item.excerpt) + '</code></details>' + relatedSources + '</div><div class="scan-edit"><div class="scan-edit-head"><b>Copy-ready edit pattern</b><button class="scan-copy" type="button" data-copy-edit="' + index + '">Copy edit</button></div><pre><code>' + escape(item.edit) + '</code></pre></div></div></article>';
  };
  const planText = (repo, findings, files, branch, revision) => {
    const ordered = reviewItems(findings);
    const lines = ['# Tailor Layer edit plan', '', 'Repository: ' + repo, 'Reviewed ref: ' + (revision || branch), 'Files reviewed: ' + files, ''];
    lines.push('## Observed capability profile');
    capabilityModel(findings).forEach(capability => lines.push('- ' + capability.label + ': ' + capability.status + (capability.sources ? ' (' + capability.sources + ' source' + (capability.sources === 1 ? '' : 's') + ')' : '')));
    lines.push('');
    ordered.slice(0, 60).forEach((item, index) => lines.push('## ' + (index + 1) + '. ' + item.title, 'Priority: ' + priority(item), 'Context: ' + item.scope, 'Sources: ' + item.occurrences.map(occurrence => occurrence.file + ':' + occurrence.line).join(', '), 'Why: ' + item.why, 'Change: ' + item.fix, '', item.edit, ''));
    lines.push('## Safe first-run defaults', '- Pin the reviewed commit or release.', '- Deny credentials and shell access by default.', '- Allow only reviewed outbound hosts.', '- Run once in a disposable workspace before production.');
    return lines.join('\n');
  };
  const render = (repo, findings, files, branch, source, revision, coverage) => {
    const pasted = source === 'Pasted artifact';
    const result = score(findings);
    const ordered = reviewItems(findings);
    const changes = ordered.filter(item => item.severity !== 'INFO');
    const hosts = [...new Set(ordered.filter(item => item.capability === 'network' && item.host).map(item => item.host))];
    const capabilities = capabilityModel(findings);
    const activeCapabilities = capabilities.filter(item => item.matches.length).length;
    const blockers = changes.filter(item => item.severity === 'CRITICAL' || item.severity === 'HIGH');
    const headline = blockers.length ? 'Make ' + blockers.length + ' change' + (blockers.length === 1 ? '' : 's') + ' before installing.' : changes.length ? 'Review ' + changes.length + ' change' + (changes.length === 1 ? '' : 's') + ' before production.' : 'No blocking patterns found. Lock down the first run.';
    const explanation = blockers.length ? 'Tailor Layer ordered the highest-risk edits first and attached each one to the exact source line.' : changes.length ? 'The repository can be evaluated in isolation after the recommended scope changes are reviewed.' : 'The static scan is clear, but runtime authority, release integrity, and outbound access still need explicit limits.';
    const visibleItems = ordered.slice(0, 30);
    const cards = ordered.length ? visibleItems.map((item, index) => actionCard(item, repo, branch, revision, index, pasted)).join('') + (ordered.length > visibleItems.length ? '<div class="coverage-panel"><div class="coverage-copy"><b>' + (ordered.length - visibleItems.length) + ' lower-priority groups included in the copied plan</b><span>The on-page queue stays focused; Copy complete edit plan includes the remaining evidence.</span></div></div>' : '') : '<div class="scan-action" data-severity="NONE"><div class="scan-action-top"><div class="scan-action-heading">' + severityIcon('NONE') + '<div><span class="scan-action-priority">NO MATCHED RISKY PATTERNS</span><h4>Move directly to safe first-run controls</h4></div></div></div><div class="scan-action-body"><div><p>Tailor Layer checked agent instructions, execution paths, credentials, package pinning, permissions, and declared endpoints.</p></div><div class="scan-edit"><div class="scan-edit-head"><b>Recommended next move</b></div><pre><code>Pin the reviewed version.\nStart without credentials.\nAllowlist only required hosts.\nRun in a disposable workspace.</code></pre></div></div></div>';
    const reviewedUnit = pasted ? 'ARTIFACT REVIEWED' : 'FILES REVIEWED';
    const pinCopy = pasted ? 'Keep fingerprint ' + escape((revision || branch).slice(0, 16)) + ' with the approved artifact.' : 'Record commit ' + escape((revision || branch).slice(0, 12)) + ' before installation.';
    const coverageText = pasted
      ? 'The complete pasted artifact was reviewed.'
      : files + ' of ' + coverage.eligible + ' eligible files were read' + (coverage.omitted ? '; ' + coverage.omitted + ' lower-priority files were outside the browser scan budget' : '') + (coverage.unreadable ? '; ' + coverage.unreadable + ' selected files could not be retrieved.' : '.');
    return '<div class="scan-result-head"><div class="scan-result-score"><strong data-sona-count="' + result.value + '">' + result.value + '</strong><span>/ 100 · ' + result.grade + '</span></div><div><div class="scan-result-meta">AUTOMATED REVIEW · ' + escape(repo) + ' · ' + escape((revision || branch).slice(0, 16)) + '</div><h2>' + headline + '</h2><p>' + explanation + ' This is a static review, not proof of runtime safety.</p></div><span class="scan-result-verdict" data-severity="' + result.worst + '">' + severityIcon(result.worst, true) + '<span>' + escape(result.decision.toUpperCase()) + '</span></span></div>' +
      '<div class="scan-result-metrics"><div class="scan-result-metric"><b>' + files + '</b><span>' + reviewedUnit + '</span></div><div class="scan-result-metric"><b>' + activeCapabilities + '</b><span>CAPABILITIES OBSERVED</span></div><div class="scan-result-metric"><b>' + changes.length + '</b><span>RECOMMENDED EDITS</span></div><div class="scan-result-metric"><b>' + hosts.length + '</b><span>HOSTS TO VERIFY</span></div></div>' +
      '<section class="capability-section"><div class="capability-head"><div><h3>What this agent can do</h3></div><p>A behavior map derived from exact source evidence. Open an observed capability to jump to the code and recommended restriction.</p></div><div class="capability-grid">' + capabilityCards(findings) + '</div><div class="coverage-panel"><div class="coverage-copy"><b>Review coverage</b><span>' + escape(coverageText) + ' High-signal artifacts are prioritized before general source.</span></div><div class="coverage-types">' + coverageSummary(coverage) + '</div></div></section>' +
      '<section><div class="scan-plan-head"><h3>Recommended edit plan</h3><p>One queue, ordered by risk. Every item combines source evidence with the change to make.</p></div><div class="scan-action-list">' + cards + '</div></section><section class="scan-launch-plan"><div class="scan-plan-head"><h3>Safe first-run plan</h3><p>The reviewed version and discovered hosts are already attached. Confirm the remaining limits before launch.</p></div><div class="scan-defaults"><div class="scan-default"><span>01 · PIN</span><b>Keep the reviewed version</b><p>' + pinCopy + '</p></div><div class="scan-default"><span>02 · ISOLATE</span><b>Use a disposable workspace</b><p>Start without production data, credentials, or host-wide access.</p></div><div class="scan-default"><span>03 · OBSERVE</span><b>Compare behavior to the plan</b><p>Stop if commands, destinations, or requested authority drift.</p></div></div></section><div class="scan-result-actions"><button class="button ghost" type="button" id="scan-again">Review another input</button><div><button class="button ghost" type="button" id="copy-fix-plan">Copy complete edit plan</button><button class="button" type="button" id="use-first-run">Complete launch plan →</button></div></div><p class="scan-result-meta" style="margin:14px 0 0">Source: ' + escape(source) + '</p>';
  };
  const show = (repo, findings, files, branch, source, revision, coverage) => {
    const hosts = [...new Set(reviewItems(findings).filter(item => item.capability === 'network' && item.host).map(item => item.host))];
    results.innerHTML = render(repo, findings, files, branch, source, revision, coverage);
    results.hidden = false;
    requestAnimationFrame(() => results.classList.add('ready'));
    window.dispatchEvent(new CustomEvent('tailorlayer:review-ready', {
      detail: { repo, findings, files, branch, source, revision, coverage, hosts, capabilities: capabilityModel(findings), score: score(findings) }
    }));
    results.querySelectorAll('[data-copy-edit]').forEach(button => button.onclick = async event => {
      const target = event.currentTarget;
      const item = reviewItems(findings)[Number(button.dataset.copyEdit)];
      try { await navigator.clipboard.writeText(item.edit); target.textContent = 'Copied'; } catch { target.textContent = 'Copy unavailable'; }
    });
    results.querySelectorAll('[data-capability-jump]').forEach(button => button.onclick = () => {
      const target = results.querySelector('.scan-action[data-capability="' + button.dataset.capabilityJump + '"]');
      if (!target) return;
      target.classList.add('capability-focus');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => target.classList.remove('capability-focus'), 1600);
    });
    $('#copy-fix-plan').onclick = async event => {
      const target = event.currentTarget;
      try { await navigator.clipboard.writeText(planText(repo, findings, files, branch, revision)); target.textContent = 'Edit plan copied'; } catch { target.textContent = 'Copy unavailable'; }
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
  const fingerprint = value => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return 'artifact-' + (hash >>> 0).toString(16).padStart(8, '0');
  };
  const allowed = /^(?:[^/]+\/)*(?:SKILL\.md|README(?:\.md)?|AGENTS\.md|CLAUDE\.md|Dockerfile|Containerfile|.+\.(?:md|mdx|json|ya?ml|toml|ini|cfg|conf|txt|mcp|[cm]?js|tsx?|py|rb|php|go|rs|java|kt|swift|sh|ps1))$/i;
  const ignored = /(?:^|\/)(?:node_modules|vendor|dist|build|coverage|\.git|\.next|target|fixtures?|snapshots?|__tests__)(?:\/|$)|(?:^|\/)(?:package-lock\.json|pnpm-lock\.ya?ml|yarn\.lock|bun\.lockb?)$/i;
  const fileCategory = file => {
    if (/(?:^|\/)(?:AGENTS|CLAUDE|SKILL|README)(?:\.md)?$|\.(?:md|mdx)$/i.test(file)) return 'instructions';
    if (/^\.github\/workflows\/|(?:^|\/)(?:Jenkinsfile|\.gitlab-ci\.ya?ml)$/i.test(file)) return 'automation';
    if (/(?:^|\/)(?:package\.json|pyproject\.toml|Cargo\.toml|go\.mod|Dockerfile|Containerfile|docker-compose\.ya?ml)$/i.test(file)) return 'manifests';
    if (/(?:^|\/)scripts?\/|\.(?:sh|ps1)$/i.test(file)) return 'scripts';
    if (/\.(?:[cm]?js|tsx?|py|rb|php|go|rs|java|kt|swift)$/i.test(file)) return 'source';
    return 'configuration';
  };
  const filePriority = file => {
    const categoryWeight = { instructions: 0, manifests: 10, automation: 20, scripts: 30, configuration: 40, source: 50 }[fileCategory(file)] ?? 60;
    const nameWeight = /(?:^|\/)AGENTS\.md$/i.test(file) ? 0 : /(?:^|\/)SKILL\.md$/i.test(file) ? 1 : /(?:^|\/)CLAUDE\.md$/i.test(file) ? 2 : /(?:^|\/)README(?:\.md)?$/i.test(file) ? 3 : 5;
    return categoryWeight + nameWeight;
  };
  const selectFiles = entries => {
    const eligible = entries
      .map(entry => typeof entry === 'string' ? { path: entry, size: 0 } : entry)
      .filter(entry => allowed.test(entry.path) && !ignored.test(entry.path) && (!entry.size || entry.size <= 350000))
      .sort((a, b) => filePriority(a.path) - filePriority(b.path) || a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));
    const selected = eligible.slice(0, 90);
    const categories = selected.reduce((summary, entry) => {
      const category = fileCategory(entry.path);
      summary[category] = (summary[category] || 0) + 1;
      return summary;
    }, {});
    return { selected, eligible: eligible.length, omitted: Math.max(0, eligible.length - selected.length), categories };
  };

  const scanner = $('#scanner');
  const status = $('#scan-status');
  const input = $('#scan-input');
  const results = document.createElement('section');
  results.id = 'scan-results';
  results.className = 'scan-results';
  results.hidden = true;
  results.setAttribute('aria-live', 'polite');
  scanner.insertAdjacentElement('afterend', results);
  scanner.querySelector('.scan-panel>p').textContent = 'Paste a public GitHub URL or the artifact itself. Tailor Layer detects the format, reviews the content, and builds the prioritized edit and launch plan automatically.';
  scanner.querySelector('.preview strong').textContent = 'One scan. Evidence, fixes, and launch limits.';
  scanner.querySelector('.preview small').textContent = 'exact files · suggested edits · safe first run';
  scanner.querySelector('.grade').textContent = '→';
  input.placeholder = 'Paste a GitHub URL, skill, MCP config, prompt, or agent instructions';
  input.setAttribute('aria-label', 'GitHub repository URL or artifact text');
  $('#scan-button').textContent = 'Review now →';
  const steps = $$('.scan-step');
  const stage = index => steps.forEach((step, i) => step.className = 'scan-step ' + (i < index ? 'done' : i === index ? 'active' : ''));
  const finish = () => {
    scanner.classList.remove('scanning');
    $('#scan-button').disabled = false;
    $('#scan-button').textContent = 'Review now →';
    setTimeout(() => steps.forEach(step => step.className = 'scan-step'), 1000);
  };
  const resizeInput = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(Math.max(input.scrollHeight, 42), 180) + 'px';
  };
  const review = async () => {
    if ($('#scan-button').disabled) return;
    try {
      const value = input.value.trim();
      if (!value) throw Error('Paste a GitHub repository URL or artifact to begin.');
      results.classList.remove('ready');
      results.hidden = true;
      scanner.classList.add('scanning');
      $('#scan-button').disabled = true;
      $('#scan-button').textContent = 'Reviewing…';
      stage(0);
      const isRepository = /(?:github\.com[/:])[^/\s]+\/[^/\s#?]+/i.test(value);
      status.textContent = isRepository ? 'GitHub link detected · mapping artifacts…' : 'Artifact detected · reading instructions…';
      if (!isRepository) {
        if (value.length < 24) throw Error('Paste a little more artifact content so the review has enough context.');
        const artifactId = fingerprint(value);
        stage(1);
        await wait(180);
        status.textContent = 'Tracing instructions, authority, and outbound hosts…';
        stage(2);
        const findings = analyze(value, 'Pasted artifact');
        await wait(220);
        stage(3);
        status.textContent = 'Building suggested edits and safe first-run limits…';
        await wait(180);
        show('Pasted artifact', findings, 1, 'local', 'Pasted artifact', artifactId, { eligible: 1, omitted: 0, categories: { instructions: 1 } });
        status.textContent = 'Complete review ready · ' + score(findings).value + '/100';
        return;
      }
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
        files = (tree.tree || []).filter(item => item.type === 'blob').map(item => ({ path: item.path, size: item.size || 0 }));
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
      const coverage = selectFiles(files);
      const selected = coverage.selected;
      if (!selected.length) throw Error('No supported agent artifacts were found.');
      stage(1);
      status.textContent = 'Reading ' + selected.length + ' prioritized files…';
      const docs = await Promise.all(selected.map(async entry => {
        const file = entry.path;
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
      const reviewedCoverage = {
        ...coverage,
        unreadable: selected.length - readable.length,
        categories: readable.reduce((summary, doc) => {
          const category = fileCategory(doc.file);
          summary[category] = (summary[category] || 0) + 1;
          return summary;
        }, {})
      };
      stage(3);
      status.textContent = 'Building prioritized edits…';
      await wait(250);
      show(repo.owner + '/' + repo.repo, findings, readable.length, branch, source, revision, reviewedCoverage);
      status.textContent = 'Complete review ready · ' + score(findings).value + '/100';
    } catch (error) {
      status.textContent = error.message || 'The scan could not be completed.';
    } finally {
      finish();
    }
  };
  $('#scan-button').onclick = review;
  input.addEventListener('input', resizeInput);
  input.addEventListener('paste', () => {
    status.textContent = 'Input detected · starting review…';
    setTimeout(() => { resizeInput(); review(); }, 120);
  });
  input.onkeydown = event => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      review();
    }
  };
  resizeInput();
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
