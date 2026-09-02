# Security policy

Tailor Layer exists to make agent-facing software easier to review. Please help us apply the same standard to the project itself.

## Report a vulnerability

Do not open a public issue for an exploitable vulnerability or include secrets, tokens, or private repository content in a report.

Use [GitHub private vulnerability reporting](https://github.com/thepeternemec/tailor-layer/security/advisories/new) and include:

- the affected file or deployed route;
- a minimal reproduction;
- the security impact;
- any suggested mitigation.

You should receive an acknowledgement within five working days. We will confirm scope, coordinate a fix, and credit the reporter unless anonymity is requested.

## Scope

Security reports may cover the browser scanner, repository fetching, evidence links, generated remediation, first-run plans, or deployment configuration. False positives and new detection ideas belong in the public [issue tracker](https://github.com/thepeternemec/tailor-layer/issues).

## Important limitation

Tailor Layer performs deterministic static review of readable public repository files. A clean result is not proof that an agent, dependency, release artifact, or remote service is safe at runtime.
