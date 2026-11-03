import '@xyflow/react/dist/base.css'
import {
  Background,
  BaseEdge,
  Controls,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  Handle,
  MarkerType,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  type Rect,
  ReactFlow,
  useReactFlow,
  useStore,
} from '@xyflow/react'
import { useEffect, useMemo, useState } from 'react'
import type { AnimeRelationGraphResponse } from '@/api/generated/model'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Dialog } from '@/components/ui/dialog'
import type { Tone } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Thumb } from '@/components/ui/thumb'
import { Tooltip } from '@/components/ui/tooltip'
import {
  GRAPH_RELATIONS,
  type GraphRelation,
  graphEdges,
  applyTreeParents,
  layoutByRelation,
  NODE_H,
  NODE_W,
  labelEdges,
  type Side,
} from './relationsGraph'
import { cn } from '@/lib/utils'

export type GraphWork = {
  anilistId: number
  title: string
  poster?: string | null
  folderId?: number | null
  /** Selo "Início": a raiz da franquia. */
  flag: boolean
}

export type GraphStatus = { label: string; tone: Tone }

type WorkNodeData = {
  work: GraphWork
  status: GraphStatus
  current: boolean
  dimmed: boolean
  selected: boolean
  hovered: boolean
}

const TONE_FG: Record<string, string> = {
  ok: 'text-[var(--ok-fg)]',
  warn: 'text-[var(--warn-fg)]',
  info: 'text-[var(--info-fg)]',
  neutral: 'text-muted',
  accent: 'text-accent-text',
}

// Alças invisíveis nos quatro lados: o layout escolhe por qual lado cada seta sai e entra.
const HANDLE_SIDES: [Side, Position][] = [
  ['top', Position.Top],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
  ['right', Position.Right],
]
const HANDLE_CLASS = '!h-1 !w-1 !min-w-0 !border-0 !bg-transparent'

function WorkNode({ data: d }: NodeProps<Node<WorkNodeData>>) {
  return (
    <div
      className={cn(
        'relative flex h-[64px] w-[240px] cursor-pointer items-center gap-2.5 rounded-rs px-2.5 transition-colors',
        d.current ? 'border-2 border-accent bg-tint' : d.hovered ? 'border border-accent bg-tint' : 'border border-line bg-bg',
        d.dimmed && !d.current && 'border-dashed',
        d.selected && 'outline outline-2 outline-offset-2 outline-accent',
      )}
    >
      {HANDLE_SIDES.map(([side, position]) => (
        <Handle key={`t-${side}`} id={`t-${side}`} type="target" position={position} className={HANDLE_CLASS} />
      ))}
      <div className={cn('flex min-w-0 flex-1 items-center gap-2.5', d.dimmed && 'opacity-45')}>
        <Thumb src={d.work.poster} width={30} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-xs font-semibold leading-tight" title={d.work.title}>
            {d.work.title}
          </span>
          <span className="flex items-center gap-1.5 text-2xs font-semibold">
            {d.work.flag && (
              <span className="flex items-center gap-[2px] text-accent-text">
                <Icon name="flag" size={12} />
                Início
              </span>
            )}
            <span className={TONE_FG[d.status.tone] ?? 'text-muted'}>{d.status.label}</span>
          </span>
        </div>
      </div>
      {HANDLE_SIDES.map(([side, position]) => (
        <Handle key={`s-${side}`} id={`s-${side}`} type="source" position={position} className={HANDLE_CLASS} />
      ))}
    </div>
  )
}

const nodeTypes = { work: WorkNode }

type RelationEdgeData = { label: string; hot: boolean; faded: boolean }

/**
 * Seta com o nome da relação numa pílula semitransparente. O rótulo vai para a camada de rótulos
 * (`EdgeLabelRenderer`), que o CSS de `.akari-flow` põe acima de nós e setas, para nunca ficar
 * coberto.
 */
