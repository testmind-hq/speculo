export const SERVICE_PALETTE_HEX = ['#a78bfa', '#34d399', '#fbbf24', '#38bdf8', '#fb7185', '#2dd4bf']

export function serviceColorIndex(name: string): number {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return hash % SERVICE_PALETTE_HEX.length
}
