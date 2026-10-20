import { cn } from '@/lib/utils'

type IconProps = {
  name: string
  size?: number
  fill?: boolean
  className?: string
  title?: string
}

/** Ícone Material Symbols Rounded. */
export function Icon({ name, size = 20, fill, className, title }: IconProps) {
  return (
    <span
      aria-hidden={title ? undefined : true}
      title={title}
      // Largura padrão = tamanho, via classe: uma classe de largura de quem usa (ex.: w-[22px]) a substitui.
      className={cn('icon w-[var(--icon-w)] shrink-0', fill && 'icon-fill', className)}
      style={{ fontSize: size, '--icon-w': `${size}px` } as React.CSSProperties}
    >
      {name}
    </span>
  )
}
