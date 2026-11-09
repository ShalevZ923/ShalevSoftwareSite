# Local security scanning

The LAN security workflow submits immutable commit IDs to a private queue and
waits for isolated local workers. It does not execute PR code or check out PR
source on a GitHub-hosted privileged workflow.

The `LAN_SECURITY_QUEUE_KEY` secret is a deploy key restricted to the private
`ShalevZ923/lan-security-worker` queue repository. It is not a personal account
token. The LAN runners are registered only to that private queue, never to
this public repository.

Gitleaks scans PR commit history for new secrets. Semgrep and Trivy compare
head and base snapshots for new code, dependency, and configuration findings.
New secret candidates fail the check; other findings are advisory initially.
Incomplete scans return an error. Detailed, redacted findings remain in the
private queue repository; public checks expose counts only.

Full scans run on main pushes, nightly, and on manual dispatch. Passing a scan
is not proof that the source is free of vulnerabilities. No branch protection
settings are changed by adding this workflow.

To pause scanning, disable the workflow in GitHub Actions. To revoke queue
access, remove the Actions secret and the corresponding queue deploy key.
