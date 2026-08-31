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

  process.stdout.write(`Production artifact verified: ${assetPaths.length} local assets and required static-host headers are present.\n`)
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
