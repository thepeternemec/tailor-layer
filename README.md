# Tailor Layer

### Review the layer between an AI agent and your systems.

[![Static app](https://img.shields.io/badge/runtime-static-111111)](#run-locally)
[![No account](https://img.shields.io/badge/account-not_required-111111)](#privacy-and-limitations)
[![MIT licensed](https://img.shields.io/badge/license-MIT-111111)](LICENSE)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-111111)](CONTRIBUTING.md)

Tailor Layer turns one public GitHub repository into an evidence-first security review for agent developers and integrators. It traces the instructions and authority an agent could inherit, links findings to exact source lines, recommends concrete edits, and prepares a least-privilege launch plan.

**One URL in. Evidence, fixes, and safer runtime limits out.**

[Report an issue](https://github.com/thepeternemec/tailor-layer/issues) · [Propose a detection rule](https://github.com/thepeternemec/tailor-layer/issues/new?title=Rule%20proposal%3A%20) · [Read the contribution guide](CONTRIBUTING.md)

> [!IMPORTANT]
> Tailor Layer is a static-review aid, not a security guarantee. It does not execute a repository, prove runtime behavior, or replace sandboxing and human review.

## Why Tailor Layer?

The supply chain for agents is larger than package dependencies. Markdown can redirect tool use. MCP configuration can open new data boundaries. A convenient install command can quietly expand authority.

Tailor Layer focuses on the decision between **“this integration looks useful”** and **“let’s allow it to run.”** It helps answer:

- Which behavior should block installation?
- What file and line produced the finding?
- What should the maintainer edit?
- Which hosts can receive data?
- Which exact revision was reviewed?
- What is the smallest authority required for the first run?

## The review workflow

```text
GitHub repository
       │
       ▼
┌──────────────────┐
│  Scan authority  │  instructions · commands · credentials · network
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Review evidence │  severity · exact source · matched context
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Apply the fix   │  explanation · GitHub edit link · safer pattern
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Tailor launch   │  immutable pin · host allowlist · least authority
└──────────────────┘
```

The scan result is a connected decision record—not a dashboard score. Evidence explains the result, suggested edits resolve it, and the reviewed commit becomes the basis for launch limits and future comparisons.

## What it reviews

| Surface | Examples |
| --- | --- |
| Execution | Pipe-to-shell installation, privileged commands, irreversible operations |
| Instructions | Concealment, coercion, prompt overrides, forced tool ordering |
| Permissions | Broad shell access, wildcard capabilities, authority beyond the task |
| Credentials | Ambient secret stores, hard-coded tokens, unnecessary credential access |
| Network | External endpoints, raw hosts, new outbound data boundaries |
| Data handling | What leaves the workspace, where it goes, and how it may be retained |
| Release integrity | Moving versions, unpinned packages, reviewed-versus-installed drift |
| Runtime controls | Isolation, approval boundaries, cleanup, and observable behavior |

## What a result contains

Every supported finding can include:

- a transparent severity and score impact
- the exact GitHub file and line
- the matched source context
- a plain-language explanation of the risk
- a specific remediation
- a direct GitHub edit link
- a copy-ready safer implementation pattern

After review, Tailor Layer can generate `.tailor-layer/first-run.yaml` with the reviewed revision, isolation profile, approved hosts, scoped authority, verification steps, and cleanup expectations. The policy is portable documentation for your runner, sandbox, or CI system; it does not enforce itself.

## Transparent scoring

The scanner begins at 100 and deducts once per distinct review category:

| Severity | Impact | Expected decision |
| --- | ---: | --- |
| Critical | −42 | Block installation |
| High | −24 | Remediate or explicitly accept |
| Medium | −7 | Review before production |
| Informational | 0 | Verify the boundary |

Critical and high findings also impose score ceilings so a large number cannot conceal an urgent issue. The score prioritizes review; the source evidence remains authoritative.

## Run locally

Tailor Layer is intentionally simple. It needs no account, database, package installation, build step, or environment variables.

```bash
git clone https://github.com/thepeternemec/tailor-layer.git
cd tailor-layer
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173). Repository scans read public GitHub content in the browser and use a public CDN fallback when the GitHub API is rate-limited.

## Repository map

| File | Responsibility |
| --- | --- |
| `index.html` | Application shell, dialogs, sample data, and accessibility structure |
| `unified-shell.css` | Focused workspace layout and responsive visual system |
| `scanner-review.js` | Repository retrieval, rules, scoring, evidence, and suggested edits |
| `first-run-guardrails.js` | Version pinning, host review, authority scoping, and YAML export |
| `drift-review.js` | Introduced, resolved, and stable behavior between artifact versions |
| `score-guide.js` | Technical explanation of the scoring model and its limitations |
| `toolbar.js` | Application navigation and entry animations |
| `footer-motion.js` | Reduced-motion-aware interface transitions |
| `SECURITY.md` | Private vulnerability reporting and project security scope |
| `CODE_OF_CONDUCT.md` | Community expectations for reviews and contributions |

## Contributing

The project is plain HTML, CSS, and browser JavaScript so contributors can understand the complete product without learning a framework first.

High-value contributions include:

- transparent detection rules with useful evidence and remediation
- regression fixtures for false positives and missed findings
- better repository mapping and artifact selection
- enforceable policy adapters for real agent runners and sandboxes
- accessible keyboard flows, responsive layouts, and reduced-motion improvements
- reproducible reports for pull requests and release reviews

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Explain the developer decision your change improves and show how you verified it.

## Privacy and limitations

- Only submit public repository URLs to the browser demo.
- Never paste credentials, private source, or production configuration.
- Static rules cannot observe dependencies fetched later, server responses, compromised releases, or runtime intent.
- A clean scan means “no matched patterns,” not “safe.”

For a security issue in Tailor Layer itself, use a [private GitHub security advisory](https://github.com/thepeternemec/tailor-layer/security/advisories/new).

## License

[MIT](LICENSE) © 2026 Peter Nemec
