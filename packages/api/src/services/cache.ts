import { LRUCache } from 'lru-cache'

// Key: "serviceName:branch" → dereferenced OpenAPI spec object
export const specCache = new LRUCache<string, Record<string, unknown>>({
  max: 50,
})
