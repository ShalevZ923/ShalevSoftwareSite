# GitLab catalog contribution guide

This guide enables the GitLab issue-to-merge-request path. It keeps catalog publication behind two human decisions: a maintainer applies the approval label, then an authorized user starts the manual CI job. The issue itself never writes to the default branch.

## Prerequisites

1. Merge this repository's GitLab contribution files into the GitLab project's protected default branch: [`.gitlab-ci.yml`](../.gitlab-ci.yml), [issue template](../.gitlab/issue_templates/Add%20catalog%20software.md), and the catalog scripts.
2. Confirm a GitLab Runner can pull the digest-pinned `node:24-alpine` image and execute the regular `verify` job.
3. Protect the default branch. Limit its merge permission and the `catalog-approved` label to maintainers you trust to publish catalog content.

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
3. Go to **Build > Pipelines > New pipeline**, choose the protected default branch, and add a non-secret pipeline variable:

   ```text
   CATALOG_ISSUE_IID=123
   ```

   Replace `123` with the issue IID shown in the GitLab project. Start the pipeline.
4. Wait for the `verify` job to pass. Select **Run** for `create_catalog_merge_request`; the job is manual and only appears for a web-started default-branch pipeline with `CATALOG_ISSUE_IID` set.
5. The job rechecks that the issue is open and carries `catalog-approved`, validates the content, creates `catalog/issue-123`, and opens a merge request.
6. Review that merge request like any other change. Confirm the proposed entry, generated `src/generated/catalog.ts`, download URL, and guide. Merge only after the normal project review and CI requirements pass.

## Failure handling

| Symptom | Safe response |
| --- | --- |
| The manual job is absent | Start a web pipeline on the default branch and provide `CATALOG_ISSUE_IID`. Ensure the branch is protected. |
| The job rejects the issue | Add/correct the `catalog-approved` label only after maintainer review; the issue must remain open. |
| Validation fails | Correct the issue template fields, then start a new pipeline. No branch or merge request is created before validation. |
| A branch already exists | Review its merge request or delete the stale branch through the normal GitLab UI before retrying. Do not rerun blindly. |
| API authentication fails | Check the variable name, protected-variable access, token expiry, Developer role, and `api` scope. |

## Ongoing security operations

- Rotate the token before it expires, replace the CI/CD variable, then revoke the old token after a successful test run.
- Revoke the token immediately if a secret is exposed or a maintainer leaves the project.
- Review the token's last-use and IP information in **Settings > Access tokens** during periodic access reviews.
- Treat `catalog-approved` as a publishing permission; do not grant label-management permission to untrusted contributors.

GitLab references: [project access tokens](https://docs.gitlab.com/user/project/settings/project_access_tokens/), [CI/CD variables](https://docs.gitlab.com/ci/variables/), [manual jobs](https://docs.gitlab.com/ci/jobs/job_control/), and [description templates](https://docs.gitlab.com/user/project/description_templates/).
