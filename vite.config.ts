import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

const packageRoot = resolve('packages')
const agentZipPath = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)\/(?:[A-Za-z0-9][A-Za-z0-9._-]*)\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\.zip)$/

export default defineConfig({
  plugins: [react(), {
    name: 'local-agent-downloads',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const raw = request.url?.split('?')[0] ?? ''
        let decoded = raw
        try { decoded = decodeURIComponent(raw) } catch { response.writeHead(400).end(); return }
        if (decoded.startsWith('/downloads/') && decoded.includes('..')) {
          response.writeHead(404).end()
          return
        }
        next()
      })
      server.middlewares.use('/downloads', async (request, response) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        if (pathname.includes('..')) {
          response.writeHead(404).end()
          return
        }
        if (!agentZipPath.test(pathname)) {
          response.writeHead(404).end()
          return
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          response.writeHead(405).end()
          return
        }
        try {
          const [root, file] = await Promise.all([
            realpath(packageRoot),
            realpath(join(packageRoot, pathname.slice(1))),
          ])
          const inside = relative(root, file)
          if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
            response.writeHead(403).end()
            return
          }
          const info = await stat(file)
          if (!info.isFile()) throw new Error('Not a file')
          response.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${file.split(sep).at(-1)}"`,
            'Content-Length': info.size,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
          })
          if (request.method === 'HEAD') response.end()
          else createReadStream(file).pipe(response)
        } catch {
          response.writeHead(404).end()
        }
      })
    },
  }],
})
