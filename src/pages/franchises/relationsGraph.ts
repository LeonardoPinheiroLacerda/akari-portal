import type { AnimeRelationGraphResponse } from '@/api/generated/model'

/*
 * Aresta `from → to` com tipo X significa "`to` é X de `from`". A AniList grava cada relação
 * dos dois lados (A → B SEQUEL e B → A PREQUEL), então o desenho junta cada par numa seta só,
 * sempre no sentido natural da relação (a obra anterior → a continuação, a principal → a
 * derivada). Nada no desenho depende de qual obra é o início da franquia.
 */

/** Categorias de seta, na ordem de prioridade quando um par tem mais de uma relação. */
export const GRAPH_RELATIONS = [
  // `inverse`: o rótulo quando a seta sai da derivada para a principal (ex.: a obra anterior).
  { key: 'SEQUEL', label: 'Continuação', inverse: 'Anterior' },
  { key: 'SIDE_STORY', label: 'História paralela', inverse: 'Obra principal' },
  { key: 'SPIN_OFF', label: 'Spin-off', inverse: 'Obra de origem' },
  { key: 'SUMMARY', label: 'Resumo', inverse: 'Obra resumida' },
  { key: 'ALTERNATIVE', label: 'Versão alternativa', inverse: 'Versão alternativa' },
  { key: 'OTHER', label: 'Outra relação', inverse: 'Outra relação' },
] as const
export type GraphRelation = (typeof GRAPH_RELATIONS)[number]['key']

export type GraphEdge = { id: string; from: number; to: number; relation: GraphRelation }

/** Normaliza uma aresta da API para "principal → derivada" e a categoria da seta. */
function normalize(from: number, to: number, type: string): Omit<GraphEdge, 'id'> {
  switch (type) {
    case 'SEQUEL':
      return { from, to, relation: 'SEQUEL' }
    case 'PREQUEL':
      return { from: to, to: from, relation: 'SEQUEL' }
    // `to` é a obra principal de `from`: a derivada é `from`.
    case 'PARENT':
      return { from: to, to: from, relation: 'SIDE_STORY' }
    case 'SIDE_STORY':
    case 'SPIN_OFF':
    case 'SUMMARY':
    case 'ALTERNATIVE':
      return { from, to, relation: type }
    default:
      return { from, to, relation: 'OTHER' }
  }
}

/** Uma seta por par de obras, com a relação de maior prioridade entre as que o par tem. */
export function graphEdges(graph: AnimeRelationGraphResponse): GraphEdge[] {
  const rank = (r: GraphRelation) => GRAPH_RELATIONS.findIndex((x) => x.key === r)
  const best = new Map<string, Omit<GraphEdge, 'id'>>()
  for (const e of graph.edges ?? []) {
    if (!e.relationType || e.from === e.to) continue
    const n = normalize(e.from, e.to, e.relationType)
    const pair = [Math.min(n.from, n.to), Math.max(n.from, n.to)].join('-')
    const cur = best.get(pair)
    if (!cur || rank(n.relation) < rank(cur.relation)) best.set(pair, n)
  }
  return [...best.entries()].map(([pair, e]) => ({ id: pair, ...e }))
}

/**
 * `reversed`: a seta saiu da derivada para a principal (ex.: "Anterior"). `manual`: ligação sem
 * relação na AniList, só para o layout pendurar no início uma obra posta à mão; não é desenhada.
 */
export type OrientedEdge = GraphEdge & { label: string; reversed: boolean; manual?: boolean }

/** Cada seta com o nome da relação no sentido natural (principal → derivada). */
export function labelEdges(edges: GraphEdge[]): OrientedEdge[] {
  return edges.map((e) => ({ ...e, label: GRAPH_RELATIONS.find((r) => r.key === e.relation)!.label, reversed: false }))
}

/**
 * Faz a seta entre cada obra e o pai dela na árvore (`tree`: obra → pai) sair do pai, invertendo o
 * rótulo se preciso. Sem seta entre os dois no desenho (o tipo da relação está desligado no filtro),
 * entra uma ligação `manual`, que só serve ao layout e não é desenhada: o desenho não muda de forma
 * conforme o filtro.
 */
