import { createContext, useContext, useEffect, useState } from 'react'

type Meta = { crumb: string; title: string }
const Ctx = createContext<{ meta: Meta; setMeta: (m: Meta) => void } | null>(null)

export function PageMetaProvider({ children }: { children: React.ReactNode }) {
  const [meta, setMeta] = useState<Meta>({ crumb: 'Akari admin', title: '' })
  return <Ctx.Provider value={{ meta, setMeta }}>{children}</Ctx.Provider>
}

export function usePageMetaValue() {
  return useContext(Ctx)!.meta
}

/** Define o breadcrumb e o título exibidos no header. */
export function usePageMeta(title: string, crumb = 'Akari admin') {
  const { setMeta } = useContext(Ctx)!
  useEffect(() => {
    setMeta({ title, crumb })
    document.title = title ? `${title} · Akari` : 'Akari · Admin'
  }, [title, crumb, setMeta])
}
