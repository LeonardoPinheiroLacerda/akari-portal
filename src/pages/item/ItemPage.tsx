import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useMarkAnimeAsReviewed } from '@/api/generated/endpoints/anime/anime'
import { useListVideoFiles } from '@/api/generated/endpoints/video-file/video-file'
import type { AnimeResponse } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { Tooltip } from '@/components/ui/tooltip'
import { reviewInfo } from '@/features/item/labels'
import { useItem } from '@/features/item/useItem'
import { cn } from '@/lib/utils'
import { AnilistTab } from './AnilistTab'
import { OverridesTab } from './OverridesTab'
import { PairingTab } from './PairingTab'
import { PlaybackTab } from './PlaybackTab'
import { TmdbTab } from './TmdbTab'

export const ITEM_TABS = [
  { key: 'anilist', label: 'AniList' },
  { key: 'tmdb', label: 'TMDB' },
  { key: 'overrides', label: 'TMDB Overrides' },
  { key: 'pareamento', label: 'TMDB Episódio Pair' },
  { key: 'reproducao', label: 'Reprodução' },
] as const
export type ItemTab = (typeof ITEM_TABS)[number]['key']

type Lock = { need: ItemTab; title: string; body: string; cta: string }

const OVERRIDE_KEYS = ['title', 'synopsis', 'posterPath', 'backdropPath', 'logoPath'] as const

