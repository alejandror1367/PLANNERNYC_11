# Travel Planner v2 — NYC + Boston

> Alejo × Ana · Octubre 2026 · LGBT-friendly travel dossier

App web personalizada para planificar y gestionar nuestro viaje a Nueva York y Boston. Sincronizada en tiempo real entre los dos vía Google Sheets, sin servidores propios ni costos recurrentes.

## Stack

- **Frontend**: HTML + CSS + Vanilla JavaScript (ES Modules)
- **Backend**: Google Apps Script (gratis)
- **Base de datos**: Google Sheets (gratis)
- **Hosting**: GitHub Pages (gratis)
- **Sin frameworks**, sin bundler, sin dependencias.

## Estructura

```
travel-planner-v2/
├── index.html              # Punto de entrada
├── css/                    # Estilos modulares
│   ├── tokens.css          # Design tokens (colores, fuentes, etc.)
│   ├── base.css            # Reset, body, grain, foco
│   ├── layout.css          # (Fase 1) Wrap, header, tabs, paneles
│   ├── components.css      # (Fase 1) Cards, botones, tags, inputs
│   ├── views.css           # (Fase 3+) Estilos específicos por vista
│   └── responsive.css      # (Fase 1) Media queries centralizadas
├── js/                     # Lógica modular (Fase 1+)
├── data/                   # Contenido estático en JSON (Fase 5)
└── backend/                # Apps Script (Fase 2)
```

## Estado actual

- ✅ **Fase 0** — Base, tokens, reset, grain, header
- ✅ **Fase 1** — Diseño y navegación (tabs, sync status, JS modular)
- ✅ **Fase 2** — Backend nuevo (Apps Script modular + Sheet schema)
- ✅ **Fase 3** — Capa de datos + vistas de lectura (Overview, Itinerario, Notas)
- ⏳ **Fase 4** — Vista Budget
- ⏳ **Fase 5** — Transport + Apps + Emergency
- ⏳ **Fase 6** — Robustez (offline, retry, a11y)
- ⏳ **Fase 7** — PWA (opcional)

## Cómo correr localmente

Como es HTML + CSS + JS plano, basta con abrir `index.html` en el navegador. Para evitar problemas de CORS con `fetch` local (cuando lleguemos a Fase 2+), recomendamos servir con un servidor estático:

```bash
# Opción 1: Python
python3 -m http.server 8000

# Opción 2: Node (npx, sin instalar nada permanente)
npx serve .

# Opción 3: VS Code con la extensión "Live Server"
```

Luego abre `http://localhost:8000`.

## Despliegue en GitHub Pages

1. Crear repo en GitHub (público o privado con Pages habilitado).
2. Subir el contenido del proyecto (`git push`).
3. En el repo: **Settings → Pages → Source → Deploy from a branch → `main` / root**.
4. Esperar ~1 min. El sitio queda en `https://<usuario>.github.io/<repo>/`.

## Conectar al backend (Apps Script)

Cuando lleguemos a Fase 2, cada dispositivo se conecta una sola vez ingresando la URL del Apps Script en el modal de setup. La URL queda guardada en `localStorage`.

## Convenciones

- **CSS**: BEM-ish (`.block__element--modifier`)
- **JS**: ES Modules con `import/export`, sin transpilación
- **Commits**: en español, prefijo de fase (`fase0:`, `fase1:`, etc.)

---

*Hecho con cariño para nuestro viaje. Octubre 2026.* ✈️
