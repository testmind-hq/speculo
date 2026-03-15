import { parse as parseYaml } from 'yaml'
import { upgrade } from '@scalar/openapi-upgrader'
import { default as spectralCoreModule } from '@stoplight/spectral-core'
import { oas } from '@stoplight/spectral-rulesets'

const { Spectral } = spectralCoreModule as { Spectral: new () => {
  setRuleset: (ruleset: unknown) => Promise<void>
  run: (spec: unknown) => Promise<Array<{ severity: number; path: (string | number)[]; message: string }>>
} }

export interface NormalizeResult {
  spec: Record<string, unknown> & { info: { title: string } }
  originalVersion: string
  upgradedVersion: string
  wasConverted: boolean
  warnings: string[]
}

const spectral = new Spectral()
// Fire-and-forget ruleset init; run() will await internally
void spectral.setRuleset(oas as unknown as Parameters<typeof spectral.setRuleset>[0])

export async function normalizeSpec(content: string, filename: string): Promise<NormalizeResult> {
  // Parse based on file extension
  let parsed: unknown
  if (filename.endsWith('.json')) {
    parsed = JSON.parse(content)
  } else {
    parsed = parseYaml(content)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid OpenAPI/Swagger content')
  }

  const doc = parsed as Record<string, unknown>

  const originalVersion = (doc.swagger ?? doc.openapi) as string | undefined
  if (!originalVersion) {
    throw new Error('Missing swagger or openapi version field')
  }

  const wasConverted = !!doc.swagger

  // Upgrade to OpenAPI 3.x (currently 3.2 as of @scalar/openapi-upgrader ^0.2.0)
  const upgraded = upgrade(doc) as Record<string, unknown> & { info: { title: string } }
  const upgradedVersion = (upgraded.openapi ?? originalVersion) as string

  // Lint — warn only, never block upload
  const warnings: string[] = []
  try {
    // Ensure ruleset is set before running
    await spectral.setRuleset(oas as unknown as Parameters<typeof spectral.setRuleset>[0])
    const results = await spectral.run(upgraded)
    for (const r of results) {
      if (r.severity === 0 || r.severity === 1) { // error or warn
        warnings.push(`[${r.path.join('.')}] ${r.message}`)
      }
    }
  } catch {
    // Lint errors are non-fatal
  }

  return {
    spec: upgraded,
    originalVersion,
    upgradedVersion,
    wasConverted,
    warnings,
  }
}
