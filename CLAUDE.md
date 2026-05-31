# CLAUDE.md — Travel Planner v2

> Este archivo lo lee Claude Code automáticamente al iniciar. Contiene el
> contexto del proyecto y las reglas que SIEMPRE deben respetarse.

## Qué es este proyecto

App web personal de planificación de viaje para **Alejo y Ana**, un viaje a
**NYC + Boston del 3 al 15 de octubre de 2026** (13 días). Es una app privada,
LGBT-friendly, de uso personal para dos personas. NO es un producto comercial.

La app funciona como un "dossier de viaje" con estética editorial premium:
itinerario editable, presupuesto compartido con liquidación de saldos, guías de
transporte, apps útiles, contactos de emergencia, notas/photodump, mapas, clima
en vivo, un dashboard "Hoy" (copiloto durante el viaje), modo oscuro y
exportación a PDF.

## Stack (NO cambiar sin pedir)

- **Frontend**: HTML + CSS + JavaScript vanilla con ES Modules. SIN frameworks
  (nada de React/Vue/Angular), SIN TypeScript, SIN build step, SIN dependencias
  npm en runtime. Todo corre directo en el navegador.
- **Backend**: Google Apps Script (archivos `.gs` en `backend/`).
- **Base de datos**: Google Sheets (el backend lee/escribe ahí).
- **Hosting**: GitHub Pages (sitio estático).
- **PWA**: instalable, offline-first con service worker.

## Estructura del repo

```
index.html              Punto de entrada. Tabs + paneles vacíos que llenan las vistas.
manifest.json           PWA manifest.
sw.js                   Service worker (cache-first). OJO: ver regla de CACHE_VERSION.
sw-uninstall.html       Kill switch para limpiar caché terco (útil en iOS).
css/
  tokens.css            ÚNICA fuente de verdad de colores, radios, sombras, tipografía.
                        Incluye el bloque [data-theme="dark"] del modo oscuro.
  base.css              Reset y estilos base del body.
  layout.css            Header, tabs, paneles, grid.
  components.css        Cards, botones, inputs, chips, weather-strip, hack, etc.
  views.css             Estilos específicos de cada vista (itinerario, transporte,
                        boarding pass, dashboard Hoy, etc.).
  budget.css            Estilos de la vista de presupuesto.
  responsive.css        Media queries.
  motion.css            Animaciones y transiciones.
js/
  config.js             API_URL, TRIP (fechas), TABS, DEFAULT_TAB, acciones encolables.
  app.js                Bootstrap: inicializa tema, router, vistas, sync, PWA.
  api.js                Llamadas al backend (GET getAll, POST callAction).
  store.js              Estado central + optimistic UI + suscripciones.
  sync.js               Sincronización con el backend.
  queue.js              Cola de mutaciones offline (localStorage).
  router.js             Router por hash (#today, #overview, etc.).
  storage.js            Wrappers de localStorage.
  dom.js                Helpers DOM ($, on, delegate, setHTML, escapeHtml).
  format.js             Formateo de fechas, moneda, etc.
  toast.js              Notificaciones toast.
  trip.js               Lógica del viaje: fases (pre/during/post), día actual, contador.
  charts.js             Gráficos del presupuesto.
  budget.js             Cálculos de presupuesto, insights, agrupaciones.
  data.js               Carga de data/*.json.
  maps.js               URLs de Google Maps + mini-mapa SVG del día.
  weather.js            Clima en vivo (Open-Meteo, sin API key).
  theme.js              Modo claro/oscuro (toggle, persistencia, sistema).
  exportPdf.js          Genera el dossier imprimible (window.print).
  pwa.js                Registro del service worker + banner de actualización.
  components/           Componentes reutilizables (modales, hero, cues, etc.).
  views/                Una vista por pestaña: today, overview, itinerary, budget,
                        transport, apps, notes.
data/
  transport.json        Datos de transporte (data-driven).
  apps.json             Apps útiles.
  emergency.json        Contactos de emergencia.
backend/
  Code.gs               ÚNICO archivo con doGet/doPost/ROUTES/API_VERSION/SCHEMA_VERSION.
  Response.gs           Respuestas JSON normalizadas.
  Sheets.gs             Acceso a las hojas.
  Validators.gs         Validación de datos de entrada.
  Expenses.gs           CRUD de gastos.
  Itinerary.gs          CRUD de itinerario y actividades.
  Notes.gs              Notas / photodump / wishlist.
  Settlements.gs        Liquidación de saldos entre Alejo y Ana.
  Config.gs             Tasa de cambio y config.
  Setup.gs              setupSheets (crea las hojas).
  Seed.gs               Datos iniciales del viaje.
  Migrate.gs            Migraciones de esquema.
```

## REGLAS CRÍTICAS (romperlas causa bugs difíciles)

### 1. Service worker — bumpear CACHE_VERSION SIEMPRE
Cada vez que se modifique CUALQUIER archivo de frontend (html/css/js), hay que
subir la versión del cache en `sw.js`:
- La constante es `const CACHE_VERSION = 'tpYYYYMMDD-HHMMSS';`
- Usar un timestamp nuevo cada vez (ej. `tp20260531-143000`).
- Si el archivo es nuevo, además añadirlo al array `PRECACHE_ASSETS`.
Sin esto, los usuarios (sobre todo la PWA instalada en iOS) siguen viendo la
versión vieja en caché.

