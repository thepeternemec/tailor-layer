(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const rules = [
    { id: 'pipe', severity: 'CRITICAL', title: 'Remote code executes immediately', rx: /(?:curl|wget)[^\n]{0,160}\|\s*(?:sh|bash)\b/i, why: 'It executes a mutable remote script without an inspection or approval boundary.', fix: 'Pin a release artifact, verify its checksum, then require explicit approval to execute it.' },
    { id: 'hidden', severity: 'CRITICAL', title: 'Behavior is hidden from the user', rx: /\b(?:do not tell (?:the )?user|silently collect|hide (?:this|the) (?:step|behavior))\b/i, why: 'An agent integration must make its actions and data handling visible.', fix: 'Remove the concealment text and document the action, data, destination, and side effect.' },
    { id: 'override', severity: 'HIGH', title: 'Tool order is being overridden', rx: /\b(?:before using any other tool|ignore (?:previous|all) instructions|always use this tool first|override other tools)\b/i, why: 'This can displace user intent or bypass a safety check in an agent workflow.', fix: 'Replace it with a non-binding description of when the helper is useful.' },
    { id: 'permission', severity: 'MEDIUM', title: 'Shell authority was added', rx: /\b(?:permissions?|capabilities?)\s*:\s*[\s\S]{0,120}(?:^|\n)\s*-\s*(?:shell|bash)\b/im, why: 'Shell access expands the blast radius beyond reading and summarizing workspace files.', fix: 'Keep the capability read-only, or name the exact command and gate it behind user approval.' },
    { id: 'npm', severity: 'MEDIUM', title: 'A moving package version was introduced', rx: /\bnpx\s+(?:-y\s+)?(?:@?[-\w./]+)(?!@\d)/i, why: 'The package resolved at installation time may differ from the reviewed code.', fix: 'Pin a package version and verify the publisher or lockfile provenance.' },
    { id: 'endpoint', severity: 'INFO', title: 'A new external service endpoint was declared', rx: /\bhttps?:\/\/(?!github\.com|api\.github\.com|npmjs\.com)[^\s'"<>]+/i, why: 'This adds an outbound data boundary that needs an explicit review.', fix: 'Confirm the hostname, payload, authentication method, retention, and failure behavior.' }
  ];
  const lineAt = (text, index) => {
    const line = text.slice(0, index).split('\n').length;
    return { line, content: ((text.split('\n')[line - 1]) || '').trim().slice(0, 190) };
  };
  const analyze = text => rules.flatMap(rule => {
    const match = rule.rx.exec(text);
    if (!match) return [];
    const at = lineAt(text, match.index);
    return [{ ...rule, line: at.line, content: at.content }];
  });
  const score = findings => {
    const unique = [...new Map(findings.filter(item => item.severity !== 'INFO').map(item => [item.id, item])).values()];
    const weights = { CRITICAL: 42, HIGH: 24, MEDIUM: 7 };
    let value = Math.max(0, 100 - unique.reduce((total, item) => total + weights[item.severity], 0));
    const worst = unique.some(item => item.severity === 'CRITICAL') ? 'CRITICAL' : unique.some(item => item.severity === 'HIGH') ? 'HIGH' : unique.some(item => item.severity === 'MEDIUM') ? 'MEDIUM' : 'NONE';
    if (worst === 'CRITICAL') value = Math.min(value, 20);
    if (worst === 'HIGH') value = Math.min(value, 55);
    return { value, grade: value >= 90 ? 'A' : value >= 80 ? 'B' : value >= 65 ? 'C' : value >= 45 ? 'D' : 'F', worst };
  };
  const diffLines = (before, after) => {
    const oldLines = before.split('\n'), newLines = after.split('\n'), lines = [];
    for (let index = 0; index < Math.max(oldLines.length, newLines.length); index++) {
      if (oldLines[index] === newLines[index]) continue;
      if (oldLines[index] !== undefined) lines.push({ kind: 'remove', number: index + 1, text: oldLines[index] });
      if (newLines[index] !== undefined) lines.push({ kind: 'add', number: index + 1, text: newLines[index] });
    }
    return lines.slice(0, 18);
  };
  const finding = (item, state) => '<article class="drift-finding" data-state="' + state + '" data-filter="' + state + '" id="drift-' + state + '-' + item.id + '"><div class="evidence-top"><h4>' + escape(item.title) + '</h4><span class="tag severity-' + item.severity.toLowerCase() + '">' + item.severity + '</span></div><p>' + escape(item.why) + '</p><code>line ' + item.line + ' · ' + escape(item.content) + '</code><div class="fix"><b>Suggested change</b><p>' + escape(item.fix) + '</p></div></article>';
  const line = item => '<div class="diff-line ' + item.kind + '"><span>' + (item.kind === 'add' ? '+' : '−') + item.number + '</span><span>' + escape(item.text) + '</span></div>';
  const render = (beforeText, afterText) => {
    const before = analyze(beforeText), after = analyze(afterText);
    const beforeMap = new Map(before.map(item => [item.id, item])), afterMap = new Map(after.map(item => [item.id, item]));
    const introduced = after.filter(item => !beforeMap.has(item.id));
    const resolved = before.filter(item => !afterMap.has(item.id));
    const stable = after.filter(item => beforeMap.has(item.id));
    const oldScore = score(before), newScore = score(after), changed = diffLines(beforeText, afterText);
    const reviewCount = introduced.filter(item => item.severity === 'CRITICAL' || item.severity === 'HIGH' || item.severity === 'MEDIUM').length;
    return '<div class="drift-summary"><div class="drift-score"><small>PREVIOUS</small><strong>' + oldScore.value + '</strong><span>' + oldScore.grade + ' / 100</span></div><div class="drift-arrow">→</div><div class="drift-score"><small>CANDIDATE</small><strong>' + newScore.value + '</strong><span>' + newScore.grade + ' / 100</span></div><div class="drift-callout"><b>' + introduced.length + ' introduced finding' + (introduced.length === 1 ? '' : 's') + '</b><p>' + (reviewCount ? reviewCount + ' require a developer decision before production use.' : 'No new review-required behavior was detected.') + '</p></div></div><div class="drift-tabs" role="tablist"><button type="button" class="active" data-drift-filter="all">All changes</button><button type="button" data-drift-filter="introduced">Introduced (' + introduced.length + ')</button><button type="button" data-drift-filter="resolved">Resolved (' + resolved.length + ')</button><button type="button" data-drift-filter="stable">Stable (' + stable.length + ')</button></div><div class="drift-view"><section class="diff-panel"><h3>Changed artifact lines</h3>' + (changed.length ? changed.map(line).join('') : '<p>No text changes found.</p>') + '</section><section class="diff-panel"><h3>Decision guide</h3><p>Use the score as a review queue, not a security guarantee. A new command, permission, instruction, or endpoint should be validated in a sandbox before an agent inherits it.</p><div class="review-checklist"><div class="check">Confirm each new capability is necessary.</div><div class="check">Pin dependencies and verify release provenance.</div><div class="check">Test the candidate with a least-privilege credential.</div></div></section></div><section class="drift-findings"><h3>Review center</h3>' + (introduced.length ? introduced.map(item => finding(item, 'introduced')).join('') : '<div class="drift-finding" data-state="introduced"><p>No introduced findings.</p></div>') + (resolved.length ? resolved.map(item => finding(item, 'resolved')).join('') : '') + (stable.length ? stable.map(item => finding(item, 'stable')).join('') : '') + '</section><section class="drift-next"><h3>Before you ship this artifact</h3><ul><li>Record why each new permission, command, and endpoint is necessary.</li><li>Run the changed path in an isolated workspace first.</li><li>Attach this drift review to the pull request or release decision.</li></ul></section>';
  };
  const compare = () => {
    const output = $('#compare-result');
    output.innerHTML = render($('#before').value, $('#after').value);
    output.querySelectorAll('[data-drift-filter]').forEach(button => button.onclick = () => {
      output.querySelectorAll('[data-drift-filter]').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      const filter = button.dataset.driftFilter;
      output.querySelectorAll('.drift-finding').forEach(item => item.classList.toggle('hidden-by-filter', filter !== 'all' && item.dataset.filter !== filter));
    });
  };
  const button = $('#compare-button');
  if (button) button.onclick = compare;
})();