export function applyTreeParents(edges: OrientedEdge[], tree: Map<number, number>): OrientedEdge[] {
  if (!tree.size) return edges
  const result = edges.filter((e) => tree.get(e.to) !== e.from && tree.get(e.from) !== e.to)
  for (const [child, parent] of tree) {
    const own = edges.find((e) => (e.from === parent && e.to === child) || (e.from === child && e.to === parent))
    if (own?.from === parent) result.push(own)
    else if (own) {
      const rel = GRAPH_RELATIONS.find((r) => r.key === own.relation)!
      const reversed = !own.reversed
      result.push({ ...own, from: parent, to: child, label: reversed ? rel.inverse : rel.label, reversed })
    } else {
      result.push({
        id: `manual-${child}`,
        from: parent,
        to: child,
        relation: 'OTHER',
        label: 'Posta à mão',
        reversed: false,
        manual: true,
      })
    }
  }
  return result
}

export const NODE_W = 240
export const NODE_H = 64

type Point = { x: number; y: number }
export type Side = 'top' | 'bottom' | 'left' | 'right'
type Dir = 'up' | 'down' | 'left' | 'right'

/** Espaço entre colunas (rótulos das setas laterais) e entre linhas (rótulos das verticais). */
const H_GAP = 130
const V_GAP = 56
/** Espaço entre partes do grafo sem ligação entre si (com algum tipo de relação desligado). */
const COMPONENT_GAP = 200

/**
 * Lado de saída/entrada de cada seta. Árvore: o sentido da relação; demais setas: o lado de onde
 * a outra obra está.
 */
