# GitLab catalog contribution guide

This guide enables the GitLab issue-to-merge-request path. It keeps catalog publication behind two human decisions: a maintainer applies the approval label, then an authorized user starts the manual CI job. The issue itself never writes to the default branch.

Agent packages use a separate [issue template](../.gitlab/issue_templates/Add%20catalog%20agent.md) and the [air-gapped operator flow](./AIRGAPPED_AGENT_CATALOG.md). The manual `create_catalog_merge_request` job currently writes software-catalog tools only; after `catalog-approved`, a maintainer adds agent files on a branch.

## Prerequisites

1. Merge this repository's GitLab contribution files into the GitLab project's protected default branch: [`.gitlab-ci.yml`](../.gitlab-ci.yml), [issue template](../.gitlab/issue_templates/Add%20catalog%20software.md), and the catalog scripts.
2. Confirm a GitLab Runner can pull the digest-pinned `node:24-alpine` image **from your internal Container Registry mirror** and execute the regular `verify` job. Air-gapped runners must not pull Docker Hub.
3. Protect the default branch. Limit its merge permission and the `catalog-approved` label to maintainers you trust to publish catalog content.
4. Under **Settings > CI/CD > Pipeline variables**, set **Minimum role to use pipeline variables** to **Maintainer**. The job needs two non-secret pipeline variables, but they must not be available to lower-privileged users.

## One-time setup

### Create the project token

In GitLab, open **Settings > Access tokens > Add new token**. Create a named project access token with:

- Role: **Developer**
- Scope: **api**
- Expiration: the shortest period your operational policy allows (for example, 90 days)

Copy the token immediately: GitLab only displays a newly created token once. On GitLab.com, project access tokens require Premium or Ultimate; on self-managed GitLab they are available with any license. If project access tokens are not available, use the local contributor path in [the catalog guide](../CATALOG_CONTENT_GUIDE.md).

### Store the token as a protected secret

Open **Settings > CI/CD > Variables** and create this variable:

| Key | Value | Required protection |
| --- | --- | --- |
| `GITLAB_CATALOG_MR_TOKEN` | The project access token | **Masked**, **hidden**, and **protected** |

Do not put the token in an issue, a `.gitlab-ci.yml` file, or a variable entered when starting a pipeline. Protected variables are available only to pipelines running on protected branches or tags, so protect the default branch before testing this path.

## Submit and publish a catalog entry

1. Create an issue and choose the **Add catalog software** description template. Complete every required field, especially the trusted HTTPS download URL and both `## Install` and `## Support` guide sections.
2. A maintainer reviews the supplier, download URL, support details, image path, and guide. They apply the `catalog-approved` label only after that review.
3. Fetch that exact reviewed issue and calculate its description digest from the repository checkout. The command parses the API response before hashing, so the digest matches the exact description bytes consumed by automation:

   ```bash
   glab api "projects/:id/issues/123" | node scripts/create-catalog-mr-from-gitlab-issue.mjs --description-sha256
   ```

   Replace `123` with the issue IID. Re-review and recalculate the digest whenever the issue description changes.
4. Go to **Build > Pipelines > New pipeline**, choose the protected default branch, and add both non-secret pipeline variables:

   ```text
   CATALOG_ISSUE_IID=123
   CATALOG_APPROVED_DESCRIPTION_SHA256=<64-character digest from the previous step>
   ```

   Start the pipeline. Do not override any predefined `CI_*` variable.
5. Wait for the `verify` job to pass. Select **Run** for `create_catalog_merge_request`; the job is manual and only appears for a web-started default-branch pipeline with both catalog variables set.
6. The job rechecks that the issue is open and carries `catalog-approved`, verifies the description digest, validates the content, keeps API requests on the checked-out repository origin, creates `catalog/issue-123`, and opens a merge request.
7. Review that merge request like any other change. Confirm the proposed entry, generated `src/generated/catalog.ts`, download URL, and guide. Merge only after the normal project review and CI requirements pass.

## Failure handling

| Symptom | Safe response |
| --- | --- |
| The manual job is absent | Start a web pipeline on the protected default branch and provide both catalog variables. |
| The job rejects the issue | Add/correct the `catalog-approved` label only after maintainer review; the issue must remain open. |
| The description digest is rejected | Re-review the current issue, recalculate its SHA-256 digest, and start a new pipeline with that digest. |
| The API origin is rejected | Confirm the checkout's `origin` and the GitLab `CI_API_V4_URL` use the same HTTPS host; do not override predefined `CI_*` variables. |
| Validation fails | Correct the issue template fields, then start a new pipeline. No branch or merge request is created before validation. |
| A branch already exists | Review its merge request or delete the stale branch through the normal GitLab UI before retrying. Do not rerun blindly. |
| API authentication fails | Check the variable name, protected-variable access, token expiry, Developer role, and `api` scope. |

## Ongoing security operations

- Rotate the token before it expires, replace the CI/CD variable, then revoke the old token after a successful test run.
- Revoke the token immediately if a secret is exposed or a maintainer leaves the project.
- Review the token's last-use and IP information in **Settings > Access tokens** during periodic access reviews.
- Treat `catalog-approved` as a publishing permission; do not grant label-management permission to untrusted contributors.
- Keep the minimum role for pipeline variables at Maintainer so lower-privileged users cannot override predefined `CI_*` values in this credential-bearing job.

GitLab references: [project access tokens](https://docs.gitlab.com/user/project/settings/project_access_tokens/), [CI/CD variables](https://docs.gitlab.com/ci/variables/), [manual jobs](https://docs.gitlab.com/ci/jobs/job_control/), and [description templates](https://docs.gitlab.com/user/project/description_templates/).
