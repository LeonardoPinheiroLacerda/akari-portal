import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Ensina ao tailwind-merge os tokens do tema (senão `text-13` e `text-accent-text` colidem).
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['2xs', '13', '15', '17', 'stat'],
      color: [
        'bg',
        'panel',
        'raised',
        'line',
        'text',
        'muted',
        'side-hover',
        'logo-bg',
        'hover',
        'code',
        'accent',
        'accent-ink',
        'accent-text',
        'tint',
        'danger',
        'overlay',
      ],
      radius: ['r', 'rs', 'rxs', 'chip'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
