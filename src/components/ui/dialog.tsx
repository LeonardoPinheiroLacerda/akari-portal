import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { Icon } from './icon'

export const Dialog = DialogPrimitive.Root

export function DialogContent({
  className,
  children,
  title,
  description,
  width = 560,
}: {
  className?: string
  children: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  width?: number
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="data-[state=open]:animate-in fixed inset-0 z-40 bg-overlay" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[min(720px,calc(100vh-32px))] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-r border border-line bg-panel text-text shadow-modal outline-none',
          className,
        )}
        style={{ maxWidth: width }}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <DialogPrimitive.Title className="text-17 font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="flex h-8 w-8 items-center justify-center rounded-rs text-muted hover:bg-raised hover:text-text"
            aria-label="Fechar"
          >
            <Icon name="close" size={20} />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
