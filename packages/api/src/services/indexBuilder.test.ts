import { describe, it, expect } from 'vitest'
import { extractEndpoints } from './indexBuilder.js'

const spec = {
  openapi: '3.1.0',
  paths: {
    '/users': {
      get: { operationId: 'listUsers', summary: 'List all users', tags: ['users'] },
      post: { operationId: 'createUser', summary: 'Create a user', tags: ['users'] },
    },
    '/users/{id}': {
      get: { operationId: 'getUser', summary: 'Get user by ID', tags: ['users'] },
      delete: { summary: 'Delete user' },
    },
  },
}

describe('extractEndpoints', () => {
  it('extracts all HTTP methods from all paths', () => {
    const endpoints = extractEndpoints(spec as any, 'user-service', 'main', 'spec-id')
    expect(endpoints).toHaveLength(4)
  })

  it('includes method, path, operationId, summary, tags', () => {
    const endpoints = extractEndpoints(spec as any, 'user-service', 'main', 'spec-id')
    const get = endpoints.find(e => e.method === 'GET' && e.path === '/users')
    expect(get).toBeDefined()
    expect(get!.operationId).toBe('listUsers')
    expect(get!.summary).toBe('List all users')
    expect(get!.tags).toEqual(['users'])
  })

  it('handles endpoints with no operationId or tags', () => {
    const endpoints = extractEndpoints(spec as any, 'user-service', 'main', 'spec-id')
    const del = endpoints.find(e => e.method === 'DELETE')
    expect(del).toBeDefined()
    expect(del!.operationId).toBeNull()
    expect(del!.tags).toEqual([])
  })

  it('skips non-HTTP-method keys like parameters and servers', () => {
    const specWithExtra = {
      openapi: '3.1.0',
      paths: {
        '/users': {
          get: { summary: 'List' },
          parameters: [{ name: 'limit', in: 'query' }],
          servers: [],
        },
      },
    }
    const endpoints = extractEndpoints(specWithExtra as any, 's', 'main', 'id')
    expect(endpoints).toHaveLength(1)
  })
})
