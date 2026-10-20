import { NavLink, useMatch } from 'react-router-dom'
import { Icon } from '@/components/ui/icon'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const NAV = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  // O Item de Catálogo só é aberto a partir do Catálogo; a entrada fica ativa nas páginas do item.
  { to: '/catalogo', label: 'Catálogo', icon: 'video_library' },
  { to: '/preferencias', label: 'Preferências', icon: 'tune' },
  { to: '/cache', label: 'Cache', icon: 'memory' },
  { to: '/provedores', label: 'Provedores', icon: 'dns' },
  { to: '/ingestao', label: 'Ingestão', icon: 'download' },
  { to: '/notificacoes', label: 'Notificações', icon: 'notifications', badge: true },
] as const

export function Sidebar({ expanded, onToggle, unread }: { expanded: boolean; onToggle: () => void; unread: number }) {
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

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV.map((item) => (
          <NavItem key={item.label} item={item} expanded={expanded} unread={unread} />
        ))}
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

/*
 * O Trigger do tooltip (asChild) junta o className do filho como string: um className em função,
 * como o do NavLink, viraria o código-fonte da função. Por isso o estado ativo vem do useMatch.
 */
function NavItem({ item, expanded, unread }: { item: (typeof NAV)[number]; expanded: boolean; unread: number }) {
  const end = 'end' in item ? item.end : false
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
        {'badge' in item && expanded && unread > 0 && !on && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-accent px-1.5 text-xs font-bold text-accent-ink">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </NavLink>
    </Tooltip>
  )
}