function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps<Edge<RelationEdgeData>>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {data && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, zIndex: data.hot ? 2 : 1 }}
            className={cn(
              'pointer-events-none absolute whitespace-nowrap rounded-full border px-2 py-px text-2xs backdrop-blur-[2px]',
              'bg-[color-mix(in_oklch,var(--panel)_78%,transparent)]',
              data.hot
                ? 'border-accent font-semibold text-accent-text'
                : data.faded
                  ? 'border-line text-muted opacity-60'
                  : 'border-line text-muted',
            )}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const edgeTypes = { relation: RelationEdge }

/** Zoom mínimo em que os cartões ainda dão para ler. */
const READABLE_ZOOM = 0.55

/**
 * Enquadra o grafo pelas posições do layout (os nós têm tamanho fixo, não precisa medir). Se caber
 * tudo exigir um zoom ilegível (franquias com cadeias longas), abre num zoom legível, com o topo do
 * desenho no alto da tela e centrado em `focus` na horizontal; o resto fica a um arraste.
 */
function AutoFit({ bounds, focus }: { bounds: Rect; focus?: { x: number; y: number } }) {
  const { fitBounds, setViewport } = useReactFlow()
  const width = useStore((st) => st.width)
  const height = useStore((st) => st.height)
  useEffect(() => {
    if (!width || !height) return
    const fit = Math.min(width / bounds.width, height / bounds.height) * 0.94
    if (fit >= READABLE_ZOOM || !focus) void fitBounds(bounds, { padding: 0.06 })
    else void setViewport({ x: width / 2 - focus.x * READABLE_ZOOM, y: 24 - bounds.y * READABLE_ZOOM, zoom: READABLE_ZOOM })
  }, [bounds, focus, width, height, fitBounds, setViewport])
  return null
}

/**
 * Grafo da franquia: os membros e as obras relacionadas de outras franquias (esmaecidas), com uma
 * seta por par de obras no sentido natural da relação. A árvore do desenho segue o pai automático
 * de cada membro (`treeParentOf`), a mesma regra que decide a franquia: o que está abaixo de uma obra
 * vai junto quando ela é movida. Qual obra é o início não muda o desenho, só o selo "Início".
 * "Só esta franquia" tira do desenho as demais obras. Clicar numa obra abre o modal dela
 * (`renderDetails`).
 */
