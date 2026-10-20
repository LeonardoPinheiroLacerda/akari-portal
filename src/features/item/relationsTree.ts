import type { AnimeRelationGraphResponse, AnimeRelationNode } from '@/api/generated/model'

/*
 * Aresta `from → to` com tipo X significa "`to` é X de `from`"
 * (ex.: 98478 → 21366 PREQUEL: 21366 é a temporada anterior de 98478).
 */

const ANCESTOR = new Set(['PREQUEL', 'PARENT'])

export type TreeItem = {
  node: AnimeRelationNode
  relation: string | null
  num?: number
  /** Recuo: 0 = entrada do grupo, 1+ = derivada (aninhada sob a entrada de cima). */
  level?: number
}

export type TreeGroup = { key: 'source' | 'before' | 'main' | 'other'; label: string; items: TreeItem[] }

/** Recuo máximo exibido; derivadas mais fundas ficam nesse nível. */
const MAX_LEVEL = 3

function index(graph: AnimeRelationGraphResponse) {
  const nodes = new Map<number, AnimeRelationNode>((graph.nodes ?? []).map((n) => [n.anilistId, n]))
  const out = new Map<number, { to: number; type: string }[]>()
  for (const e of graph.edges ?? []) {
    if (!e.relationType) continue
    const list = out.get(e.from) ?? []
    list.push({ to: e.to, type: e.relationType })
    out.set(e.from, list)
  }
  return { nodes, out }
}

/** Sobe pelas relações PREQUEL/PARENT até achar quem a API marca como início da franquia. */
export function findFranchiseRoot(graph: AnimeRelationGraphResponse, from: number): number {
  const { nodes, out } = index(graph)
  const start = nodes.get(from)
  if (start && start.rootKind !== 'NOT_ROOT') return from
  const seen = new Set([from])
  let frontier = [from]
  let topmost = from
  while (frontier.length) {
    const next: number[] = []
    for (const id of frontier) {
      for (const e of out.get(id) ?? []) {
        if (!ANCESTOR.has(e.type) || seen.has(e.to)) continue
        seen.add(e.to)
        const n = nodes.get(e.to)
        if (n && n.rootKind !== 'NOT_ROOT') return e.to
        topmost = e.to
        next.push(e.to)
      }
    }
    frontier = next
  }
  return topmost
}

/**
 * Monta a árvore indentada a partir da raiz da franquia.
 * Origem (SOURCE) · Antes na cronologia (PREQUEL a partir da raiz) · Linha principal (cadeia de SEQUEL,
 * com as obras derivadas recuadas sob cada entrada) · Outras relações (o que sobrar do grafo).
 *
 * Derivadas trazem as próprias cadeias de PREQUEL/SEQUEL no mesmo recuo (ex.: um spin-off e a
 * continuação dele) e as próprias derivadas um nível abaixo; uma SEQUEL que não segue a linha
 * principal (ramificação) entra como derivada. Nenhuma obra do grafo fica de fora.
 */
export function buildFranchiseTree(graph: AnimeRelationGraphResponse, rootId: number): TreeGroup[] {
  const { nodes, out } = index(graph)
  const root = nodes.get(rootId)
  if (!root) return []
  const placed = new Set<number>()
  const edgesOf = (id: number) => out.get(id) ?? []
  const item = (id: number, relation: string | null, level = 0, num?: number): TreeItem => ({
    node: nodes.get(id)!,
    relation,
    level: Math.min(level, MAX_LEVEL),
    num,
  })

  const chain = (startId: number, type: string) => {
    const list: number[] = []
    let cur = startId
    for (;;) {
      const e = edgesOf(cur).find((x) => x.type === type && !placed.has(x.to) && nodes.has(x.to))
      if (!e) break
      placed.add(e.to)
      list.push(e.to)
      cur = e.to
    }
    return list
  }

  placed.add(rootId)
  const before = chain(rootId, 'PREQUEL').reverse()
  const main = [rootId, ...chain(rootId, 'SEQUEL')]
  const source = edgesOf(rootId)
    .filter((e) => (e.type === 'SOURCE' || e.type === 'ADAPTATION') && nodes.has(e.to) && !placed.has(e.to))
    .map((e) => {
      placed.add(e.to)
      return e.to
    })

  // Uma derivada no recuo `level`, com as cadeias de PREQUEL/SEQUEL dela no mesmo recuo.
  const branch = (id: number, relation: string, level: number): TreeItem[] => {
    const pre = chain(id, 'PREQUEL').reverse()
    const seq = chain(id, 'SEQUEL')
    return [
      ...pre.flatMap((p) => [item(p, 'PREQUEL', level), ...derived(p, level + 1)]),
      item(id, relation, level),
      ...derived(id, level + 1),
      ...seq.flatMap((q) => [item(q, 'SEQUEL', level), ...derived(q, level + 1)]),
    ]
  }

  // Derivadas de uma entrada: relações que não apontam para trás (PREQUEL/PARENT), ou obras cujo PARENT é a entrada.
  const derived = (id: number, level: number): TreeItem[] => {
    const items: TreeItem[] = []
    for (const e of edgesOf(id)) {
      if (ANCESTOR.has(e.type) || placed.has(e.to) || !nodes.has(e.to)) continue
      placed.add(e.to)
      items.push(...branch(e.to, e.type, level))
    }
    for (const [from, list] of out) {
      if (placed.has(from) || !nodes.has(from)) continue
      if (list.some((e) => e.to === id && e.type === 'PARENT')) {
        placed.add(from)
        items.push(...branch(from, 'SIDE_STORY', level))
      }
    }
    return items
  }

  const groups: TreeGroup[] = []
  if (source.length) {
    groups.push({ key: 'source', label: 'Origem', items: source.flatMap((id) => [item(id, 'SOURCE'), ...derived(id, 1)]) })
  }
  if (before.length) {
    groups.push({
      key: 'before',
      label: 'Antes na cronologia',
      items: before.flatMap((id) => [item(id, 'PREQUEL'), ...derived(id, 1)]),
    })
  }
  groups.push({
    key: 'main',
    label: 'Linha principal',
    items: main.flatMap((id, i) => [item(id, i === 0 ? null : 'SEQUEL', 0, i + 1), ...derived(id, 1)]),
  })
  const rest = [...nodes.keys()].filter((id) => !placed.has(id))
  if (rest.length) groups.push({ key: 'other', label: 'Outras relações', items: rest.map((id) => item(id, null)) })
  return groups
}
