# Maintaining the catalog

Tool Atlas keeps catalog content in one place: [`src/data.ts`](./src/data.ts). The UI, search, filters, saved tools, and documentation library all read from that file, so adding a tool does not require editing components.

## Add a tool

1. Copy an existing entry in `tools` and give it a unique, lowercase `id` such as `pycharm`.
2. Update the visible product fields: name, vendor, category, platforms, lifecycle, version, support owner, trusted HTTPS download URL, description, and tags.
3. Add a Markdown guide under the same id in `docs`.
4. Run `pnpm verify`. The tests check that every catalog item has a guide and that every guide includes `## Install` and `## Support`.

```ts
{
  id: "pycharm",
  name: "PyCharm",
  company: "JetBrains",
  category: "IDE",
  platforms: ["Windows", "Linux", "macOS"],
  lifecycle: "Current",
  icon: "PC",
  version: "2025.2",
  updated: "2026-08-30",
  description: "Python IDE with project tooling and debugger support.",
  support: {
    name: "Maya Cohen",
    team: "Developer Experience",
    initials: "MC",
    email: "devex@atlas.local",
  },
  download: "https://www.jetbrains.com/pycharm/download/",
  tags: ["Python", "IDE", "JetBrains"],
  facts: [
    { label: "License", value: "Named-user subscription" },
    { label: "Asset record", value: "DEV-IDE-042" },
    { label: "Renewal review", value: "2027-01" },
  ],
}

docs.pycharm = `# PyCharm

## Install

Install the approved release from the vendor download page.

## Support

Contact Developer Experience for setup and licensing support.`
```

## Add images

Place product images in `public/tool-images/`, for example `public/tool-images/pycharm.svg`. Reference them with a root-relative path:

```ts
image: {
  src: "/tool-images/pycharm.svg",
  alt: "PyCharm product mark",
},
```

The image replaces the small text tile in catalog rows. To show an image inside a guide, use standard Markdown and the same local path:

```md
![PyCharm welcome screen](/tool-images/pycharm-welcome.png)
```

Use local, appropriately licensed images. Avoid remote image URLs so the static site has no third-party runtime requests or referrer leakage.

## Add more information

Use `facts` for concise fields that belong in the expanded catalog card: internal asset record, license model, renewal review, contract owner, standard configuration, or approved version policy. Each fact is a `{ label, value }` pair, so new types do not need component changes.

Do **not** put license keys, activation codes, passwords, API tokens, personal data, or contract documents in this static repository or site. Link to an approved private system or store a non-sensitive inventory reference instead.

For longer procedures, tables, screenshots, and embedded links, use the tool's Markdown guide in `docs`.