export function FranchiseGraph({
  graph,
  rootId,
  focusId,
  workOf,
  statusOf,
  isMember,
  isMovie,
  treeParentOf,
  renderDetails,
}: {
  graph: AnimeRelationGraphResponse
  rootId: number
  /** Obra em que o desenho abre centrado quando não cabe inteiro num zoom legível. */
  focusId?: number
  workOf: (id: number) => GraphWork | undefined
  statusOf: (w: GraphWork) => GraphStatus
  /** Membro da franquia; as demais obras (relacionadas) ficam esmaecidas. */
  isMember: (id: number) => boolean
  /** Filmes ficam à esquerda da obra de que derivam. */
  isMovie: (id: number) => boolean
  /** Pai da obra na árvore do desenho (o pai automático do membro, quando ele está na franquia). */
  treeParentOf: (id: number) => number | undefined
  /** Conteúdo do modal (um `DialogContent`) da obra clicada; `close` fecha o modal. */
  renderDetails: (w: GraphWork, close: () => void) => React.ReactNode
}) {
  const all = useMemo(() => graphEdges(graph), [graph])
  const present = GRAPH_RELATIONS.filter((r) => all.some((e) => e.relation === r.key))
  // Versão alternativa começa desligada: a AniList usa muito esse tipo e ele embola o desenho.
  const [off, setOff] = useState<Set<GraphRelation>>(() => new Set(['ALTERNATIVE']))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [full, setFull] = useState(false)

  // Tela cheia é uma camada sobre o portal, não o modo do navegador: no modo do navegador o modal da
  // obra, renderizado fora do grafo, ficaria invisível. Esc sai, a menos que já tenha fechado algo
  // (modal ou seletor marcam o Esc que trataram com preventDefault).
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setFull(false)
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [full])

  // Medidas que o React Flow informa. Os nós são recriados a cada render (hover, seleção, status);
  // sem `measured` ele zera as medidas e as alças, e o nó some até ser medido de novo.
  const [measured, setMeasured] = useState<Map<string, { width: number; height: number }>>(() => new Map())
  const onNodesChange = (changes: NodeChange<Node<WorkNodeData>>[]) => {
    const dims = changes.flatMap((c) => (c.type === 'dimensions' && c.dimensions ? [{ id: c.id, ...c.dimensions }] : []))
    if (!dims.length) return
    setMeasured((cur) => {
      const next = new Map(cur)
      for (const d of dims) next.set(d.id, { width: d.width, height: d.height })
      return next
    })
  }

  // "Só esta franquia" tira do desenho as obras de outras franquias e as ocultas.
  const [scope, setScope] = useState<'all' | 'members'>('all')
  const allIds = (graph.nodes ?? []).map((n) => n.anilistId)
  const scopeKey = scope === 'all' ? 'all' : allIds.filter((id) => isMember(id)).join(',')
  const ids = useMemo(
    () => (scopeKey === 'all' ? (graph.nodes ?? []).map((n) => n.anilistId) : scopeKey.split(',').map(Number)),
    [graph, scopeKey],
  )
  // Chaves em texto: as funções mudam de identidade a cada render, e refazer o layout reenquadraria o
  // grafo a cada hover.
  const movieKey = ids.filter((id) => isMovie(id)).join(',')
  const treeKey = ids.flatMap((id) => (treeParentOf(id) != null ? [`${id}:${treeParentOf(id)}`] : [])).join(',')
  const { edges, layout } = useMemo(() => {
    const movies = new Set(movieKey.split(',').map(Number))
    const tree = new Map(treeKey ? treeKey.split(',').map((pair) => pair.split(':').map(Number) as [number, number]) : [])
    const inScope = new Set(ids)
    const edges = applyTreeParents(
      labelEdges(all.filter((e) => !off.has(e.relation) && inScope.has(e.from) && inScope.has(e.to))),
      tree,
    )
    return { edges, layout: layoutByRelation(ids, edges, (id) => movies.has(id), tree) }
  }, [all, off, ids, movieKey, treeKey])
  const positions = layout.positions
  const bounds = useMemo<Rect>(() => {
    const ps = [...positions.values()]
    const x = Math.min(...ps.map((p) => p.x))
    const y = Math.min(...ps.map((p) => p.y))
    return {
      x,
      y,
      width: Math.max(...ps.map((p) => p.x)) + NODE_W - x,
      height: Math.max(...ps.map((p) => p.y)) + NODE_H - y,
    }
  }, [positions])
  const focus = useMemo(() => {
    const p = positions.get(focusId ?? rootId) ?? positions.get(rootId)
    return p && { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 }
  }, [positions, focusId, rootId])

  const nodes: Node<WorkNodeData>[] = ids.flatMap((id) => {
    const work = workOf(id)
    const pos = positions.get(id)
    if (!work || !pos) return []
    return [
      {
        id: String(id),
        type: 'work',
        position: pos,
        measured: measured.get(String(id)),
        draggable: false,
        connectable: false,
        data: {
          work,
          status: statusOf(work),
          current: id === focusId,
          dimmed: !isMember(id),
          selected: id === selectedId,
          hovered: id === hoveredId,
        },
      },
    ]
  })

  // A seta de "posta à mão" só posiciona a obra no layout; não é desenhada (o selo "Manual" já diz).
  const flowEdges: Edge<RelationEdgeData>[] = edges
    .filter((e) => !e.manual)
    .map((e) => {
      const faded = !isMember(e.from) || !isMember(e.to)
      // Relações da obra sob o mouse em laranja, por cima das demais.
      const hot = hoveredId != null && (e.from === hoveredId || e.to === hoveredId)
      const color = hot ? 'var(--accent)' : faded ? 'var(--line)' : 'var(--muted)'
      return {
        id: e.id,
        source: String(e.from),
        sourceHandle: `s-${layout.handles.get(e.id)?.source ?? 'right'}`,
        targetHandle: `t-${layout.handles.get(e.id)?.target ?? 'left'}`,
        target: String(e.to),
        type: 'relation',
        data: { label: e.label, hot, faded },
        zIndex: hot ? 1 : 0,
        style: {
          stroke: color,
          strokeWidth: hot ? 2.5 : 1.5,
          strokeDasharray: e.relation === 'ALTERNATIVE' ? '5 4' : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      }
    })

  const selected = selectedId != null ? workOf(selectedId) : undefined

  return (
    <div className={cn('flex flex-col gap-2.5', full && 'fixed inset-0 z-40 bg-bg p-4')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Tooltip content="“Árvore completa” mostra também, esmaecidas, as obras relacionadas que estão em outras franquias ou ocultas.">
          <span>
            <Segmented
              aria-label="Obras no desenho"
              value={scope}
              onChange={setScope}
              options={[
                {
                  value: 'all',
                  label: (
                    <span className="flex items-center gap-1.5">
                      <Icon name="account_tree" size={16} />
                      Árvore completa
                    </span>
                  ),
                },
                {
                  value: 'members',
                  label: (
                    <span className="flex items-center gap-1.5">
                      <Icon name="filter_center_focus" size={16} />
                      Só esta franquia
                    </span>
                  ),
                },
              ]}
            />
          </span>
        </Tooltip>
        <span className="hidden h-5 w-px bg-line sm:block" />
        <div role="group" aria-label="Tipos de relação no desenho" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs font-semibold uppercase tracking-[.06em] text-muted">Relações</span>
          {present.map((r) => {
            const on = !off.has(r.key)
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setOff((cur) => {
                    const next = new Set(cur)
                    if (on) next.add(r.key)
                    else next.delete(r.key)
                    return next
                  })
                }
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-sm font-medium transition-colors',
                  on ? 'border-accent bg-tint text-text' : 'border-line text-muted hover:border-muted hover:text-text',
                )}
              >
                {/* Amostra do traço da seta: versão alternativa é tracejada. */}
                <svg width="16" height="6" aria-hidden className={on ? 'text-accent-text' : 'text-muted'}>
                  <line
                    x1="0"
                    y1="3"
                    x2="16"
                    y2="3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={r.key === 'ALTERNATIVE' ? '4 3' : undefined}
                  />
                </svg>
                {r.label}
              </button>
            )
          })}
        </div>
        <span className="flex-1" />
        <Tooltip content={full ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={full ? 'Sair da tela cheia' : 'Tela cheia'}
            onClick={() => setFull((v) => !v)}
          >
            <Icon name={full ? 'fullscreen_exit' : 'fullscreen'} size={20} />
          </Button>
        </Tooltip>
      </div>
      <div
        className={cn(
          'akari-flow relative overflow-hidden rounded-rs border border-line bg-bg',
          full ? 'min-h-0 flex-1' : 'h-[min(720px,calc(100vh-260px))] min-h-[460px]',
        )}
      >
        <ReactFlow
          nodes={nodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, n) => setSelectedId(Number(n.id))}
          onNodeMouseEnter={(_, n) => setHoveredId(Number(n.id))}
          onNodeMouseLeave={() => setHoveredId(null)}
          nodesDraggable={false}
          nodesConnectable={false}
          minZoom={0.2}
        >
          <AutoFit bounds={bounds} focus={focus} />
          <Background gap={20} color="var(--line)" />
          <Controls showInteractive={false} orientation="horizontal" />
        </ReactFlow>
      </div>
      <span className="text-sm text-muted">
        {scope === 'all' && 'Obras esmaecidas são relacionadas que estão em outra franquia ou ocultas. '}
        Clique numa obra para ver as ações dela.
        {full && ' Esc sai da tela cheia.'}
      </span>
      <Dialog open={selected != null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && renderDetails(selected, () => setSelectedId(null))}
      </Dialog>
    </div>
  )
}