export type GraphLayout = {
  positions: Map<number, Point>
  handles: Map<string, { source: Side; target: Side }>
  /** Pai de cada obra na árvore do desenho (a raiz e as partes soltas não têm). */
  parentOf: Map<number, number>
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
const SIDE_OF: Record<Dir, Side> = { up: 'top', down: 'bottom', left: 'left', right: 'right' }

/**
 * Layout pela relação: a partir da raiz, continuação fica abaixo, obra anterior acima, filmes à
 * esquerda e o resto (especiais, histórias paralelas, spin-offs) à direita da obra de que deriva.
 * Cada obra forma um bloco com a própria coluna de continuações e, em cada linha, os galhos
 * laterais empilhados — a mesma regra vale dentro de cada galho.
 */
export function layoutByRelation(
  nodeIds: number[],
  edges: OrientedEdge[],
  isMovie: (id: number) => boolean,
  /** Pai fixo de cada obra na árvore (obra → pai): a obra só entra na árvore por ele. */
  tree: Map<number, number> = new Map(),
): GraphLayout {
  const out = new Map<number, OrientedEdge[]>()
  for (const e of edges) out.set(e.from, [...(out.get(e.from) ?? []), e])
  const rank = (r: GraphRelation) => GRAPH_RELATIONS.findIndex((x) => x.key === r)
  for (const list of out.values()) list.sort((a, b) => rank(a.relation) - rank(b.relation) || a.to - b.to)

  // Árvore: cada obra pendurada no pai fixo (`tree`) ou na primeira obra que a alcança pelas setas.
  const parentEdge = new Map<number, OrientedEdge>()
  const seen = new Set<number>()
  const grow = (start: number) => {
    seen.add(start)
    let frontier = [start]
    while (frontier.length) {
      const next: number[] = []
      for (const id of frontier) {
        for (const e of out.get(id) ?? []) {
          if (seen.has(e.to)) continue
          if (tree.has(e.to) && tree.get(e.to) !== id) continue
          seen.add(e.to)
          parentEdge.set(e.to, e)
          next.push(e.to)
        }
      }
      frontier = next
    }
  }
  // Começa pelas obras que não têm nada acima (o topo natural), na ordem do id: o desenho não depende
  // de qual obra é o início da franquia.
  const starts: number[] = []
  const hasIncoming = new Set(edges.map((e) => e.to))
  for (const id of [...nodeIds].sort((a, b) => Number(hasIncoming.has(a)) - Number(hasIncoming.has(b)) || a - b)) {
    if (seen.has(id)) continue
    starts.push(id)
    grow(id)
  }

  const children = (id: number) => (out.get(id) ?? []).filter((e) => parentEdge.get(e.to) === e)
  const dirOf = (e: OrientedEdge): Dir =>
    e.relation === 'SEQUEL' ? (e.reversed ? 'up' : 'down') : isMovie(e.to) ? 'left' : 'right'

  type Block = { w: number; h: number; pos: Map<number, Point> }
  const block = (id: number): Block => {
    // Coluna: a obra, as anteriores acima e as continuações abaixo (a primeira de cada; as outras
    // viram galhos laterais).
    const spine = [id]
    const follow = (dir: Dir, add: (n: number) => void) => {
      let e = children(id).find((c) => dirOf(c) === dir)
      while (e) {
        add(e.to)
        e = children(e.to).find((c) => dirOf(c) === dir)
      }
    }
    follow('down', (n) => spine.push(n))
    follow('up', (n) => spine.unshift(n))
    const inSpine = new Set(spine)
    const rows = spine.map((s) => {
      const side = children(s).filter((c) => !inSpine.has(c.to))
      const left = side.filter((c) => isMovie(c.to)).map((c) => block(c.to))
      const right = side.filter((c) => !isMovie(c.to)).map((c) => block(c.to))
      const stack = (bs: Block[]) => bs.reduce((h, b, i) => h + b.h + (i ? V_GAP : 0), 0)
      return { id: s, left, right, h: Math.max(NODE_H, stack(left), stack(right)) }
    })
    const leftW = Math.max(0, ...rows.flatMap((r) => r.left.map((b) => b.w)))
    const rightW = Math.max(0, ...rows.flatMap((r) => r.right.map((b) => b.w)))
    const spineX = leftW ? leftW + H_GAP : 0
    const pos = new Map<number, Point>()
    let y = 0
    for (const r of rows) {
      pos.set(r.id, { x: spineX, y })
      let ly = y
      for (const b of r.left) {
        for (const [k, p] of b.pos) pos.set(k, { x: spineX - H_GAP - b.w + p.x, y: ly + p.y })
        ly += b.h + V_GAP
      }
      let ry = y
      for (const b of r.right) {
        for (const [k, p] of b.pos) pos.set(k, { x: spineX + NODE_W + H_GAP + p.x, y: ry + p.y })
        ry += b.h + V_GAP
      }
      y += r.h + V_GAP
    }
    return { w: spineX + NODE_W + (rightW ? H_GAP + rightW : 0), h: y - V_GAP, pos }
  }

  // Partes sem ligação ficam lado a lado, da maior para a menor.
  const blocks = starts.map((st) => ({ st, b: block(st) })).sort((a, b) => b.b.pos.size - a.b.pos.size || a.st - b.st)
  const positions = new Map<number, Point>()
  let x = 0
  for (const { b } of blocks) {
    for (const [k, p] of b.pos) positions.set(k, { x: x + p.x, y: p.y })
    x += b.w + COMPONENT_GAP
  }

  const handles = new Map<string, { source: Side; target: Side }>()
  for (const e of edges) {
    let source: Side
    if (parentEdge.get(e.to) === e) source = SIDE_OF[dirOf(e)]
    else {
      const a = positions.get(e.from)!
      const b = positions.get(e.to)!
      const dx = b.x - a.x
      const dy = b.y - a.y
      source = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'bottom' : 'top') : dx > 0 ? 'right' : 'left'
    }
    handles.set(e.id, { source, target: OPPOSITE[source] })
  }
  const parentOf = new Map([...parentEdge.entries()].map(([child, e]) => [child, e.from]))
  return { positions, handles, parentOf }
}
