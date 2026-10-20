import type { NotificationResponse } from '@/api/generated/model'
import { Icon } from '@/components/ui/icon'
import { Thumb } from '@/components/ui/thumb'
import { LEVEL } from '@/features/notifications/level'

const SOLID = { INFO: 'var(--info-solid)', WARNING: 'var(--warn-solid)', ERROR: 'var(--err-solid)' } as const

/** Capa com badge de nível no canto, ou só o ícone do nível quando não é sobre um título. */
export function NotificationAvatar({ n, size = 36 }: { n: NotificationResponse; size?: number }) {
  const level = LEVEL[n.level]
  if (!n.coverImageUrl && !n.folderId) {
    return (
      <span
        className="flex shrink-0 items-center justify-center self-start rounded-rs"
        style={{ width: size, height: size, background: `var(--${level.tone}-bg)`, color: `var(--${level.tone}-fg)` }}
      >
        <Icon name={level.icon} size={20} />
      </span>
    )
  }
  return (
    <div className="relative shrink-0 self-start" style={{ width: size }}>
      <Thumb src={n.coverImageUrl} width={size} ratio="2/3" />
      <span
        className="absolute -bottom-1 -right-1.5 flex items-center justify-center rounded-full border-2 border-panel text-white"
        style={{ width: size > 34 ? 20 : 18, height: size > 34 ? 20 : 18, background: SOLID[n.level] }}
      >
        <Icon name={level.icon} size={size > 34 ? 12 : 11} />
      </span>
    </div>
  )
}
