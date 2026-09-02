# Contributing to Tailor Layer

Thanks for helping agent developers make better decisions before granting code, instructions, and tools access to real systems.

Tailor Layer favors focused contributions that make evidence more accurate, remediation more useful, or first-run limits easier to apply.

## Start here

- Search existing [issues](https://github.com/thepeternemec/tailor-layer/issues) before beginning a larger change.
- Keep each pull request focused on one developer-facing outcome.
- Prefer a narrow, explainable rule over a broad heuristic that produces noise.
- Never add real credentials, private repositories, or production data to examples or screenshots.

## Local development

There is no package installation or build step.

```bash
git clone https://github.com/thepeternemec/tailor-layer.git
cd tailor-layer
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173) and exercise the complete workflow you changed.

## Where to contribute

| Area | Start with |
| --- | --- |
| Repository scans, scores, evidence, and edits | `scanner-review.js` |
| Version comparisons | `drift-review.js` |
| Pins, host approvals, authority, and YAML | `first-run-guardrails.js` |
| Scoring documentation | `score-guide.js` |
| Structure, accessibility, and dialogs | `index.html` |
| Layout and responsive behavior | `unified-shell.css` |
| Navigation and motion | `toolbar.js`, `footer-motion.js` |

## Adding a detection rule

A useful rule answers four questions:

1. **What was observed?** Use a precise title a developer can understand quickly.
2. **Why does it matter?** Name the affected authority, data boundary, or execution path.
3. **Where is the evidence?** Preserve the exact source file, line, and relevant excerpt.
4. **What should change?** Offer a specific, proportionate remediation.

Document likely false positives and include a safe test repository or fixture when practical.

## Pull-request checklist

- [ ] I tested the affected workflow in a browser.
- [ ] I checked modified JavaScript with `node --check`.
- [ ] Findings remain source-linked and usable on a narrow screen.
- [ ] Interactive elements work with a keyboard.
- [ ] Motion respects `prefers-reduced-motion`.
- [ ] I explained the developer decision this change improves.
- [ ] I did not include secrets or private data.

## Reporting security issues

Use public issues for reproducible bugs, rule ideas, and product feedback. Report vulnerabilities in Tailor Layer through a [private GitHub security advisory](https://github.com/thepeternemec/tailor-layer/security/advisories/new).
