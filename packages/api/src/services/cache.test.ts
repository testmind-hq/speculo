import { describe, it, expect } from 'vitest'
import { specCache } from './cache.js'

describe('specCache', () => {
  it('stores and retrieves a value', () => {
    specCache.set('svc:main', { openapi: '3.1.0' } as any)
    expect(specCache.get('svc:main')).toMatchObject({ openapi: '3.1.0' })
  })

  it('returns undefined for unknown keys', () => {
    expect(specCache.get('nonexistent:branch')).toBeUndefined()
  })

  it('deletes a key', () => {
    specCache.set('svc2:main', { openapi: '3.1.0' } as any)
    specCache.delete('svc2:main')
    expect(specCache.get('svc2:main')).toBeUndefined()
  })
})
