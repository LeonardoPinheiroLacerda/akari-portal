import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from './icon'

/** Imagem com placeholder listrado (pôsteres, stills, backdrops). */
export function Thumb({
  src,
  alt = '',
  width,
  ratio = '2/3',
  className,
  rounded = 'rxs',
  fallbackIcon,
  fit = 'cover',
  label,
}: {
  src?: string | null
  alt?: string
  width?: number | string
  ratio?: string
  className?: string
  rounded?: 'rxs' | 'rs' | 'r'
  fallbackIcon?: string
  fit?: 'cover' | 'contain'
  label?: string
}) {
  const [failed, setFailed] = useState(false)
  const show = src && !failed
  return (
    <div
      className={cn(
        'relative shrink-0 self-start overflow-hidden',
        rounded === 'rxs' ? 'rounded-rxs' : rounded === 'rs' ? 'rounded-rs' : 'rounded-r',
        !show && 'stripe',
        className,
      )}
      style={{ width, aspectRatio: ratio }}
    >
      {show ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn('h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')}
        />
      ) : (
        <>
          {fallbackIcon && (
            <span className="absolute inset-0 flex items-center justify-center text-muted">
              <Icon name={fallbackIcon} size={18} />
            </span>
          )}
          {label && <span className="absolute bottom-2 left-2 font-mono text-2xs text-muted">{label}</span>}
        </>
      )}
    </div>
  )
}