### 2. Backend Apps Script — namespace global compartido
TODOS los archivos `.gs` comparten el mismo namespace global. Por eso:
- SOLO `Code.gs` define `doGet`, `doPost`, `ROUTES`, `API_VERSION`, `SCHEMA_VERSION`.
- Cada otro `.gs` solo define SUS funciones, con prefijo por módulo
  (`Itinerary_*`, `Validators_*`, `Expenses_*`, etc.).
- Nunca duplicar `doGet`/`doPost` ni constantes globales en otro archivo.

### 3. El estilo vive en los TOKENS
No hardcodear colores hex en componentes. Usar las variables de `tokens.css`
(`--text`, `--surface`, `--color-accent`, etc.). Esto es lo que hace que el
modo oscuro funcione: el bloque `[data-theme="dark"]` redefine los tokens y
todo se adapta solo. Si se hardcodea un color, romperá en modo oscuro.
- Para paneles SIEMPRE oscuros (boarding pass, header del día), usar
  `--panel-dark` y `--panel-dark-text`, que NO se invierten.
- Patrón prohibido: `background: var(--text)` con `color: var(--text-on-dark)`
  → en oscuro queda claro sobre claro (ilegible). Usar `--color-accent` o
  `color: var(--bg)` para el texto en hover.

### 4. Optimistic UI + cola offline
Las mutaciones (addExpense, addActivity, updateDay, etc.) se aplican primero al
estado local (optimistic) y se encolan si no hay red. Las acciones encolables
están en `config.js` (`enqueueableActions`). Al añadir una mutación nueva,
registrarla ahí y mantener el patrón optimista.

### 5. Mantener arquitectura modular
- Una vista por pestaña en `js/views/`.
- Componentes reutilizables en `js/components/`.
- No mezclar lógica de negocio en las vistas; usar `store.js`, `budget.js`,
  `trip.js`, etc.
- Las vistas se suscriben al store y re-renderizan ante cambios.

## Datos clave del viaje (config.js → TRIP)

- `startDate`: 2026-10-03T18:17:00-05:00
- `endDate`: 2026-10-15T12:51:00-05:00
- 13 días. NYC (días 1-7 aprox) + Boston.
- `defaultExchangeRate`: 3667 (COP por USD).
- Avatares: 👨 Alejo / 👧 Ana.

## Paleta (identidad visual)

- Crema/papel: `#f4ede1`
- Naranja (acento principal): `#ff4d2e`
- Amarillo (acento secundario): `#ffd84d`
- Tinta (texto/oscuro): `#1a1815`
- Azul Boston: `#2d6a8f`
- Fuentes: Bebas Neue (display), Fraunces (serif), JetBrains Mono (mono).
- Modo oscuro: fondo tinta cálida (no negro puro), acentos intactos.

## Flujo de despliegue

**Frontend** (cambios en html/css/js):
1. Bumpear `CACHE_VERSION` en `sw.js`.
2. `git add` + `commit` + `push` a GitHub.
3. GitHub Pages publica solo. El usuario ve un banner verde "Nueva versión" y
   toca Actualizar. En la PWA de iOS a veces hay que cerrar la app del
   multitarea y reabrir, o usar sw-uninstall.html.

**Backend** (cambios en `.gs`):
1. Pegar el/los archivo(s) en el editor de Apps Script (script.google.com).
2. Guardar (Ctrl+S).
3. Implementar → Gestionar implementaciones → ✏️ (editar) → Nueva versión.
   IMPORTANTE: editar la implementación existente, NO crear una nueva (la URL
   cambiaría y rompería la app).

## Cómo validar cambios localmente

- JS: `node --check archivo.js` (verifica sintaxis).
- CSS: comprobar balance de llaves (`grep -o '{' f.css | wc -l` vs `}`).
- Backend: copiar el `.gs` a un `.js` temporal y `node --check` (solo sintaxis;
  las APIs de Apps Script no existen en node, pero detecta errores de parseo).

## Estado actual (qué está hecho)

Todo lo siguiente está implementado y funcionando:
- Núcleo: itinerario editable, presupuesto + saldos, transporte, apps,
  emergencias, notas/photodump.
- Robustez: cola offline, optimistic UI, validación, skeleton loaders, reset.
- PWA: instalable, service worker, banner de actualización, kill switch.
- Mapas: botón "cómo llegar", mini-mapa del día, editar ubicación, ruta del día.
- Clima en vivo (Open-Meteo).
- Dashboard "Hoy": copiloto que abre durante el viaje (header del día, próxima
  actividad, timeline, gasto de hoy, clima, quick actions).
- Rediseño visual: estilo "boarding pass" + base suave, propagado a toda la app
  vía tokens.
- Modo oscuro completo.
- Exportar itinerario a PDF.
- Fix de contraste/legibilidad en ambos temas.

## Pendientes / ideas futuras

- Bóveda de documentos/reservas (decidido: Opción C híbrida = dato clave + link
  + nota, en pestaña nueva "🎫 Reservas"; solo texto/links, NUNCA datos
  sensibles como tarjetas o pasaportes). Sin empezar.
- Widgets "inteligentes" del dashboard: detectar huecos/solapes del plan y
  alerta de ritmo (usa la energía de cada día). Diseñados, sin implementar.

## Tono y forma de trabajar (preferencias del usuario)

- El usuario NO es desarrollador experto. Explicar de forma clara y paso a paso.
- Entregar archivos COMPLETOS, no fragmentos.
- Implementar por fases pequeñas, cada una testeable.
- Para cada cambio: explicar qué se toca, dar el código, decir cómo desplegar y
  cómo probar.
- Prioridades: estabilidad > arquitectura limpia > UX > sincronización robusta >
  mantenibilidad > rendimiento móvil > escalabilidad.
