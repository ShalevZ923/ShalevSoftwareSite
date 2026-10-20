# PDF Skill

Anthropic's PDF skill is the reviewed package for document extraction, assembly, form filling, and OCR. Tool Atlas serves a hashed ZIP from `/downloads`; it does not run the bundled scripts.

## Install

Download the ZIP from this catalog. Extract it so `SKILL.md` is in `.agents/skills/pdf` for the current project, or `~/.agents/skills/pdf` for every project. Confirm the SHA-256 shown in the listing before you unpack. Do not use npm or npx.

Restart the agent host after unpacking so it discovers the skill.

## When to use it

- Extract text or tables from an existing PDF
- Merge, split, rotate, or watermark pages
- Fill PDF forms or run OCR on a scanned document

## Support

Developer Experience reviews the listing and the published ZIP. Questions about the skill itself belong with the internal package owner.
