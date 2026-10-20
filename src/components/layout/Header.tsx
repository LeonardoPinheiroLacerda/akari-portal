import { useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui/icon'
import { Tooltip } from '@/components/ui/tooltip'
import type { Theme } from '@/lib/storage'
import { usePageMetaValue } from './PageMeta'

export function Header({ theme, onToggleTheme, unread }: { theme: Theme; onToggleTheme: () => void; unread: number }) {
  const { crumb, title } = usePageMetaValue()
  const navigate = useNavigate()

  const iconBtn =
    'relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-rs border border-line bg-panel text-text transition-colors hover:bg-raised'

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-bg px-7">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-mono text-xs uppercase tracking-[.08em] text-muted">{crumb}</span>
        <span className="truncate text-lg font-semibold">{title}</span>
      </div>

      <Tooltip content="Alternar tema">
        <button type="button" onClick={onToggleTheme} className={iconBtn} aria-label="Alternar tema">
          <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={20} />
        </button>
      </Tooltip>

      <Tooltip content="Notificações">
        <button type="button" onClick={() => navigate('/notificacoes')} className={iconBtn} aria-label="Notificações">
          <Icon name="notifications" size={20} />
          {unread > 0 && (
            <span className="absolute -right-[5px] -top-[5px] flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-accent px-[5px] text-2xs font-bold text-accent-ink">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </Tooltip>
    </header>
  )
}
