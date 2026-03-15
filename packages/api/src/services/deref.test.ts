import { describe, it, expect } from 'vitest'
import { derefSpec, safeSerialize } from './deref.js'

const specWithRef = {
  openapi: '3.1.0',
  info: { title: 'Test', version: '1' },
  paths: {
    '/users': {
      get: {
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' } },
      },
    },
  },
}

describe('derefSpec', () => {
  it('resolves $ref references', async () => {
    const result = await derefSpec(specWithRef)
    const schema = (result as any).paths['/users'].get.responses['200']
      .content['application/json'].schema
    expect(schema.type).toBe('object')
    expect(schema.properties.id).toBeDefined()
  })
})

describe('safeSerialize', () => {
  it('handles circular references', () => {
    const obj: any = { a: 1 }
    obj.self = obj // circular
    const result = safeSerialize(obj)
    expect((result as any).self).toMatchObject({ description: '[Circular]' })
  })

  it('passes through non-circular objects unchanged', () => {
    const obj = { a: 1, b: { c: 2 } }
    expect(safeSerialize(obj)).toEqual(obj)
  })
})
