# Documentation and catalog links

Use **View in catalog** near the top of a tool's documentation to open its expanded catalog entry. The entry receives keyboard focus, scrolls into view, and has a blue highlight. The link also supports opening in a new tab through normal browser actions.

## Shareable URLs

Append these to the site's normal URL:

```text
?page=documentation&tool=jmeter
?page=catalog&tool=jmeter
?page=catalog&tool=jmeter&version=5.6.3
?page=documentation&tool=intellij&version=2026.01-Mac
```

The `tool` value is the catalog ID, not the display name. `version` must exactly match an approved release. Versions affect the catalog release and its download, not which revision of the Markdown guide is displayed.

## Behavior and recovery

- Without `version`, select the first approved release. For an unavailable version, select that default and show an explanation beside the tool's download controls. A missing tool produces a catalog notice without opening another record.
- Clear filters only if they would hide the linked tool. Retain compatible filters. Normal filtering remains available after arrival.
- Selecting a release updates both the real download destination and the URL. **View documentation** carries that release into the guide URL, so **View in catalog** returns to the same release.
- **Copy view link** includes the expanded tool and selected release. Reload, Back, and Forward restore the view. Clicking the main Catalog navigation returns to a normal catalog view.
- If the local server supplies a newly created tool or release after the static bundle loads, resolve the link again against that catalog.
- Links never supply arbitrary download destinations. The selected catalog release still passes through the existing trusted download resolver.

## Local validation — 2026-09-05

- `pnpm verify`: 46 tests passed, including five new link tests; catalog consistency, TypeScript, production build, and static artifact/header checks passed.
- Browser checks used headless Playwright Chromium because the available browser inventory was empty. Covered JMeter documentation-to-catalog, expansion/focus/scroll/highlight, reload/history, a second approved IntelliJ release and its actual download URL, documentation round trips, clipboard links, unavailable releases, conflicting/compatible filters, missing tools, repeated base-route navigation, delayed live catalog data, and a 390px mobile viewport.
- Desktop documentation/catalog and mobile screenshots were inspected. The mobile filter grid was adjusted to prevent horizontal overflow in the expanded destination. No catalog files were changed by the browser checks.
- The catalog-content test now permits additional approved releases instead of assuming IntelliJ has only one release.

Local screenshots: [documentation](../output/tool-links/documentation.png), [catalog](../output/tool-links/catalog.png), and [mobile](../output/tool-links/mobile.png). These are ignored QA output, not published assets.
