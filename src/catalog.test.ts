import { describe, expect, it } from 'vitest'
import { catalogFiltersFromSearch, catalogFiltersToSearch, defaultFilters, getCatalogTools, getDocumentationTools, slugifyHeading } from './catalog'
import { docs, tools } from './data'

describe('catalog filters', () => {
  it('matches names, vendors, tags, and platforms without case sensitivity', () => {
    expect(getCatalogTools(tools, { ...defaultFilters, query: 'jetbrains' }).map((tool) => tool.id)).toEqual(['intellij'])
    expect(getCatalogTools(tools, { ...defaultFilters, query: 'remote development' }).map((tool) => tool.id)).toEqual(['vscode'])
    expect(getCatalogTools(tools, { ...defaultFilters, platform: 'Web' }).map((tool) => tool.id)).toEqual(['postman'])
  })

  it('keeps catalog content complete and safe to publish as static data', () => {
    expect(new Set(tools.map((tool) => tool.id)).size).toBe(tools.length)

    for (const tool of tools) {
      expect(tool.id).toMatch(/^[a-z0-9-]+$/)
      expect(tool.name).not.toHaveLength(0)
      expect(tool.support.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      expect(tool.releases).not.toHaveLength(0)
      expect(new Set(tool.releases.map((release) => release.version)).size).toBe(tool.releases.length)
      for (const release of tool.releases) {
        expect(release.version).not.toHaveLength(0)
        if (release.download !== undefined) {
          expect(new URL(release.download).protocol).toBe('https:')
        } else {
          expect(release.artifact).toMatch(new RegExp(`^${tool.id}/${release.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[A-Za-z0-9][A-Za-z0-9._-]*$`))
        }
      }
      expect(tool.facts?.some((fact) => /key|activation|password|token/i.test(fact.label))).not.toBe(true)
      for (const resource of tool.resources || []) {
        expect(resource.id).toMatch(/^[a-z0-9-]+$/)
        expect(resource.appliesTo.length).toBeGreaterThan(0)
        expect(resource.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect((resource.url !== undefined) !== (resource.file !== undefined)).toBe(true)
      }
    }
  })

  it('combines filters and preserves a predictable sort order', () => {
    expect(getCatalogTools(tools, { ...defaultFilters, category: 'IDEs & Code Editors', platform: 'Linux' }).map((tool) => tool.name)).toEqual(['IntelliJ IDEA', 'Visual Studio Code'])
    expect(getCatalogTools(tools, { ...defaultFilters, lifecycle: 'New' }).map((tool) => tool.id)).toEqual(['dbeaver', 'jq'])
    expect(getCatalogTools(tools, { ...defaultFilters, sort: 'updated' }).map((tool) => tool.id).slice(0, 3)).toEqual(['intellij', 'vscode', 'docker'])
  })

  it('creates compact, validated shareable filter URLs', () => {
    const search = catalogFiltersToSearch({ ...defaultFilters, query: ' docker ', category: 'Container', platform: 'Linux', sort: 'updated' })
    expect(search).toBe('query=docker&category=Container&platform=Linux&sort=updated')
    expect(catalogFiltersFromSearch(`?${search}`, ['All categories', 'Container', 'IDE'])).toEqual({ ...defaultFilters, query: 'docker', category: 'Container', platform: 'Linux', sort: 'updated' })
    expect(catalogFiltersFromSearch('?category=Unknown&platform=Solaris&lifecycle=Future&sort=random', ['All categories', 'IDE'])).toEqual(defaultFilters)
  })

  it('searches the documentation library by tool metadata and sorts it by name', () => {
    expect(getDocumentationTools(tools, 'quality').map((tool) => tool.id)).toEqual(['jmeter', 'postman'])
    expect(getDocumentationTools(tools, '  ').map((tool) => tool.name).slice(0, 3)).toEqual(['Apache JMeter', 'DBeaver Community', 'Docker Desktop'])
  })
})

describe('documentation headings', () => {
  it('creates stable heading anchors', () => {
    expect(slugifyHeading('Setup and install')).toBe('setup-and-install')
    expect(slugifyHeading('  Standard add-ons  ')).toBe('standard-add-ons')
  })

  it('gives every guide the documented navigation anchors', () => {
    expect(Object.keys(docs).sort()).toEqual(tools.map((tool) => tool.id).sort())
    for (const guide of Object.values(docs)) {
      expect(guide).toContain('## Install')
      expect(guide).toContain('## Support')
    }
  })
})
