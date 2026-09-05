# Catalog source layout

The catalog is the authoritative, reviewable source for public Tool Atlas data. Its hierarchy is deliberately stable:

```text
content/catalog/<category-id>/<vendor-id>/<tool-id>/
  vendor.json
  tool.json
  guide.md
  releases/
    <version>.json
```

`<category-id>` is a path from [`content/taxonomy/categories.json`](../taxonomy/categories.json). The vendor directory is the lowercase kebab-case form of `vendor.json.name`; its identity is shared by all products in that category. The tool directory equals `tool.json.id`. A release filename equals its `version` plus `.json`; versions are ordered by the explicit `order` in `tool.json`, not filesystem order.

Do not put private licence, procurement, contract, credential, activation, or user data here. This directory is a public-catalog source and is compiled into the static client bundle.
