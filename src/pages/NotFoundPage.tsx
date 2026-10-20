import { Link } from 'react-router-dom'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/states'

export function NotFoundPage() {
  usePageMeta('Página não encontrada')
  return (
    <EmptyState
      dashed
      icon="explore_off"
      title="Esta página não existe"
      description="O endereço pode ter mudado. Volte para a visão geral e siga pelo menu."
      action={
        <Button asChild variant="primary">
          <Link to="/">Ir para a Home</Link>
        </Button>
      }
    />
  )
}
