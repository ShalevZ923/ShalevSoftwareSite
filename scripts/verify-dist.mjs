import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve('dist')
const requiredHeaders = [
  "Content-Security-Policy: default-src 'self'",
  "img-src 'self' data:",
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Permissions-Policy:',
  'Cross-Origin-Opener-Policy: same-origin',
  'Cross-Origin-Resource-Policy: same-origin',
  'X-Frame-Options: DENY',
]

async function requireFile(path) {
  await access(path, constants.R_OK)
}

async function main() {
  const indexPath = resolve(dist, 'index.html')
  const headersPath = resolve(dist, '_headers')
  await Promise.all([requireFile(indexPath), requireFile(headersPath)])

  const [index, headers] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(headersPath, 'utf8'),
  ])

  if (!index.includes('<div id="root"></div>')) throw new Error('Production index is missing the application root.')
  if (/\b(?:src|href)=["']https?:\/\//i.test(index)) throw new Error('Production index unexpectedly references a remote runtime asset.')

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) throw new Error(`Production headers are missing: ${header}`)
  }

  const assetPaths = [...index.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)(?:\?[^\"]*)?"/g)].map((match) => match[1])
  if (assetPaths.length < 2) throw new Error('Production index does not reference both CSS and JavaScript assets.')
  await Promise.all(assetPaths.map((asset) => requireFile(resolve(dist, `.${asset}`))))

  const catalogIndexPath = resolve(dist, 'catalog/v1/index.json')
  const catalogToolsPath = resolve(dist, 'catalog/v1/tools.json')
  await Promise.all([requireFile(catalogIndexPath), requireFile(catalogToolsPath)])
  const catalogIndex = JSON.parse(await readFile(catalogIndexPath, 'utf8'))
  const catalogTools = JSON.parse(await readFile(catalogToolsPath, 'utf8'))
  if (catalogIndex.schemaVersion !== 1 || catalogTools.schemaVersion !== 1) {
    throw new Error('Production catalog feed is missing schemaVersion 1.')
  }
  if (!Array.isArray(catalogIndex.tools) || catalogIndex.tools.length === 0) {
    throw new Error('Production catalog index does not contain tools.')
  }
  if (catalogIndex.tools.some((tool) => !tool.id || !tool.defaultVersion || !tool.summary)) {
    throw new Error('Production catalog index is missing required tool fields.')
  }
  if (!Array.isArray(catalogTools.tools) || catalogTools.tools.length !== catalogIndex.tools.length) {
    throw new Error('Production catalog tools feed does not match the index.')
  }
  if (JSON.stringify(catalogIndex).includes('@atlas.local') || JSON.stringify(catalogTools).includes('## Install')) {
    throw new Error('Production catalog feed unexpectedly includes guides or support contacts.')
  }

  process.stdout.write(`Production artifact verified: ${assetPaths.length} local assets and required static-host headers are present.\n`)
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
