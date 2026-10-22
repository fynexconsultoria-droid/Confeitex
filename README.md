# Confeitex

PWA de gestão para confeitarias: pedidos, clientes, finanças, catálogo e suporte com IA.
Funciona 100% offline (Service Worker + IndexedDB) e é publicado via GitHub Pages.

## Estrutura

```
Confeitex/
├── index.html            # Landing page (usa css/landing.css + js/landing.js)
├── app.html              # Aplicativo (usa style.css + js/app.js)
├── privacidade.html      # Política de privacidade
├── termos.html           # Termos de uso
├── style.css             # Ponto de entrada do CSS do app (@import dos módulos em css/)
├── sw.js                 # Service Worker (cache offline; SW_VERSION controla o cache)
├── manifest.json         # Manifesto PWA
├── version.txt           # Versão atual (lida pelo app para detectar atualizações)
│
├── css/                  # Estilos por módulo
│   ├── variables.css     # Tokens de design (cores, espaçamentos)
│   ├── base.css, layout.css, components.css
│   ├── dashboard.css, modals.css, onboarding.css, plans.css
│   ├── mercadopago.css, ai-support.css, mobile-app.css
│   └── landing.css       # Exclusivo da landing page
│
├── js/                   # Módulos ES (entrada: app.js)
│   ├── app.js            # Bootstrap e navegação
│   ├── state.js          # Estado global + persistência
│   ├── utils.js          # Formatadores, safeStorage, AppDB, CryptoUtils
│   ├── logger.js, ui.js, i18n.js, pwa.js, updates.js, pull-to-refresh.js
│   ├── auth.js, plan.js, onboarding.js, mercadopago.js
│   ├── dashboard.js, chart.js, orders.js, clients.js, finances.js
│   ├── notifications.js, settings.js, trash.js, aiSupport.js
│   └── landing.js        # Exclusivo da landing page
│
├── api/
│   └── cloudflare-worker.js  # Backend: pagamentos Mercado Pago + licenças
├── vendor/               # pdf.js (carregado sob demanda na importação de PDF)
├── icons/                # Ícones do PWA
├── tests/                # Testes (Vitest)
├── build.js              # Gera dist/ minificado (esbuild)
└── push.ps1              # Bump de versão + build + testes + commit/push
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm install` | Instala dependências de desenvolvimento |
| `npm test` | Roda os testes (Vitest) |
| `npm run build` | Gera `dist/` minificado (não versionado) |
| `.\push.ps1 "mensagem"` | Incrementa versão, invalida cache do SW, builda, testa e faz push |

> Ao adicionar/remover um arquivo em `js/` ou `css/`, atualize também a lista
> `ASSETS_TO_CACHE` em `sw.js` para manter o funcionamento offline.

## Deploy do backend (Cloudflare Worker)

1. Crie um Worker em [workers.cloudflare.com](https://workers.cloudflare.com).
2. Cole o código de `api/cloudflare-worker.js`.
3. Crie um KV Namespace e vincule ao Worker com o binding `CONFEITEX_KV`.
4. Defina as variáveis/secrets:
   - `MP_ACCESS_TOKEN` — token de produção do Mercado Pago
   - `ALLOWED_ORIGIN` — URL do app (ou `*` para testes)
   - `MAX_DEVICES_PER_KEY` — opcional, padrão `2`
5. Use a URL do Worker em **Configurações › Mercado Pago** no app.
