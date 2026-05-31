# ROADMAP.md — Travel Planner v2

Estado del proyecto y qué sigue. Para reglas y arquitectura ver `CLAUDE.md`,
`ARCHITECTURE.md`, `PROJECT_RULES.md`.

## Completado ✅

### Núcleo
- Itinerario editable (días + actividades, CRUD completo).
- Presupuesto compartido con liquidación de saldos entre Alejo y Ana.
- Transporte, Apps útiles y Contactos de emergencia (data-driven desde JSON).
- Notas y photodump.

### Robustez
- Cola de mutaciones offline (localStorage) + optimistic UI.
- Validación de entradas, skeleton loaders, reset con confirmación.
- Versionado de esquema + migraciones.

### PWA
- Instalable, service worker cache-first.
- Banner "Nueva versión disponible".
- Kill switch (`sw-uninstall.html`) para caché terco en iOS.

### Mapas (Fase 9)
- 9.1A: botón "Cómo llegar" por actividad (Google Maps).
- 9.1B: mini-mapa del día con pines + ruta completa.
- 9.2: editar ubicación de actividad desde la app.
- 9.3: clima en vivo por día (Open-Meteo, sin API key).
- Fix: ruta del día con todas las paradas (encoding de waypoints).

### Dashboard "Hoy"
- Pestaña que abre durante el viaje (copiloto).
- Header del día, próxima actividad, timeline, gasto de hoy, clima.
- Quick actions: registrar gasto, ¿dónde estoy?

### Visual
- Rediseño global estilo "boarding pass" + base suave, vía tokens.
- Modo oscuro completo (tinta cálida, acentos intactos, persistencia).
- Exportar itinerario a PDF (dossier imprimible).
- Fix de contraste/legibilidad en modo claro y oscuro.

## En curso / siguiente 🔜

Nada en curso ahora mismo. El proyecto está estable.

## Pendientes / backlog 📋

### Bóveda de documentos / reservas
- **Decisión tomada**: Opción C híbrida = por cada reserva, un dato clave
  (código de confirmación) + un link al documento + una nota.
- **Ubicación**: pestaña nueva "🎫 Reservas".
- **Categorías**: Vuelos, Hoteles, Tiquetes, Pagos, Otros (a confirmar).
- **Arquitectura**: solo texto/links en Sheets (como el photodump). NUNCA
  archivos ni datos sensibles (tarjetas, contraseñas, pasaportes).
- Estado: sin empezar. Faltaba confirmar categorías con el usuario.

### Widgets inteligentes del dashboard "Hoy"
- Detectar huecos y solapes en el plan del día (lee el itinerario, avisa de
  espacios grandes entre actividades o choques de hora).
- Alerta de ritmo: usa la energía de cada día para avisar de rachas intensas o
  sugerir descanso.
- Estado: diseñados (hay mockups), sin implementar. Salen 100% de datos
  existentes, sin backend.

### Ideas sueltas (sin prioridad)
- Exportar también el presupuesto a PDF.
- Más quick actions en el dashboard (plan B lluvia, sorpréndeme).

## Cómo retomar en Claude Code

1. Abrir el repo en Claude Code (`claude` desde la carpeta del proyecto).
2. Pedirle: "Lee CLAUDE.md, ARCHITECTURE.md y este ROADMAP.md y descríbeme el
   proyecto y qué está pendiente." — así construye su modelo mental.
3. Elegir un pendiente del backlog y trabajarlo por fases.
4. Recordar siempre las reglas de oro (bumpear CACHE_VERSION, no hardcodear
   colores, namespace global del backend).
