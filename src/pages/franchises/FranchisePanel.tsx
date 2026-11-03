import { useQueries } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGetAnimeQueryOptions } from '@/api/generated/endpoints/anime/anime'
import { useGetFranchise } from '@/api/generated/endpoints/anime-franchise/anime-franchise'
import { useGetAnimeRelationGraph } from '@/api/generated/endpoints/anime-relations/anime-relations'
import type {
  AnimeRelationGraphResponse,
  AnimeResponse,
  FranchiseDetail,
  FranchiseMember,
  FranchiseRelatedAnime,
} from '@/api/generated/model'
import { errorStatus } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Chip, type Tone } from '@/components/ui/chip'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { Tooltip } from '@/components/ui/tooltip'
import { ASSIGNMENT, relationLabel, SEASON_LABEL } from '@/features/item/labels'
import { cn } from '@/lib/utils'
import { FranchiseGraph, type GraphWork } from './FranchiseGraph'
import { FranchisePreview } from './FranchisePreview'
import { CollectionPicker, FranchisePicker } from './pickers'
import { type FranchiseActions, titleOf, useFranchiseActions, type Work } from './useFranchiseActions'

/** A busca do grafo para quando não acha obras novas: uma profundidade alta traz a franquia inteira. */
const GRAPH_DEPTH = 50

/** `description`: o que acontece, no modal da obra; `danger`: ação que tira a obra da franquia. */
type Action = { key: string; icon: string; label: string; description: string; danger?: boolean; onClick: () => void }

const animeTitle = (a: AnimeResponse) => a.titles?.main ?? `AniList ${a.anilistId}`
const animeMeta = (a: { format?: string | null; season?: string | null; year?: number | null }) =>
  [a.format, [a.season ? SEASON_LABEL[a.season] : null, a.year].filter(Boolean).join(' ')].filter(Boolean).join(' · ')

/**
 * A franquia selecionada: os membros (grafo, lista ou prévia), as obras relacionadas que estão em
 * outras franquias e as ações de organização. Toda a regra de quem pertence a quê vem do backend
 * (`GET /v1/metadata/franchises/{rootId}`); o portal só mostra e chama as ações.
 */
