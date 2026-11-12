import { NavLink, useMatch } from 'react-router-dom'
import { Icon } from '@/components/ui/icon'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type NavEntry = { to: string; label: string; icon: string; end?: boolean }

/** Grupos do menu, na ordem em que aparecem; o de configuração fica fixo no rodapé. */
const NAV_GROUPS: { title?: string; items: NavEntry[] }[] = [
  { items: [{ to: '/', label: 'Visão geral', icon: 'home', end: true }] },
  {
    title: 'Biblioteca',
    items: [
      // O Item de Catálogo só é aberto a partir do Catálogo; a entrada fica ativa nas páginas do item.
      { to: '/catalogo', label: 'Catálogo', icon: 'video_library' },
      { to: '/franquias', label: 'Franquias', icon: 'account_tree' },
      { to: '/listas', label: 'Listas', icon: 'featured_play_list' },
    ],
  },
  {
    title: 'Atividade',
    items: [
      { to: '/ingestao', label: 'Ingestão', icon: 'download' },
      { to: '/cache', label: 'Cache', icon: 'memory' },
    ],
  },
]

const SETTINGS_GROUP = {
  title: 'Configuração',
  items: [
    { to: '/provedores', label: 'Provedores', icon: 'dns' },
    { to: '/preferencias', label: 'Preferências', icon: 'tune' },
  ] as NavEntry[],
}

export function Sidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <aside
      className="flex shrink-0 flex-col overflow-hidden border-r border-line bg-panel transition-[width] duration-[220ms] ease-in-out"
      style={{ width: expanded ? 248 : 68 }}
    >
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-rs bg-logo-bg">
          <img src="/logo.svg" alt="Akari" className="block h-[30px] w-[30px]" />
        </div>
        {expanded && (
          <div className="flex flex-col whitespace-nowrap leading-[1.1]">
            <span className="text-17 font-bold tracking-[-.01em]">Akari</span>
            <span className="font-mono text-xs uppercase tracking-[.08em] text-muted">Admin</span>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto p-3" aria-label="Menu principal">
        {NAV_GROUPS.map((g, i) => (
          <NavGroup key={g.title ?? i} title={g.title} first={i === 0} expanded={expanded}>
            {g.items.map((item) => (
              <NavItem key={item.to} item={item} expanded={expanded} />
            ))}
          </NavGroup>
        ))}
      </nav>

      <nav className="flex flex-col border-t border-line px-3 pb-1 pt-1" aria-label={SETTINGS_GROUP.title}>
        <NavGroup title={SETTINGS_GROUP.title} first expanded={expanded}>
          {SETTINGS_GROUP.items.map((item) => (
            <NavItem key={item.to} item={item} expanded={expanded} />
          ))}
        </NavGroup>
      </nav>

      <div className="border-t border-line p-3">
        <Tooltip content="Expandir menu" side="right" disabled={expanded}>
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'flex h-10 w-full items-center gap-3 whitespace-nowrap rounded-rs text-muted transition-colors hover:bg-side-hover',
              expanded ? 'px-3' : 'px-[11px]',
            )}
          >
            <Icon name={expanded ? 'left_panel_close' : 'left_panel_open'} size={21} className="w-[22px]" />
            {expanded && <span>Recolher menu</span>}
          </button>
        </Tooltip>
      </div>
    </aside>
  )
}

/**
 * Bloco de itens do menu. Expandido, mostra o título do grupo; recolhido, uma linha separa os
 * grupos, já que não cabe texto.
 */
function NavGroup({
  title,
  first,
  expanded,
  children,
}: {
  title?: string
  first?: boolean
  expanded: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1', !first && 'mt-3')}>
      {title &&
        (expanded ? (
          <span className="px-3 pb-1 pt-2 font-mono text-xs uppercase tracking-[.08em] text-muted">{title}</span>
        ) : (
          !first && <span role="separator" className="mx-2.5 mb-2 border-t border-line" />
        ))}
      {children}
    </div>
  )
}

/*
 * O Trigger do tooltip (asChild) junta o className do filho como string: um className em função,
 * como o do NavLink, viraria o código-fonte da função. Por isso o estado ativo vem do useMatch.
 */
function NavItem({ item, expanded }: { item: NavEntry; expanded: boolean }) {
  const end = item.end ?? false
  const on = useMatch({ path: item.to, end }) != null
  return (
    <Tooltip content={item.label} side="right" disabled={expanded}>
      <NavLink
        to={item.to}
        end={end}
        aria-label={item.label}
        className={cn(
          'relative flex h-[42px] shrink-0 items-center gap-3 whitespace-nowrap rounded-rs text-left transition-colors',
          expanded ? 'px-3' : 'px-[11px]',
          on ? 'bg-accent font-semibold text-accent-ink' : 'font-medium text-muted hover:bg-side-hover hover:text-text',
        )}
      >
        <Icon name={item.icon} size={21} fill={on} className="w-[22px] text-center" />
        {expanded && <span className="flex-1 truncate">{item.label}</span>}
      </NavLink>
    </Tooltip>
  )
}
