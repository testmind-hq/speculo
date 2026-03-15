import { describe, it, expect } from 'vitest'
import { users, services, specVersions, endpointIndex, mcpTokens } from './schema.js'

describe('schema', () => {
  it('exports all required tables', () => {
    expect(users).toBeDefined()
    expect(services).toBeDefined()
    expect(specVersions).toBeDefined()
    expect(endpointIndex).toBeDefined()
    expect(mcpTokens).toBeDefined()
  })

  it('users table has required columns', () => {
    expect(Object.keys(users)).toContain('id')
  })

  it('mcpTokens table has scope and prefix columns', () => {
    const cols = Object.keys(mcpTokens)
    expect(cols).toContain('scope')
    expect(cols).toContain('prefix')
  })
})
