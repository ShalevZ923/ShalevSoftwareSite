# Contributing to Tool Atlas

## Before opening a pull request

- Use a branch and keep changes focused.
- Never commit `.env` files, credentials, licence/activation data, private
  contacts, contract information, or installer binaries.
- Treat `content/catalog/` as public data. Follow
  [CATALOG_CONTENT_GUIDE.md](./CATALOG_CONTENT_GUIDE.md) for the canonical
  hierarchy and validation rules.
- Run `pnpm verify` and `pnpm audit --prod` before requesting review.

## Catalog contributions

Use the GitHub issue form for ordinary submissions. A trusted maintainer must
review it and apply `catalog-approved`; automation creates a pull request, but
does not merge or deploy it. Do not ask for that label on unreviewed content.

## License and third-party material

Contributions to first-party software and documentation are submitted under
Apache-2.0. Do not add vendor logos, installers, copied documentation, or other
third-party material unless its owner has granted an appropriate right to use
and redistribute it.