export function ItemPage() {
  const params = useParams()
  const folderId = Number(params.folderId)
  const tab = (ITEM_TABS.some((t) => t.key === params.tab) ? params.tab : 'anilist') as ItemTab
  const navigate = useNavigate()
  const item = useItem(folderId)
  const { folder, anime, tmdb } = item
  const files = useListVideoFiles({ folderId, size: 1000 })

  const title = anime.data?.titles?.main ?? folder.data?.name ?? 'Item'
  usePageMeta('Item de Catálogo', `Catálogo / ${title}`)

  if (folder.isLoading || anime.isLoading) return <Loading />
  if (folder.isError) return <ErrorState error={folder.error} onRetry={() => folder.refetch()} />

  const alOk = item.hasAnime
  const tmOk = alOk && item.hasTmdb
  const tvOk = tmOk && item.isTv

  const LOCK: Record<ItemTab, Lock | null> = {
    anilist: null,
    tmdb: alOk
      ? null
      : {
          need: 'anilist',
          title: 'Vincule um anime da AniList primeiro',
          body: 'O vínculo com o TMDB é feito a partir do anime da AniList. Sem ele, não há o que vincular.',
          cta: 'Ir para AniList',
        },
    overrides: !alOk
      ? {
          need: 'anilist',
          title: 'Vincule um anime da AniList primeiro',
          body: 'Overrides dependem do vínculo com a AniList e depois com o TMDB.',
          cta: 'Ir para AniList',
        }
      : !tmOk
        ? {
            need: 'tmdb',
            title: 'Vincule ao TMDB primeiro',
            body: 'As opções de título, sinopse e imagens vêm do TMDB. Vincule uma série ou filme para editar os overrides.',
            cta: 'Ir para TMDB',
          }
        : null,
    pareamento: !alOk
      ? {
          need: 'anilist',
          title: 'Vincule um anime da AniList primeiro',
          body: 'O pareamento de episódios depende do vínculo com a AniList e com uma série do TMDB.',
          cta: 'Ir para AniList',
        }
      : !tmOk
        ? {
            need: 'tmdb',
            title: 'Vincule ao TMDB primeiro',
            body: 'Os episódios para parear vêm da série vinculada no TMDB.',
            cta: 'Ir para TMDB',
          }
        : !tvOk
          ? {
              need: 'tmdb',
              title: 'Disponível só para séries',
              body: 'O vínculo atual é de um filme. Filmes não têm temporadas nem episódios para parear.',
              cta: 'Ver vínculo TMDB',
            }
          : null,
    reproducao: null,
  }

  const overrides = tmdb.data?.overrides
  const DONE: Record<ItemTab, boolean> = {
    anilist: alOk,
    tmdb: tmOk,
    overrides: tmOk && OVERRIDE_KEYS.some((k) => overrides?.[k] != null),
    pareamento: tvOk && (files.data?.data.some((f) => f.tmdbPairing?.episodeNumber != null) ?? false),
    reproducao: false,
  }

  const go = (t: ItemTab) => navigate(`/catalogo/${folderId}/${t}`)
  const lock = LOCK[tab]
  const a = anime.data
  const ov = tmdb.data?.overrides

  return (
    <>
      {/* Header montado com os overrides do TMDB (pôster, backdrop, logo); sem override, cai no pôster da AniList e no título em texto. */}
      <div className="relative overflow-hidden rounded-r border border-line bg-panel">
        {ov?.backdropPreviewUrl && (
          <>
            <img src={ov.backdropPreviewUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_25%]" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, var(--panel) 0%, color-mix(in oklch, var(--panel) 88%, transparent) 38%, color-mix(in oklch, var(--panel) 35%, transparent) 75%, transparent 100%), linear-gradient(0deg, color-mix(in oklch, var(--panel) 70%, transparent) 0%, transparent 45%)',
              }}
            />
          </>
        )}
        <div className="relative flex flex-wrap items-end gap-6 p-5">
          <Thumb
            src={ov?.posterPreviewUrl ?? a?.thumbnails?.large ?? a?.thumbnails?.medium}
            width={112}
            ratio="2/3"
            rounded="rs"
            className="border border-line shadow-modal"
            label={a ? undefined : 'pôster'}
          />
          <div className="flex min-w-[260px] flex-1 flex-col gap-2">
            {a ? (
              <ReviewStatus anime={a} />
            ) : (
              <Chip tone="warn" className="self-start">
                Sem anime vinculado
              </Chip>
            )}
            {ov?.logoPreviewUrl ? (
              <h1 className="m-0">
                <img
                  src={ov.logoPreviewUrl}
                  alt={title}
                  title={title}
                  className="block max-h-[84px] max-w-[min(360px,100%)] object-contain object-left drop-shadow"
                />
              </h1>
            ) : (
              <h1 className="m-0 text-3xl font-semibold tracking-[-.01em]">{title}</h1>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-13 text-muted">
              {a ? (
                <>
                  {a.titles?.english && <span>{a.titles.english}</span>}
                  <span className="font-mono">AniList {a.anilistId}</span>
                  <span className="font-mono">TMDB {tmdb.data?.tmdbId ?? '—'}</span>
                  {a.episodes != null && <span>{a.episodes} episódios</span>}
                </>
              ) : (
                <span className="font-mono">{folder.data?.path}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div role="tablist" className="-mb-2 flex gap-1 overflow-x-auto border-b border-line">
        {ITEM_TABS.map((t) => {
          const lk = LOCK[t.key]
          const on = t.key === tab
          const done = DONE[t.key]
          return (
            <Tooltip key={t.key} content={lk?.title} disabled={!lk}>
              <button
                type="button"
                role="tab"
                aria-selected={on}
                aria-disabled={!!lk}
                onClick={() => !lk && go(t.key)}
                className={cn(
                  '-mb-px flex h-[42px] items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 transition-colors',
                  on ? 'border-accent font-semibold text-text' : 'border-transparent font-medium text-muted',
                  lk ? 'cursor-not-allowed opacity-50' : 'hover:text-text',
                )}
              >
                <Icon
                  name={lk ? 'lock' : done ? 'check_circle' : 'radio_button_unchecked'}
                  size={16}
                  fill
                  className={done && !lk ? 'text-[var(--ok-fg)]' : 'text-muted'}
                />
                {t.label}
              </button>
            </Tooltip>
          )
        })}
      </div>

      {lock ? (
        <section className="flex flex-wrap items-center gap-4 rounded-r border border-dashed border-line bg-panel px-6 py-7">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised text-muted">
            <Icon name="lock" size={22} />
          </span>
          <div className="flex min-w-[240px] flex-1 flex-col gap-1">
            <span className="font-semibold">{lock.title}</span>
            <span className="text-13 leading-normal text-muted">{lock.body}</span>
          </div>
          <Button variant="primary" onClick={() => go(lock.need)}>
            {lock.cta}
          </Button>
        </section>
      ) : (
        <>
          {tab === 'anilist' && <AnilistTab item={item} folderId={folderId} />}
          {tab === 'tmdb' && <TmdbTab item={item} onGo={go} />}
          {tab === 'overrides' && <OverridesTab item={item} />}
          {tab === 'pareamento' && <PairingTab item={item} folderId={folderId} />}
          {tab === 'reproducao' && <PlaybackTab item={item} folderId={folderId} />}
        </>
      )}
    </>
  )
}

/** Status de revisão no cabeçalho do item: visível e acionável em todas as abas da curadoria. */
function ReviewStatus({ anime: a }: { anime: AnimeResponse }) {
  const review = useMarkAnimeAsReviewed()
  const r = reviewInfo(a.reviewStatus)
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <Chip tone={r.tone}>{r.label}</Chip>
      {a.reviewStatus !== 'REVIEWED' && (
        <Button
          size="xs"
          icon="task_alt"
          iconSize={16}
          loading={review.isPending}
          onClick={() =>
            review.mutate(
              { anilistId: a.anilistId },
              {
                onSuccess: async () => {
                  await invalidate.anime(a.anilistId)
                  toast.success('Título marcado como revisado')
                },
                onError: (e) => toastError(e),
              },
            )
          }
        >
          Marcar como revisado
        </Button>
      )}
    </div>
  )
}
