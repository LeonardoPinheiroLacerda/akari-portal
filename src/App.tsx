import { QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { queryClient } from '@/api/query'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageMetaProvider } from '@/components/layout/PageMeta'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NotificationsProvider } from '@/features/notifications/NotificationsProvider'
import { CachePage } from '@/pages/cache/CachePage'
import { CatalogPage } from '@/pages/catalog/CatalogPage'
import { HomePage } from '@/pages/home/HomePage'
import { IngestionPage } from '@/pages/ingestion/IngestionPage'
import { ItemPage } from '@/pages/item/ItemPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { PreferencesPage } from '@/pages/preferences/PreferencesPage'
import { ProvidersPage } from '@/pages/providers/ProvidersPage'

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/catalogo', element: <CatalogPage /> },
      { path: '/catalogo/:folderId', element: <Navigate to="anilist" replace /> },
      { path: '/catalogo/:folderId/:tab', element: <ItemPage /> },
      { path: '/preferencias', element: <PreferencesPage /> },
      { path: '/cache', element: <CachePage /> },
      { path: '/provedores', element: <ProvidersPage /> },
      { path: '/ingestao', element: <IngestionPage /> },
      { path: '/notificacoes', element: <NotificationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={250}>
        <PageMetaProvider>
          <NotificationsProvider>
            <RouterProvider router={router} />
          </NotificationsProvider>
        </PageMetaProvider>
        <Toaster
          // No topo: embaixo à direita ficam os botões de salvar (painel lateral, diálogos).
          position="top-center"
          toastOptions={{
            className: '!rounded-rs !border !border-line !bg-panel !text-text !font-sans',
            descriptionClassName: '!text-muted',
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
