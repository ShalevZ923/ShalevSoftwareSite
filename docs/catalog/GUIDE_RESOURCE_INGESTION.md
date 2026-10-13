# Guide resource ingestion

Developer Studio now owns the authoring experience for catalog guide resources. Administrators do not edit catalog front matter directly.

## Administrator workflow

1. Run `pnpm dev`, open the protected local Developer Studio link printed in the terminal, and select a software entry.
2. In **Guides & files**, choose **Add guide**.
3. Select either **Approved HTTPS link** for a SharePoint/intranet document or **Server guide library** for a PDF/PPTX already stored below `guide-library/<tool-id>/`.
4. Enter the title, type, format, applicable versions, owner, and review date, then save the tool. The server validates catalog metadata, confirms every server-file selection exists below its approved tool directory, and performs a bounded `HEAD` check for each HTTPS resource.
5. Review the Git diff and run `pnpm verify` before using the normal pull-request workflow.

## Delivery behavior

Tool Atlas renders a compact **Guides & files** panel on the user-facing documentation page. HTTPS resources open in a new tab; server-library items are delivered only through `/guides/<tool-id>/<filename>` and are not exposed as filesystem paths.

## Boundaries and next step

The implementation intentionally does not upload files or crawl arbitrary network locations. The Studio can only list PDF/PPTX files in the selected tool's approved guide-library directory. HTTPS checks are restricted to the exact hosts in `TOOL_ATLAS_GUIDE_HOSTS`; set that server-side configuration before attaching SharePoint or intranet links. A `401` or `403` result is accepted as reachable because those services commonly require the reader's own SSO session. This avoids exposing server folders through the browser or turning the link checker into a general network client.

The next production integration is a SharePoint adapter that uses a narrowly scoped service identity to browse approved document libraries, preserve the selected item ID, and record validation/audit status. User access remains governed by the user's SharePoint SSO; a service-side link check alone is not proof that every user can open a protected document.
