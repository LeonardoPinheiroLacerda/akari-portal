import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui/icon'
import { useNotificationsLive } from '@/features/notifications/NotificationsProvider'
import { notificationHead } from '@/features/notifications/level'
import { usePersistentState, useTheme } from '@/lib/storage'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [expanded, setExpanded] = usePersistentState('akari.sidebarExpanded', true)
  const { theme, toggle } = useTheme()
  const { unread, banner, dismissBanner } = useNotificationsLive()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex h-screen min-h-[560px] overflow-hidden bg-bg text-base text-text">
      <Sidebar expanded={expanded} onToggle={() => setExpanded(!expanded)} unread={unread} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header theme={theme} onToggleTheme={toggle} unread={unread} />
        <main className="flex-1 overflow-y-auto px-8 pb-16 pt-7 max-md:px-4">
          <div className="mx-auto flex max-w-content flex-col gap-6">
            {banner && (
              <button
                type="button"
                onClick={() => {
                  dismissBanner()
                  navigate('/notificacoes')
                }}
                className="flex items-center gap-3 rounded-r border border-accent bg-tint px-4 py-3 text-left"
              >
                <Icon name="notifications_active" size={20} className="text-accent" />
                <span className="min-w-0 flex-1 truncate text-13">
                  <b>Nova notificação</b> · {banner.title ? `${notificationHead(banner)}: ` : ''}
                  {banner.message}
                </span>
                <span className="text-sm text-muted">agora</span>
              </button>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