export function FranchisePanel({ rootId }: { rootId: number }) {
  const navigate = useNavigate()
  const detail = useGetFranchise(rootId)
  // O grafo de relações completo (a busca para quando não acha obras novas) é o que o desenho mostra:
  // a árvore inteira, não só os membros e os vizinhos diretos. Os nós dele também trazem a pasta, que
  // o `AnimeResponse` dos membros não traz, para os links "Abrir item".
  const graph = useGetAnimeRelationGraph(rootId, { depth: GRAPH_DEPTH })
  const actions = useFranchiseActions()
  const [view, setView] = useState<'graph' | 'list' | 'preview'>('graph')
  const [moving, setMoving] = useState<{ work: Work; isRoot: boolean } | null>(null)
  const [removing, setRemoving] = useState<Work | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const d = detail.data
  // Obras da árvore que não são membros nem vizinhas diretas: o detalhe não diz em que franquia estão,
  // então o portal lê cada uma (o anime traz `franchiseRootId`).
  const extraIds = useMemo(() => {
    if (!d || !graph.data) return []
    const known = new Set([...(d.members ?? []), ...(d.related ?? [])].map((x) => x.anime.anilistId))
    return (graph.data.nodes ?? []).map((n) => n.anilistId).filter((id) => !known.has(id))
  }, [d, graph.data])
  const extras = useQueries({ queries: extraIds.map((id) => getGetAnimeQueryOptions(id)) })
  const extraKey = extras.map((q) => (q.data ? `${q.data.anilistId}:${q.data.franchiseRootId ?? ''}` : '')).join(',')
  const model = useMemo(
    () => {
      if (!d) return null
      const extraAnimes = new Map(extras.flatMap((q) => (q.data ? [[q.data.anilistId, q.data] as const] : [])))
      return buildModel(d, graph.data, extraAnimes)
    },
    // `extras` muda de identidade a cada render; `extraKey` muda só quando os dados mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, graph.data, extraKey],
  )

  if (detail.isLoading) return <Loading />
  if (detail.isError) {
    if (errorStatus(detail.error) === 404) {
      return (
        <EmptyState
          icon="account_tree"
          title="Esta franquia não existe mais"
          description="A obra de início foi movida para outra franquia ou deixou de ser início. Escolha outra franquia na lista."
          dashed
        />
      )
    }
    return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
  }
  if (!d || !model) return null

  const root: Work = { anilistId: d.root.anilistId, title: animeTitle(d.root) }
  const members = d.members ?? []
  const related = d.related ?? []

  const memberActions = (m: FranchiseMember, close?: () => void): Action[] => {
    const w: Work = { anilistId: m.anime.anilistId, title: animeTitle(m.anime) }
    const then = (fn: () => void | Promise<void>) => () => {
      close?.()
      void fn()
    }
    const isRoot = w.anilistId === rootId
    if (isRoot) {
      return [
        {
          key: 'move',
          icon: 'call_merge',
          label: 'Juntar a outra franquia',
          description: 'Todas as obras desta franquia vão para a franquia escolhida.',
          onClick: then(() => setMoving({ work: w, isRoot })),
        },
      ]
    }
    return [
      {
        key: 'move',
        icon: 'drive_file_move',
        label: 'Mover para outra franquia',
        description: 'Vai para a franquia escolhida, com as obras que estão abaixo dela.',
        onClick: then(() => setMoving({ work: w, isRoot })),
      },
      {
        key: 'root',
        icon: 'flag',
        label: 'Tornar início da franquia',
        description: 'Ela passa a abrir esta franquia; nenhuma obra sai.',
        onClick: then(async () => {
          if (await actions.makeRoot(w, root)) navigate(`/franquias/${w.anilistId}`)
        }),
      },
      ...(m.assignment === 'MANUAL_MEMBER'
        ? [
            {
              key: 'auto',
              icon: 'undo',
              label: 'Voltar ao automático',
              description: 'Volta para a franquia do pai automático dela.',
              onClick: then(() => void actions.toAuto(w)),
            },
          ]
        : []),
      {
        key: 'remove',
        icon: 'remove_circle_outline',
        label: 'Remover desta franquia',
        description: 'Vira uma franquia própria ou fica oculta.',
        danger: true,
        onClick: then(() => setRemoving(w)),
      },
    ]
  }
  // Obra de fora da franquia (vizinha direta ou mais distante na árvore).
  const outsideActions = (w: Work, close?: () => void): Action[] => [
    {
      key: 'move',
      icon: 'input',
      label: 'Trazer para esta franquia',
      description: 'Sai de onde está e entra nesta, com as obras que estão abaixo dela.',
      onClick: () => {
        close?.()
        void actions.moveTo(w, root)
      },
    },
  ]
  const relatedActions = (r: FranchiseRelatedAnime, close?: () => void) =>
    outsideActions({ anilistId: r.anime.anilistId, title: titleOf(r.anime) }, close)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="card flex flex-wrap items-center gap-4 p-4">
        <Thumb src={d.root.thumbnails?.medium ?? d.root.thumbnails?.large} width={56} className="border border-line" />
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-17 font-semibold">{root.title}</h2>
            <Chip tone={d.kind === 'MANUAL' ? 'info' : 'neutral'} className="h-5 text-xs">
              {d.kind === 'MANUAL' ? 'Franquia manual' : 'Franquia automática'}
            </Chip>
          </div>
          <span className="text-sm text-muted">
            {members.length === 1 ? '1 obra' : `${members.length} obras`}
            {related.length > 0 && ` · ${related.length} relacionadas em outras franquias`}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon="add" onClick={() => setAdding(true)}>
            Adicionar obra
          </Button>
          {model.folderOf(rootId) != null && (
            <Button
              size="sm"
              icon="open_in_new"
              onClick={() => window.open(`/catalogo/${model.folderOf(rootId)}/anilist`, '_blank', 'noopener')}
            >
              Abrir item
            </Button>
          )}
          {d.kind === 'MANUAL' && (
            <Button size="sm" variant="danger" icon="delete" onClick={() => setDeleting(true)}>
              Excluir franquia
            </Button>
          )}
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
            <h3 className="m-0 text-15 font-semibold">Obras da franquia</h3>
            <span className="text-sm text-muted">
              Cada obra fica abaixo do pai automático dela; mover ou remover uma obra leva junto as que estão abaixo.
            </span>
          </div>
          <Segmented
            aria-label="Forma de exibir as obras"
            value={view}
            onChange={setView}
            options={[
              { value: 'graph', label: 'Grafo' },
              { value: 'list', label: 'Lista' },
              { value: 'preview', label: 'Prévia' },
            ]}
          />
        </div>

        {view === 'graph' &&
          (graph.isLoading ? (
            <Loading />
          ) : (
            <FranchiseGraph
              graph={model.graph}
              rootId={rootId}
              focusId={rootId}
              workOf={model.workOf}
              statusOf={model.statusOf}
              isMember={(id) => model.memberById.has(id)}
              isMovie={model.isMovie}
              treeParentOf={model.treeParentOf}
              renderDetails={(w, close) => {
                const m = model.memberById.get(w.anilistId)
                const r = model.relatedById.get(w.anilistId)
                const x = model.extraAnimes.get(w.anilistId)
                return (
                  <WorkDialog
                    work={w}
                    meta={m ? animeMeta(m.anime) : r ? animeMeta(r.anime) : x ? animeMeta(x) : ''}
                    status={model.statusOf(w)}
                    situation={model.situationOf(w.anilistId)}
                    actions={
                      m
                        ? memberActions(m, close)
                        : r
                          ? relatedActions(r, close)
                          : outsideActions({ anilistId: w.anilistId, title: w.title }, close)
                    }
                    busy={actions.busy}
                    onClose={close}
                    onOpen={
                      w.folderId != null
                        ? () => {
                            close()
                            window.open(`/catalogo/${w.folderId}/anilist`, '_blank', 'noopener')
                          }
                        : undefined
                    }
                  />
                )
              }}
            />
          ))}

        {view === 'list' && (
          <div className="flex flex-col gap-4">
            {model.groups.map((g) => (
              <div key={g.key} className="flex flex-col gap-1.5">
                <span className="group-label">
                  {g.label} · {g.items.length}
                </span>
                {g.items.length === 0 && <span className="text-13 text-muted">{g.empty}</span>}
                {g.items.map((m) => (
                  <WorkRow
                    key={m.anime.anilistId}
                    thumb={m.anime.thumbnails?.medium}
                    title={animeTitle(m.anime)}
                    meta={[animeMeta(m.anime), model.noteOf(m)].filter(Boolean).join(' · ')}
                    flag={m.anime.anilistId === rootId}
                    status={model.statusOf(model.workOf(m.anime.anilistId)!)}
                    folderId={model.folderOf(m.anime.anilistId)}
                    actions={memberActions(m)}
                    busy={actions.busy}
                    anilistId={m.anime.anilistId}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {view === 'preview' && <FranchisePreview anime={d.root} folderOf={model.folderOf} />}
      </section>

      {related.length > 0 && (
        <section className="card flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="m-0 text-15 font-semibold">Relacionadas em outras franquias · {related.length}</h3>
            <span className="text-sm text-muted">
              Obras com relação na AniList com alguma desta franquia, mas que estão em outra franquia ou ocultas.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {related.map((r) => (
              <WorkRow
                key={r.anime.anilistId}
                thumb={r.anime.thumbnail}
                title={titleOf(r.anime)}
                meta={[animeMeta(r.anime), model.relatedNote(r)].filter(Boolean).join(' · ')}
                flag={false}
                status={model.statusOf(model.workOf(r.anime.anilistId)!)}
                folderId={r.anime.folderId}
                actions={relatedActions(r)}
                busy={actions.busy}
                anilistId={r.anime.anilistId}
              />
            ))}
          </div>
        </section>
      )}

      <Dialog open={moving != null} onOpenChange={(o) => !o && setMoving(null)}>
        {moving && (
          <FranchisePicker
            title={moving.isRoot ? `Juntar a franquia de ${moving.work.title}` : `Mover ${moving.work.title}`}
            description={
              moving.isRoot
                ? 'Todas as obras desta franquia vão para a franquia escolhida.'
                : 'A obra vai para a franquia escolhida, com as que estão abaixo dela.'
            }
            stateOf={(f) => (f.root.anilistId === rootId ? 'Franquia atual' : null)}
            action={{ icon: 'check', label: 'Escolher', busyKey: () => `move-${moving.work.anilistId}` }}
            busy={actions.busy}
            onPick={async (f) => {
              const result = await actions.moveTo(moving.work, { anilistId: f.root.anilistId, title: titleOf(f.root) })
              setMoving(null)
              // Juntar a raiz encerra esta franquia: segue para a de destino.
              if (moving.isRoot && result) navigate(`/franquias/${result.root.anilistId}`)
            }}
          />
        )}
      </Dialog>

      <Dialog open={removing != null} onOpenChange={(o) => !o && setRemoving(null)}>
        {removing && (
          <RemoveDialog
            work={removing}
            franchise={root.title}
            branch={model.branchOf(removing.anilistId)}
            actions={actions}
            onDone={() => setRemoving(null)}
          />
        )}
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        {adding && (
          <CollectionPicker
            title={`Adicionar obra à franquia de ${root.title}`}
            description="A obra vem para esta franquia, com as que estão abaixo dela."
            stateOf={(b) => (model.memberById.has(b.anilistId) ? 'Já nesta franquia' : null)}
            action={{ icon: 'add', label: 'Adicionar', busyKey: (b) => `move-${b.anilistId}` }}
            busy={actions.busy}
            onPick={async (b) => {
              await actions.moveTo({ anilistId: b.anilistId, title: titleOf(b) }, root)
              setAdding(false)
            }}
          />
        )}
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        {deleting && (
          <DialogContent title={`Excluir a franquia de ${root.title}?`} width={460}>
            <div className="px-5 py-4 text-13 leading-normal">
              A obra de início e as obras postas à mão nesta franquia voltam ao automático: cada uma vai para a franquia do pai
              automático dela.
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              <Button size="sm" onClick={() => setDeleting(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="danger-solid"
                loading={actions.busy === `delete-${rootId}`}
                onClick={async () => {
                  await actions.deleteFranchise(root)
                  setDeleting(false)
                  navigate('/franquias')
                }}
              >
                Excluir
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

/** Dados derivados do detalhe da franquia para o grafo, a lista e os diálogos. */
function buildModel(
  d: FranchiseDetail,
  relGraph: AnimeRelationGraphResponse | undefined,
  extraAnimes: Map<number, AnimeResponse>,
) {
  const members = d.members ?? []
  const related = d.related ?? []
  const memberById = new Map(members.map((m) => [m.anime.anilistId, m]))
  const relatedById = new Map(related.map((r) => [r.anime.anilistId, r]))
  const folders = new Map<number, number>()
  for (const n of relGraph?.nodes ?? []) if (n.folderId != null) folders.set(n.anilistId, n.folderId)
  for (const r of related) if (r.anime.folderId != null) folders.set(r.anime.anilistId, r.anime.folderId)
  const folderOf = (id: number) => folders.get(id)
  const nodeTitles = new Map((relGraph?.nodes ?? []).map((n) => [n.anilistId, n.title]))
  const titleById = (id: number) => {
    const m = memberById.get(id)
    if (m) return animeTitle(m.anime)
    const r = relatedById.get(id)
    return r ? titleOf(r.anime) : (nodeTitles.get(id) ?? `AniList ${id}`)
  }
  const rootId = d.root.anilistId

  // Pai na árvore: o pai automático, quando ele está nesta franquia. Vale para todo membro, inclusive
  // o início e os postos à mão, para o desenho não depender de qual obra é o início.
  const treeParentOf = (id: number) => {
    const p = memberById.get(id)?.autoParentId
    return p != null && memberById.has(p) ? p : undefined
  }
  // O galho de uma obra: as que estão abaixo dela pela regra automática e vão junto se ela sair. O
  // início e as postas à mão não seguem o pai automático no backend, então não entram no galho.
  const children = new Map<number, number[]>()
  for (const m of members) {
    const id = m.anime.anilistId
    const p = treeParentOf(id)
    if (p != null && id !== rootId && m.assignment === 'AUTO') children.set(p, [...(children.get(p) ?? []), id])
  }
  const branchOf = (id: number): string[] => (children.get(id) ?? []).flatMap((c) => [titleById(c), ...branchOf(c)])

  const noteOf = (m: FranchiseMember) => {
    if (m.anime.anilistId === rootId) return 'Início da franquia'
    if (m.assignment === 'MANUAL_MEMBER') return 'posta à mão'
    const p = treeParentOf(m.anime.anilistId)
    return p != null ? `abaixo de ${titleById(p)}` : ''
  }
  // A frase do modal: onde a obra está e por quê.
  const situationOf = (id: number): string => {
    if (id === rootId) return 'É o início desta franquia.'
    const m = memberById.get(id)
    if (m) {
      if (m.assignment === 'MANUAL_MEMBER') return 'Foi posta à mão nesta franquia.'
      const p = treeParentOf(id)
      return p != null
        ? `Está nesta franquia porque fica abaixo de ${titleById(p)}, pelas relações da AniList.`
        : 'Está nesta franquia pelas relações da AniList.'
    }
    const r = relatedById.get(id)
    const where = (rootOf?: number | null) =>
      rootOf != null ? `Hoje está na franquia de ${titleById(rootOf)}.` : 'Hoje está oculta.'
    if (r) return `${relationLabel(r.relationType)} ligada a ${titleById(r.memberId)}. ${where(r.currentRoot?.anilistId)}`
    const x = extraAnimes.get(id)
    return x ? `Relacionada a esta franquia por outras obras. ${where(x.franchiseRootId)}` : 'Fora desta franquia.'
  }
  const relatedNote = (r: FranchiseRelatedAnime) => `${relationLabel(r.relationType)} · ligada a ${titleById(r.memberId)}`

  const graph: AnimeRelationGraphResponse = {
    rootAnilistId: rootId,
    nodes: [
      ...members.map((m) => ({
        anilistId: m.anime.anilistId,
        title: animeTitle(m.anime),
        posterUrl: m.anime.thumbnails?.medium,
        folderId: folderOf(m.anime.anilistId),
        rootKind: m.anime.anilistId === rootId ? d.kind : ('NOT_ROOT' as const),
      })),
      ...related.map((r) => ({
        anilistId: r.anime.anilistId,
        title: titleOf(r.anime),
        posterUrl: r.anime.thumbnail,
        folderId: r.anime.folderId,
        rootKind: 'NOT_ROOT' as const,
      })),
    ],
    edges: d.edges ?? [],
  }
  // Desenho: a árvore completa do grafo de relações, mais o que só o detalhe tem (membro posto à mão
  // sem relação nenhuma com a árvore). As setas repetidas viram uma só em `graphEdges`.
  if (relGraph) {
    const inGraph = new Set((relGraph.nodes ?? []).map((n) => n.anilistId))
    graph.nodes = [...(relGraph.nodes ?? []), ...(graph.nodes ?? []).filter((n) => !inGraph.has(n.anilistId))]
    graph.edges = [...(relGraph.edges ?? []), ...(graph.edges ?? [])]
  }
  const workOf = (id: number): GraphWork | undefined => {
    const n = graph.nodes?.find((x) => x.anilistId === id)
    return (
      n && { anilistId: id, title: n.title ?? `AniList ${id}`, poster: n.posterUrl, folderId: n.folderId, flag: id === rootId }
    )
  }
  const statusOf = (w: GraphWork): { label: string; tone: Tone } => {
    if (w.anilistId === rootId)
      return d.kind === 'MANUAL' ? { label: 'Manual', tone: 'info' } : { label: 'Automática', tone: 'neutral' }
    const m = memberById.get(w.anilistId)
    if (m) return { label: ASSIGNMENT[m.assignment].label, tone: ASSIGNMENT[m.assignment].tone }
    const rel = relatedById.get(w.anilistId)
    if (rel)
      return rel.currentRoot ? { label: `Em ${titleOf(rel.currentRoot)}`, tone: 'neutral' } : { label: 'Oculta', tone: 'warn' }
    const x = extraAnimes.get(w.anilistId)
    if (!x) return { label: 'Fora desta franquia', tone: 'neutral' }
    return x.franchiseRootId != null
      ? { label: `Em ${titleById(x.franchiseRootId)}`, tone: 'neutral' }
      : { label: 'Oculta', tone: 'warn' }
  }
  const formats = new Map<number, string | null | undefined>([
    ...members.map((m) => [m.anime.anilistId, m.anime.format] as const),
    ...related.map((r) => [r.anime.anilistId, r.anime.format] as const),
    ...[...extraAnimes.values()].map((x) => [x.anilistId, x.format] as const),
  ])
  const isMovie = (id: number) => formats.get(id) === 'MOVIE'

  // Lista: os grupos da prévia (temporadas, filmes, especiais), com a raiz antes se não estiver neles.
  const pick = (ids?: number[] | null) => (ids ?? []).flatMap((id) => memberById.get(id) ?? [])
  const listed = new Set([...(d.seasons ?? []), ...(d.movies ?? []), ...(d.specials ?? [])])
  const groups = [
    ...(listed.has(rootId) ? [] : [{ key: 'root', label: 'Início', empty: '', items: pick([rootId]) }]),
    { key: 'seasons', label: 'Temporadas', empty: 'Nenhuma temporada.', items: pick(d.seasons) },
    { key: 'movies', label: 'Filmes', empty: 'Nenhum filme.', items: pick(d.movies) },
    { key: 'specials', label: 'Especiais', empty: 'Nenhum especial.', items: pick(d.specials) },
  ]

  return {
    memberById,
    relatedById,
    extraAnimes,
    situationOf,
    folderOf,
    graph,
    workOf,
    statusOf,
    isMovie,
    treeParentOf,
    branchOf,
    noteOf,
    relatedNote,
    groups,
  }
}

/** Linha de uma obra (membro ou relacionada) com as ações em ícones. */
function WorkRow({
  anilistId,
  thumb,
  title,
  meta,
  flag,
  status,
  folderId,
  actions,
  busy,
}: {
  anilistId: number
  thumb?: string | null
  title: string
  meta: string
  flag: boolean
  status: { label: string; tone: Tone }
  folderId?: number | null
  actions: Action[]
  busy: string | null
}) {
  const loading = busy != null && busy.endsWith(`-${anilistId}`)
  return (
    <div className="flex items-center gap-3 rounded-rs border border-line bg-bg px-3 py-2">
      <Thumb src={thumb} width={30} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{title}</span>
          {flag && (
            <span className="flex items-center gap-[3px] text-xs font-semibold text-accent-text">
              <Icon name="flag" size={14} />
              Início
            </span>
          )}
        </div>
        <span className="truncate text-sm text-muted">{meta}</span>
      </div>
      {/* Largura limitada: "Em <título da outra franquia>" pode ser longo e esmagaria o título da obra. */}
      <Chip tone={status.tone} className="h-5 max-w-[200px] text-xs" title={status.label}>
        {status.label}
      </Chip>
      <div className="flex shrink-0 gap-1">
        {loading ? (
          <span className="flex h-[30px] w-[30px] items-center justify-center text-muted">
            <Icon name="progress_activity" size={18} className="animate-spin" />
          </span>
        ) : (
          <>
            {folderId != null && (
              <Tooltip content="Abrir item">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Abrir item"
                  onClick={() => window.open(`/catalogo/${folderId}/anilist`, '_blank', 'noopener')}
                >
                  <Icon name="open_in_new" size={18} />
                </Button>
              </Tooltip>
            )}
            {actions.map((a) => (
              <Tooltip key={a.key} content={a.label}>
                <Button size="icon-sm" variant="ghost" aria-label={a.label} disabled={busy != null} onClick={a.onClick}>
                  <Icon name={a.icon} size={18} />
                </Button>
              </Tooltip>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

/** Modal da obra clicada no grafo: onde ela está e as ações, cada uma dizendo o que acontece. */
function WorkDialog({
  work: w,
  meta,
  status,
  situation,
  actions,
  busy,
  onClose,
  onOpen,
}: {
  work: GraphWork
  meta: string
  status: { label: string; tone: Tone }
  situation: string
  actions: Action[]
  busy: string | null
  onClose: () => void
  onOpen?: () => void
}) {
  return (
    <DialogContent title={w.title} description={[meta, `AniList ${w.anilistId}`].filter(Boolean).join(' · ')} width={520}>
      <div className="flex gap-4 px-5 py-4">
        <Thumb src={w.poster} width={72} className="border border-line" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={status.tone} className="h-6 text-xs">
              {status.label}
            </Chip>
            {w.flag && (
              <span className="flex items-center gap-[3px] text-xs font-semibold text-accent-text">
                <Icon name="flag" size={14} />
                Início da franquia
              </span>
            )}
          </div>
          <p className="m-0 text-13 leading-normal text-muted">{situation}</p>
        </div>
      </div>
      {actions.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t border-line px-3 py-3">
          <span className="px-2 pb-1 text-xs font-semibold uppercase tracking-[.06em] text-muted">O que fazer</span>
          {actions.map((a) => {
            const loading = busy === `${a.key}-${w.anilistId}`
            return (
              <button
                key={a.key}
                type="button"
                disabled={busy != null}
                onClick={a.onClick}
                className="group flex items-center gap-3 rounded-rs px-2 py-2 text-left transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    a.danger ? 'bg-[var(--err-bg)] text-[var(--err-fg)]' : 'bg-raised text-text',
                  )}
                >
                  <Icon
                    name={loading ? 'progress_activity' : a.icon}
                    size={18}
                    className={loading ? 'animate-spin' : undefined}
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn('text-13 font-semibold', a.danger && 'text-[var(--err-fg)]')}>{a.label}</span>
                  <span className="text-sm text-muted">{a.description}</span>
                </span>
                <Icon name="chevron_right" size={18} className="text-muted transition-transform group-hover:translate-x-0.5" />
              </button>
            )
          })}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        {onOpen ? (
          <Button size="sm" variant="ghost" icon="open_in_new" onClick={onOpen}>
            Abrir item
          </Button>
        ) : (
          <span />
        )}
        <Button size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </DialogContent>
  )
}

/** Remover uma obra da franquia: ela precisa de um destino, franquia própria ou oculta. */
function RemoveDialog({
  work: w,
  franchise,
  branch,
  actions,
  onDone,
}: {
  work: Work
  franchise: string
  branch: string[]
  actions: FranchiseActions
  onDone: () => void
}) {
  const run = (fn: (w: Work) => Promise<unknown>) => async () => {
    await fn(w)
    onDone()
  }
  return (
    <DialogContent title={`Remover ${w.title} da franquia de ${franchise}`} width={500}>
      <div className="flex flex-col gap-3 px-5 py-4 text-13 leading-normal">
        <span>Para onde ela vai?</span>
        {branch.length > 0 && (
          <div className="flex flex-col gap-1 rounded-rs bg-[var(--warn-bg)] px-3 py-2.5 text-[var(--warn-fg)]">
            <span className="font-semibold">
              {branch.length === 1
                ? 'Vai junto 1 obra que está abaixo dela:'
                : `Vão junto ${branch.length} obras que estão abaixo dela:`}
            </span>
            <span>{branch.join(' · ')}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
        <Button size="sm" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          size="sm"
          icon="visibility_off"
          loading={actions.busy === `hide-${w.anilistId}`}
          disabled={actions.busy != null}
          onClick={run(actions.hide)}
        >
          Ocultar
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon="account_tree"
          loading={actions.busy === `own-${w.anilistId}`}
          disabled={actions.busy != null}
          onClick={run(actions.ownFranchise)}
        >
          Franquia própria
        </Button>
      </div>
    </DialogContent>
  )
}
