import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  deleteTmdbFilePairing,
  updateTmdbFilePairing,
  useGetTmdbFilePairingSchema,
} from '@/api/generated/endpoints/anime-tmdb-file-pairing/anime-tmdb-file-pairing'
import { useListVideoFiles } from '@/api/generated/endpoints/video-file/video-file'
import type {
  TmdbFilePairingRequest,
  TmdbFilePairingSchemaEpisode,
  TmdbFilePairingSchemaSeason,
  VideoFileResponse,
} from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Chip, type Tone } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Progress } from '@/components/ui/misc'
import { RadioDot } from '@/components/ui/radio'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { Switch } from '@/components/ui/switch'
import { Thumb } from '@/components/ui/thumb'
import { byName, proposeAutoPair, type AutoPairRow } from '@/features/item/autoPair'
import type { ItemState } from '@/features/item/useItem'
import { episodeCode, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

type Sel = { season: number; episode: number } | null
type Filter = 'all' | 'unpaired' | 'paired'

const isPaired = (f: VideoFileResponse) => f.tmdbPairing?.seasonNumber != null && f.tmdbPairing?.episodeNumber != null

function epMeta(ep: {
  airDate?: string | null
  runtime?: number | null
  voteAverage?: number | null
  voteCount?: number | null
}) {
  return [
    ep.airDate ? formatDate(ep.airDate) : 'sem data',
    ep.runtime != null && `${ep.runtime} min`,
    ep.voteAverage ? `★ ${ep.voteAverage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} (${ep.voteCount ?? 0})` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

const seasonLabel = (s: TmdbFilePairingSchemaSeason) =>
  s.seasonNumber === 0 ? 'S00 · Especiais' : `S${String(s.seasonNumber).padStart(2, '0')}${s.name ? ` · ${s.name}` : ''}`

function requestFor(ep: TmdbFilePairingSchemaEpisode, season: number, useStill: boolean): TmdbFilePairingRequest {
  return {
    seasonNumber: season,
    episodeNumber: ep.episodeNumber ?? null,
    thumbnailPath: useStill ? (ep.defaultStillPath ?? null) : null,
    episodeName: ep.name ?? null,
    episodeOverview: ep.overview ?? null,
    episodeAirDate: ep.airDate ?? null,
    episodeRuntime: ep.runtime ?? null,
    episodeVoteAverage: ep.voteAverage ?? null,
    episodeVoteCount: ep.voteCount ?? null,
    episodeType: ep.episodeType ?? null,
  }
}

export function PairingTab({ item, folderId }: { item: ItemState; folderId: number }) {
  const anilistId = item.anilistId!
  const filesQ = useListVideoFiles({ folderId, size: 1000 })
  const schemaQ = useGetTmdbFilePairingSchema(anilistId, { query: { staleTime: 5 * 60_000 } })
  const files = useMemo(() => [...(filesQ.data?.data ?? [])].sort(byName), [filesQ.data])
  const seasons = useMemo(
    () => [...(schemaQ.data?.seasons ?? [])].sort((a, b) => (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0)),
    [schemaQ.data],
  )

  const [filter, setFilter] = useState<Filter>('all')
  // Arquivo aberto no painel lateral; null = painel fechado.
  const [fileId, setFileId] = useState<number | null>(null)
  const [autoOpen, setAutoOpen] = useState(false)
  // Temporada e rolagem da última escolha de episódio: o painel reabre nelas (vale entre arquivos).
  const lastPick = useRef<LastPick | null>(null)

  const usedBy = useMemo(() => {
    const m = new Map<string, VideoFileResponse>()
    for (const f of files) if (isPaired(f)) m.set(`${f.tmdbPairing!.seasonNumber}:${f.tmdbPairing!.episodeNumber}`, f)
    return m
  }, [files])

  if (filesQ.isLoading || schemaQ.isLoading) return <Loading />
  if (filesQ.isError) return <ErrorState error={filesQ.error} onRetry={() => filesQ.refetch()} />
  if (schemaQ.isError) return <ErrorState error={schemaQ.error} onRetry={() => schemaQ.refetch()} />
  if (!files.length)
    return (
      <EmptyState
        dashed
        icon="video_file"
        title="Pasta sem arquivos de vídeo"
        description="Não há arquivos para parear nesta pasta."
      />
    )

  const pairedCount = files.filter(isPaired).length
  const pct = Math.round((pairedCount / files.length) * 100)
  const shownFiles = files.filter((f) => (filter === 'all' ? true : filter === 'paired' ? isPaired(f) : !isPaired(f)))
  const file = files.find((f) => f.id === fileId) ?? null

  const refresh = () => Promise.all([invalidate.videoFiles(), invalidate.anime(anilistId), invalidate.catalog()])

  return (
    <>
      <section className="card flex flex-wrap items-center gap-x-3.5 gap-y-2.5 px-5 py-3.5">
        <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
          <h3 className="m-0 text-15 font-semibold">Pareamento de arquivos com episódios TMDB</h3>
          <span className="text-sm text-muted">
            {pairedCount} de {files.length} arquivos pareados · série tv/{item.tmdb.data?.tmdbId} ·{' '}
            {seasons.filter((s) => (s.seasonNumber ?? 0) > 0).length} temporadas
          </span>
        </div>
        <div className="flex min-w-[200px] flex-[0_1_260px] items-center gap-2.5">
          <Progress value={pct} className="flex-1" />
          <span className="font-mono text-sm text-muted">{pct}%</span>
        </div>
        <Button size="sm" className={cn(autoOpen && 'border-accent bg-tint')} onClick={() => setAutoOpen((v) => !v)}>
          <Icon name="auto_mode" size={18} className="text-accent" />
          Auto-pair por continuidade
        </Button>
      </section>

      {autoOpen && schemaQ.data && (
        <AutoPairPanel
          rows={proposeAutoPair(files, schemaQ.data)}
          onClose={() => setAutoOpen(false)}
          onApplied={async () => {
            await refresh()
            setAutoOpen(false)
          }}
        />
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3">
          <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
            <span className="text-15 font-semibold">Arquivos da pasta</span>
            <span className="text-sm text-muted">Clique num arquivo para escolher o episódio.</span>
          </div>
          <Segmented
            aria-label="Filtro"
            value={filter}
            onChange={setFilter}
            className="h-[30px]"
            options={[
              { value: 'all', label: `Todos · ${files.length}` },
              { value: 'unpaired', label: `Sem par · ${files.length - pairedCount}` },
              { value: 'paired', label: `Pareados · ${pairedCount}` },
            ]}
          />
        </div>
        <div className={`grid ${FILE_COLS} gap-3 border-b border-line px-5 py-2 text-xs uppercase tracking-[.06em] text-muted`}>
          <span />
          <span>Nome do arquivo</span>
          <span>Episódio</span>
        </div>
        {shownFiles.map((f) => {
          const on = f.id === fileId
          const p = f.tmdbPairing
          const code = isPaired(f) ? episodeCode(p!.seasonNumber, p!.episodeNumber) : null
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFileId(f.id)}
              className={cn(
                `grid w-full ${FILE_COLS} items-start gap-3 border-b border-line px-5 py-2.5 text-left transition-colors last:border-b-0`,
                on ? 'bg-tint' : 'hover:bg-hover',
              )}
            >
              <Icon
                name={code ? 'check_circle' : 'radio_button_unchecked'}
                size={18}
                fill={!!code}
                className={cn('mt-px', code ? 'text-[var(--ok-fg)]' : 'text-muted')}
              />
              <span className={cn('min-w-0 break-all font-mono text-sm leading-[1.45]', on && 'font-semibold')}>{f.name}</span>
              <span className="flex min-w-0 items-baseline gap-2">
                <Chip tone={code ? 'ok' : 'warn'} mono className="h-5 shrink-0">
                  {code ?? 'sem par'}
                </Chip>
                {p?.episodeName && <span className="truncate text-sm text-muted">{p.episodeName}</span>}
              </span>
            </button>
          )
        })}
        {shownFiles.length === 0 && <div className="px-5 py-4 text-13 text-muted">Nenhum arquivo neste filtro.</div>}
      </section>

      {file && (
        <PairingPanel
          key={file.id}
          file={file}
          files={shownFiles.some((f) => f.id === file.id) ? shownFiles : files}
          allFiles={files}
          seasons={seasons}
          usedBy={usedBy}
          onSelect={setFileId}
          onClose={() => setFileId(null)}
          onSaved={refresh}
          lastPick={lastPick}
        />
      )}
    </>
  )
}

const FILE_COLS = 'grid-cols-[20px_minmax(0,1fr)_minmax(140px,240px)]'

/** `offset`: rolagem relativa ao topo da lista de episódios (a pré-visualização acima muda de altura). */
type LastPick = { season: number; offset: number }

/**
 * Editor do pareamento de um arquivo, num painel lateral não modal: a lista continua clicável
 * atrás dele. O rascunho é por arquivo (o painel é remontado a cada troca de arquivo).
 */
function PairingPanel({
  file,
  files,
  allFiles,
  seasons,
  usedBy,
  onSelect,
  onClose,
  onSaved,
  lastPick,
}: {
  file: VideoFileResponse
  /** Arquivos navegáveis com anterior/próximo (os do filtro atual). */
  files: VideoFileResponse[]
  allFiles: VideoFileResponse[]
  seasons: TmdbFilePairingSchemaSeason[]
  usedBy: Map<string, VideoFileResponse>
  onSelect: (id: number) => void
  onClose: () => void
  onSaved: () => Promise<unknown>
  lastPick: React.MutableRefObject<LastPick | null>
}) {
  const saved: Sel = isPaired(file)
    ? { season: file.tmdbPairing!.seasonNumber!, episode: file.tmdbPairing!.episodeNumber! }
    : null
  const savedStill = file.tmdbPairing?.thumbnailPath != null
  const firstReal = seasons.find((s) => (s.seasonNumber ?? 0) > 0)?.seasonNumber ?? seasons[0]?.seasonNumber ?? null

  const [sel, setSel] = useState<Sel>(saved)
  const [useStill, setUseStill] = useState(saved ? savedStill : true)
  const remembered =
    lastPick.current && seasons.some((s) => s.seasonNumber === lastPick.current!.season) ? lastPick.current : null
  const [season, setSeason] = useState<number | null>(remembered?.season ?? saved?.season ?? firstReal)
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null)

  // Depois de salvar/remover o arquivo volta com outro pareamento: realinha o rascunho.
  useEffect(() => {
    setSel(saved)
    setUseStill(saved ? savedStill : true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.tmdbPairing])

  // Ao abrir, volta à rolagem da última escolha; sem ela, rola até o episódio já pareado.
  // No frame seguinte, com o layout pronto.
  const bodyRef = useRef<HTMLDivElement>(null)
  const episodesRef = useRef<HTMLDivElement>(null)
  const offsetNow = () => (bodyRef.current?.scrollTop ?? 0) - (episodesRef.current?.offsetTop ?? 0)
  const scrolled = useRef(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (remembered && bodyRef.current && episodesRef.current)
        bodyRef.current.scrollTop = Math.max(0, episodesRef.current.offsetTop + remembered.offset)
      else episodesRef.current?.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest' })
      scrolled.current = offsetNow()
    })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Rolar depois de escolher, na mesma temporada, também conta como o ponto a voltar. A posição é
  // acompanhada no onScroll porque, no cleanup da desmontagem, os refs do DOM já foram zerados.
  const seasonRef = useRef(season)
  seasonRef.current = season
  useEffect(
    () => () => {
      if (lastPick.current?.season === seasonRef.current)
        lastPick.current = { season: seasonRef.current, offset: scrolled.current }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Esc ou clique fora fecham. Clicar noutro arquivo da lista fecha aqui e o clique da linha
  // reabre o painel nele, então trocar de arquivo continua funcionando.
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [onClose])

  const dirty =
    (sel?.season ?? null) !== (saved?.season ?? null) ||
    (sel?.episode ?? null) !== (saved?.episode ?? null) ||
    (!!sel && useStill !== savedStill && !!saved)
  const curSeason = seasons.find((s) => s.seasonNumber === season)
  const selEp = sel
    ? seasons.find((s) => s.seasonNumber === sel.season)?.episodes?.find((e) => e.episodeNumber === sel.episode)
    : undefined

  const idx = files.findIndex((f) => f.id === file.id)
  const prev = idx > 0 ? files[idx - 1] : undefined
  const next = idx >= 0 && idx < files.length - 1 ? files[idx + 1] : undefined
  // Próximo sem par depois deste (dá a volta na lista), ignorando o filtro.
  const at = allFiles.findIndex((f) => f.id === file.id)
  const nextUnpaired = [...allFiles.slice(at + 1), ...allFiles.slice(0, at)].find((f) => !isPaired(f))

  const save = async () => {
    if (!sel || !selEp) return
    setBusy('save')
    try {
      await updateTmdbFilePairing(file.id, requestFor(selEp, sel.season, useStill))
      await onSaved()
      toast.success(`${file.name} pareado com ${episodeCode(sel.season, sel.episode)}`)
      onClose()
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!file.tmdbPairing) return
    setBusy('remove')
    try {
      await deleteTmdbFilePairing(file.id)
      await onSaved()
      toast.success('Pareamento removido')
      onClose()
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <aside
      ref={panelRef}
      aria-label="Pareamento do arquivo"
      className="fixed bottom-0 right-0 top-0 z-40 flex w-[min(560px,100vw)] flex-col border-l border-line bg-panel shadow-modal"
    >
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
        <Button
          size="xs"
          icon="keyboard_arrow_up"
          iconSize={18}
          aria-label="Arquivo anterior"
          disabled={!prev}
          onClick={() => prev && onSelect(prev.id)}
        />
        <Button
          size="xs"
          icon="keyboard_arrow_down"
          iconSize={18}
          aria-label="Próximo arquivo"
          disabled={!next}
          onClick={() => next && onSelect(next.id)}
        />
        <span className="ml-1 text-sm text-muted">
          {idx + 1} de {files.length}
        </span>
        <div className="flex-1" />
        <Button size="xs" disabled={!nextUnpaired} onClick={() => nextUnpaired && onSelect(nextUnpaired.id)}>
          Próximo sem par
        </Button>
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-rs text-muted hover:bg-raised hover:text-text"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="flex flex-col gap-1 border-b border-line px-5 py-3.5">
        <span className="break-all font-mono text-13 font-semibold leading-[1.45]">{file.name}</span>
        <span className="break-all font-mono text-xs text-muted">{file.path}</span>
        {dirty && (
          <Chip tone="warn" className="mt-1 h-5 self-start text-xs">
            Alterações não salvas
          </Chip>
        )}
      </div>

      <div
        ref={bodyRef}
        onScroll={() => (scrolled.current = offsetNow())}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {sel && selEp ? (
          <div className="flex gap-3.5 border-b border-line px-5 py-3.5">
            <div className="flex w-[180px] shrink-0 flex-col gap-2">
              <Thumb
                src={useStill ? selEp.defaultStillPreviewUrl : null}
                ratio="16/9"
                rounded="rs"
                className="w-full border border-line"
                label={useStill ? 'sem still no TMDB' : 'sem thumbnail'}
              />
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={useStill} onCheckedChange={setUseStill} aria-label="Usar o still do TMDB como thumbnail" />
                Usar still do TMDB
              </label>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-13 font-bold text-accent-text">{episodeCode(sel.season, sel.episode)}</span>
                <span className="font-semibold">{selEp.name}</span>
              </div>
              <span className="text-xs text-muted">{epMeta(selEp)}</span>
              <p className="m-0 line-clamp-4 text-sm leading-[1.5]">{selEp.overview || 'Sem sinopse no TMDB.'}</p>
            </div>
          </div>
        ) : (
          <div className="border-b border-line px-5 py-3.5 text-13 text-muted">
            Arquivo sem pareamento. Escolha um episódio abaixo.
          </div>
        )}

        {/* shrink-0: com overflow-x, a coluna flex encolheria as abas até altura zero. */}
        <div
          role="tablist"
          className="sticky top-0 z-10 flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel px-3.5"
        >
          {seasons.map((s) => {
            const on = s.seasonNumber === season
            return (
              <button
                key={s.seasonNumber}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setSeason(s.seasonNumber ?? 0)}
                className={cn(
                  '-mb-px flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-3',
                  on ? 'border-accent font-semibold' : 'border-transparent font-medium text-muted hover:text-text',
                )}
              >
                {seasonLabel(s)}
                <span className="font-mono text-2xs text-muted">{s.episodes?.length ?? 0}</span>
              </button>
            )
          })}
        </div>
        <div ref={episodesRef} role="radiogroup" className="flex flex-col p-1.5">
          {(curSeason?.episodes ?? []).map((ep) => {
            const on = sel?.season === season && sel?.episode === ep.episodeNumber
            const other = usedBy.get(`${season}:${ep.episodeNumber}`)
            const showUsed = other && other.id !== file.id
            return (
              <button
                key={ep.episodeNumber}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setSel({ season: season!, episode: ep.episodeNumber! })
                  lastPick.current = { season: season!, offset: offsetNow() }
                }}
                className={cn(
                  'flex scroll-mt-12 items-center gap-3 rounded-rs px-2.5 py-2 text-left transition-colors',
                  on ? 'bg-tint' : 'hover:bg-hover',
                )}
              >
                <RadioDot checked={on} className="h-4 w-4 shrink-0" />
                <Thumb src={ep.defaultStillPreviewUrl} width={88} ratio="16/9" />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold">{episodeCode(season, ep.episodeNumber)}</span>
                    <span className="min-w-0 font-medium">{ep.name}</span>
                    {ep.episodeType && ep.episodeType !== 'standard' && (
                      <Chip tone="info" mono className="h-[18px] text-2xs">
                        {ep.episodeType}
                      </Chip>
                    )}
                  </div>
                  <span className="text-sm text-muted">{epMeta(ep)}</span>
                  {showUsed && <span className="break-all font-mono text-xs text-muted">em {other.name}</span>}
                </div>
              </button>
            )
          })}
          {!curSeason?.episodes?.length && <div className="px-2.5 py-4 text-13 text-muted">Temporada sem episódios no TMDB.</div>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
        <Button
          size="sm"
          className="mr-auto text-danger"
          disabled={!file.tmdbPairing || !saved}
          loading={busy === 'remove'}
          onClick={remove}
        >
          Remover pareamento
        </Button>
        <Button
          size="sm"
          disabled={!dirty}
          // O rascunho vive no painel: fechar já descarta (ao reabrir, volta o salvo).
          onClick={onClose}
        >
          Descartar
        </Button>
        <Button size="sm" variant="primary" disabled={!dirty || !sel} loading={busy === 'save'} onClick={save}>
          Salvar pareamento
        </Button>
      </div>
    </aside>
  )
}

const STATUS: Record<AutoPairRow['status'], { label: (r: AutoPairRow) => string; tone: Tone }> = {
  sequence: { label: () => 'sequência', tone: 'ok' },
  'new-season': { label: () => 'nova temporada', tone: 'info' },
  used: { label: (r) => `já usado por ${r.usedBy}`, tone: 'warn' },
  end: { label: () => 'fim da série', tone: 'neutral' },
}

function AutoPairPanel({
  rows,
  onClose,
  onApplied,
}: {
  rows: AutoPairRow[]
  onClose: () => void
  onApplied: () => Promise<void>
}) {
  const [checked, setChecked] = useState<Set<number>>(() => new Set(rows.filter((r) => r.selectable).map((r) => r.file.id)))
  const [applying, setApplying] = useState(false)
  const count = rows.filter((r) => checked.has(r.file.id) && r.target).length

  const apply = async () => {
    setApplying(true)
    let ok = 0
    try {
      for (const r of rows) {
        if (!checked.has(r.file.id) || !r.target) continue
        await updateTmdbFilePairing(r.file.id, requestFor(r.target.ep, r.target.season, true))
        ok++
      }
      toast.success(`${ok} ${ok === 1 ? 'arquivo pareado' : 'arquivos pareados'}`)
      await onApplied()
    } catch (e) {
      toastError(e, ok ? `${ok} pareamentos salvos antes do erro` : undefined)
      await onApplied()
    } finally {
      setApplying(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-r border border-accent bg-panel">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3.5">
        <div className="flex min-w-[260px] flex-1 flex-col gap-[3px]">
          <h3 className="m-0 text-15 font-semibold">Proposta de auto-pair</h3>
          <span className="text-sm leading-[1.45] text-muted [text-wrap:pretty]">
            Cada arquivo sem par recebe o episódio seguinte ao do arquivo anterior na mesma pasta, em ordem de nome. Ao fim de uma
            temporada, continua no E01 da próxima. Especiais (S00) não entram na sequência.
          </span>
        </div>
        <span className="text-sm text-muted">
          {rows.length} {rows.length === 1 ? 'arquivo' : 'arquivos'} na proposta · {count} marcados
        </span>
      </div>
      {rows.length === 0 && (
        <div className="px-5 py-[18px] text-13 text-muted">
          Nenhum arquivo sem par vem depois de um arquivo pareado. Pareie manualmente o primeiro episódio da sequência e tente de
          novo.
        </div>
      )}
      {rows.map((r) => {
        const st = STATUS[r.status]
        return (
          <div
            key={r.file.id}
            className={cn(
              'grid grid-cols-[28px_minmax(180px,1.3fr)_24px_minmax(200px,1.5fr)_auto] items-center gap-3 border-b border-line px-5 py-2.5',
              !r.selectable && !checked.has(r.file.id) && 'opacity-60',
            )}
          >
            <Checkbox
              aria-label={`Parear ${r.file.name}`}
              checked={checked.has(r.file.id)}
              disabled={!r.target}
              onCheckedChange={(v) =>
                setChecked((s) => {
                  const n = new Set(s)
                  if (v) n.add(r.file.id)
                  else n.delete(r.file.id)
                  return n
                })
              }
            />
            <div className="flex min-w-0 flex-col gap-px">
              <span className="truncate font-mono text-sm">{r.file.name}</span>
              <span className="truncate text-xs text-muted">depois de {r.after.name}</span>
            </div>
            <Icon name="arrow_forward" size={18} className="text-muted" />
            <div className="flex min-w-0 items-baseline gap-2">
              {r.target ? (
                <>
                  <span className="font-mono text-sm font-bold">{episodeCode(r.target.season, r.target.episode)}</span>
                  <span className="truncate">{r.target.ep.name}</span>
                </>
              ) : (
                <span className="text-muted">Não há episódio seguinte</span>
              )}
            </div>
            <Chip tone={st.tone} className="h-5 justify-self-end text-xs">
              {st.label(r)}
            </Chip>
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <span className="min-w-[200px] flex-1 text-sm text-muted">
          Os pareamentos selecionados são salvos com os dados do episódio e o still padrão do TMDB.
        </span>
        <Button size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" variant="primary" disabled={count === 0} loading={applying} onClick={apply}>
          Aplicar {count} {count === 1 ? 'pareamento' : 'pareamentos'}
        </Button>
      </div>
    </section>
  )
}
