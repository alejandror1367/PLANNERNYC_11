# ARCHITECTURE.md — Travel Planner v2

Documento técnico de cómo está construida la app. Para contexto general y reglas,
ver `CLAUDE.md`.

## Visión general

```
┌─────────────────────────────────────────────────────────┐
│  NAVEGADOR (GitHub Pages)                                 │
│                                                            │
│  index.html → app.js (bootstrap)                          │
│                 │                                          │
│      ┌──────────┼──────────┬──────────┬─────────┐         │
│      ▼          ▼          ▼          ▼         ▼         │
│   router     store      sync       theme     pwa         │
│      │          │          │                              │
│      ▼          ▼          ▼                              │
│   vistas    estado     api.js ──── POST/GET ────┐         │
│  (views/)   central                              │         │
│                                                  │         │
│   queue.js (cola offline en localStorage)        │         │
└──────────────────────────────────────────────────┼────────┘
                                                     │
                                                     ▼
                          ┌──────────────────────────────────┐
                          │  GOOGLE APPS SCRIPT (Code.gs)      │
                          │  doGet / doPost → ROUTES           │
                          │   ├─ Itinerary_*                   │
                          │   ├─ Expenses_*                    │
                          │   ├─ Settlements_*                 │
                          │   ├─ Notes_*                       │
                          │   └─ Config_*                      │
                          │            │                       │
                          │            ▼                       │
                          │      GOOGLE SHEETS (hojas)         │
                          └──────────────────────────────────┘
```

## Capa de frontend

### Bootstrap (app.js)
Orden de arranque en `init()`:
1. `theme.init()` — aplica tema claro/oscuro lo antes posible (hay además un
   script anti-parpadeo inline en el `<head>` de index.html).
2. Decide pestaña inicial según la fase del viaje: durante el viaje → `#today`,
   si no → `#overview` (solo si la URL no trae ya un hash).
3. `router.init()` — activa la navegación por hash.
4. Carga datos iniciales y `mountViews()`.
5. `sync.init()` si la config de API es válida.
6. `pwa.register()` — service worker + banner de actualización.

### Estado central (store.js)
- Mantiene `state` con: `itinerary`, `expenses`, `wishlist` (photodump),
  `exchangeRate`, `totals`, etc.
- Patrón **optimistic UI**: las mutaciones se aplican primero en local
  (con flags `_pending`, `_queued`, `_failed`), luego se confirman/encolan.
- `subscribe(fn)` — las vistas se suscriben y re-renderizan ante cambios.
- IDs temporales (`tempId`) para optimismo; el backend devuelve el id real.

### Sincronización (sync.js + queue.js + api.js)
- `api.js`: `getAll()` por GET `?action=getAll`; `callAction(action, data)` por
  POST con `Content-Type: text/plain` (para evitar preflight CORS en Apps Script).
- `queue.js`: cola de mutaciones en localStorage (`tp_pendingMutations_v1`).
  Cuando no hay red, las acciones encolables (ver `config.js`) se guardan y se
  reintenta al volver la conexión.
- `sync.js`: orquesta refresco, procesa la cola, maneja estados de sync (el
  componente `syncStatus` muestra pendiente/ok/error).

### Routing (router.js)
- Navegación por hash (`#today`, `#overview`, `#itinerary`, ...).
- Las pestañas vienen de `TABS` en `config.js`. `validTabIds` se deriva de ahí.
- `goTo(tabId)` cambia el hash; `subscribe(fn)` notifica cambios de pestaña.

### Vistas (js/views/)
Una por pestaña. Cada una:
- Tiene `mount()` / `unmount()`.
- En `mount()` se suscribe al store y hace el primer render.
- Renderiza con template strings + `setHTML()`, escapando con `escapeHtml()`.
- Usa `delegate()` para event listeners por delegación.

Vistas actuales: `today`, `overview`, `itinerary`, `budget`, `transport`,
`apps`, `notes`.

### Componentes (js/components/)
Reutilizables entre vistas: `activityModal`, `dayModal`, `confirmModal`,
`errorBanner`, `syncStatus`, `countdownHero` (boarding pass), `travelCues`,
`intensityTimeline`.

### Sistema de diseño (css/tokens.css)
- Única fuente de verdad: colores, radios, sombras, espaciado, tipografía.
- Variables semánticas (`--bg`, `--surface`, `--text`, `--border`, etc.) que
  apuntan a la paleta base.
- El modo oscuro (`[data-theme="dark"]`) SOLO redefine las variables
  semánticas. Los componentes leen variables, nunca hex directos → el tema se
  propaga a toda la app automáticamente.
- Variables `--panel-dark` / `--panel-dark-text` para paneles siempre oscuros
  (no se invierten).

## Capa de backend (Apps Script)

### Punto de entrada (Code.gs)
- `doGet(e)` y `doPost(e)` son los únicos endpoints (Apps Script Web App).
- `ROUTES` mapea cada `action` a su función handler.
- `API_VERSION` y `SCHEMA_VERSION` viven solo aquí.
- Namespace global compartido: cada `.gs` aporta funciones con prefijo de módulo.

### Módulos
- `Itinerary.gs`: días y actividades. Columnas en `ITINERARY_COLUMNS`. Maneja
  una columna opcional `location` (la crea si no existe).
- `Expenses.gs`: gastos. Quién pagó, monto, categoría, ciudad, día.
- `Settlements.gs`: liquidación de saldos entre Alejo y Ana.
- `Notes.gs`: notas, photodump (wishlist como JSON).
- `Config.gs`: tasa de cambio y configuración.
- `Validators.gs`: sanitiza y valida entradas (longitudes máximas, tipos).
- `Sheets.gs`: helpers de acceso a hojas.
- `Response.gs`: respuestas JSON normalizadas `{ ok, data }` / `{ ok:false, error }`.
- `Setup.gs` / `Seed.gs` / `Migrate.gs`: creación de hojas, datos iniciales,
  migraciones de esquema.

### Persistencia (Google Sheets)
- Una hoja por dominio (Itinerary, Expenses, Settlements, Notes, Config).
- El esquema se versiona con `SCHEMA_VERSION`. `Migrate.gs` adapta hojas viejas.
- Solo guarda TEXTO/números. No archivos (relevante para la futura bóveda de
  documentos: se guardan links, no archivos).

## Service worker (sw.js)
- Estrategia cache-first para assets estáticos; stale-while-revalidate para
  cross-origin (ej. Open-Meteo).
- `CACHE_VERSION` (timestamp) invalida el caché viejo en cada release.
- `PRECACHE_ASSETS`: lista de archivos a cachear. Añadir aquí los archivos nuevos.
- `sw-uninstall.html`: kill switch que limpia caché y service workers (rescate
  para la PWA instalada en iOS cuando se queda con versión vieja).

## Decisiones de diseño relevantes
- Sin frameworks ni build: simplicidad, cero toolchain, despliegue directo.
- Optimistic UI + cola offline: la app se siente instantánea y funciona sin red.
- Tokens como única fuente de estilo: permitió el rediseño global y el modo
  oscuro cambiando pocas variables.
- Clima y mapas sin API keys: Open-Meteo (gratis) y URLs públicas de Google Maps.
- Dashboard "Hoy" reusa datos existentes (itinerario, clima, gastos): cero
  backend nuevo.
