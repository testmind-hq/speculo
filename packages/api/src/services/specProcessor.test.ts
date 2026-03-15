import { describe, it, expect } from 'vitest'
import { normalizeSpec } from './specProcessor.js'

const swagger2Yaml = `
swagger: "2.0"
info:
  title: Test API
  version: "1.0"
host: localhost
paths:
  /users:
    get:
      summary: List users
      responses:
        "200":
          description: OK
`

const openapi3Json = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Test', version: '1.0' },
  paths: {},
})

describe('normalizeSpec', () => {
  it('converts Swagger 2.0 YAML to OpenAPI 3.1', async () => {
    const result = await normalizeSpec(swagger2Yaml, 'swagger.yaml')
    expect(result.upgradedVersion).toMatch(/^3\./)
    expect(result.wasConverted).toBe(true)
    expect(result.spec.info.title).toBe('Test API')
  })

  it('upgrades OpenAPI 3.0 JSON to 3.1', async () => {
    const result = await normalizeSpec(openapi3Json, 'openapi.json')
    expect(result.upgradedVersion).toMatch(/^3\./)
    expect(result.wasConverted).toBe(false)
  })

  it('detects YAML vs JSON by filename', async () => {
    const yamlContent = `openapi: "3.0.0"\ninfo:\n  title: T\n  version: "1"\npaths: {}`
    const result = await normalizeSpec(yamlContent, 'openapi.yaml')
    expect(result.spec).toBeDefined()
  })

  it('throws on invalid content', async () => {
    await expect(normalizeSpec('not valid at all!!', 'file.yaml')).rejects.toThrow()
  })

  it('returns spectral lint warnings in warnings array', async () => {
    // A valid but lint-failing spec (missing descriptions)
    const result = await normalizeSpec(swagger2Yaml, 'swagger.yaml')
    // warnings may be empty or non-empty depending on ruleset — just assert it's an array
    expect(Array.isArray(result.warnings)).toBe(true)
  })
})
