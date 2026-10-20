# src/pages/home

Tela **Home** (`/`, "Visão geral"): resumo do estado do sistema e atalhos para o que precisa de
ação. A pasta `src/pages` também guarda o [`NotFoundPage.tsx`](../NotFoundPage.tsx), a página de
rota inexistente com o botão de voltar à Home.

| Arquivo                        | Papel                                                                       |
| ------------------------------ | --------------------------------------------------------------------------- |
| [`HomePage.tsx`](HomePage.tsx) | Cartões de resumo, notificações recentes e títulos que precisam de atenção. |

## Cartões de resumo

| Cartão                 | Valor                                                       | Detalhe                                           |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| Pastas no catálogo     | total de pastas (`totalElements` da listagem)               | quantas têm anime vinculado (filtro `hasAnilist`) |
| Downloads pendentes    | baixando + na fila + com falha                              | a soma de cada estado                             |
| Notificações não lidas | contador de não lidas do provider de notificações           | quantos erros não lidos                           |
| Provedores conectados  | conectados / cadastrados, pelo último teste deste navegador | sem conexão e sem teste                           |

- As contagens vêm do `totalElements` de listagens de 1 linha com o filtro certo, sem contar no
  portal.
- Os erros não lidos são contados entre as 50 notificações mais recentes, não sobre todas.

## Notificações recentes

As 4 notificações mais recentes (lidas ou não), com o nível, o título, a mensagem e há quanto
tempo, e o atalho "Ver todas". A lista é refeita quando chega uma notificação nova pelo stream.

## Títulos que precisam de atenção

Os títulos pendentes de curadoria, pelo status de revisão do catálogo: os 5 mais recentes, primeiro
os "Parciais" e depois os "Aguardando revisão" (filtro `reviewStatus`, ordenado por data de
criação). O subtítulo mostra quantos há de cada, e os atalhos abrem o Catálogo já filtrado
(`/catalogo?reviewStatus=PARTIAL` ou `PENDING_REVIEW`). Clicar num título abre a aba AniList do
item.

## Observações

- **Janela de 50 notificações.** A contagem de erros não lidos olha só as 50 notificações mais
  recentes; depois de uma ingestão grande, erros mais antigos ficam de fora. **Aceito** (confirmado
  pelo mantenedor): na Home, as mais recentes são as que importam.
