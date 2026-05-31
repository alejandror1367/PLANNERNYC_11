# PROJECT_RULES.md — Travel Planner v2

Reglas de trabajo para mantener el proyecto estable y coherente. Para contexto
y arquitectura ver `CLAUDE.md` y `ARCHITECTURE.md`.

## Reglas de oro (no negociables)

1. **Bumpear `CACHE_VERSION` en `sw.js` en CADA cambio de frontend.** Timestamp
   nuevo (`tpYYYYMMDD-HHMMSS`). Archivos nuevos → añadir a `PRECACHE_ASSETS`.

2. **Solo `Code.gs` define `doGet`/`doPost`/`ROUTES`/`API_VERSION`/`SCHEMA_VERSION`.**
   Los demás `.gs` solo aportan funciones con prefijo de módulo.

3. **No hardcodear colores.** Usar variables de `tokens.css`. Es lo que mantiene
   vivo el modo oscuro.

4. **No introducir frameworks ni dependencias de runtime.** HTML/CSS/JS vanilla.
   Sin React, sin TypeScript, sin build step, sin npm en producción.

5. **No guardar datos sensibles en Sheets.** Nada de números de tarjeta,
   contraseñas, ni pasaportes. (Aplica a la futura bóveda de documentos.)

## Cómo trabajar los cambios

- **Por fases pequeñas y testeables.** No intentar todo de una. Cada fase debe
  quedar funcional y estable.
- **Archivos completos.** Al entregar/editar, dejar el archivo entero válido, no
  fragmentos sueltos.
- **Mantener el patrón modular.** Vista por pestaña, componentes reutilizables,
  lógica en módulos (store/budget/trip), no en las vistas.
- **Respetar optimistic UI.** Mutaciones nuevas: aplicar local primero, encolar
  si offline, registrar en `enqueueableActions` de `config.js`.

## Checklist antes de dar por hecho un cambio de frontend

- [ ] ¿Sintaxis JS válida? (`node --check`)
- [ ] ¿Balance de llaves CSS correcto?
- [ ] ¿Bumpée `CACHE_VERSION`?
- [ ] ¿Archivos nuevos en `PRECACHE_ASSETS`?
- [ ] ¿Usé variables de tokens (no hex hardcodeados)?
- [ ] ¿Se ve bien en claro Y en oscuro?
- [ ] ¿Responsive en móvil (mobile-first)?
- [ ] Commit con mensaje claro + push.

## Checklist antes de dar por hecho un cambio de backend

- [ ] ¿Solo `Code.gs` tiene los globales (doGet/doPost/etc.)?
- [ ] ¿Mis funciones tienen prefijo de módulo?
- [ ] ¿Respuestas JSON normalizadas vía `Response.gs`?
- [ ] ¿Validé entradas con `Validators.gs`?
- [ ] Recordar al usuario: pegar en Apps Script → guardar → Implementar →
      Gestionar → ✏️ editar → Nueva versión (NO crear implementación nueva).

## Despliegue

### Frontend
1. Bumpear `CACHE_VERSION`.
2. `git add -A && git commit -m "..." && git push`.
3. GitHub Pages publica. Usuario: banner verde → Actualizar.
4. PWA iOS terca: cerrar app del multitarea y reabrir, o `sw-uninstall.html`.

### Backend
1. Pegar `.gs` en script.google.com.
2. Ctrl+S.
3. Implementar → Gestionar implementaciones → ✏️ → Nueva versión.

## Git

- Rama principal: `main` (GitHub Pages publica desde ahí).
- Commits descriptivos en español, prefijo por tipo cuando aplique:
  `feat:`, `fix:`, `redesign:`, `refactor:`, `docs:`.
- Claude Code puede hacer `add`/`commit`/`push` directamente.

## Pruebas

- No hay suite de tests automatizada. La validación es:
  - `node --check` para sintaxis JS.
  - Revisión de balance de llaves CSS.
  - Prueba manual en el navegador (desktop + móvil).
- Para features dependientes de fechas (dashboard "Hoy", contador, clima):
  simular fechas en `config.js → TRIP` temporalmente, probar, y REVERTIR.

## Comunicación con el usuario

- El usuario no es desarrollador experto: explicaciones claras, paso a paso.
- Para cada cambio explicar: qué archivos se tocan, el código, cómo desplegar,
  cómo probar, y troubleshooting común.
- Preferir mostrar el plan y validar antes de implementar cambios grandes.

## Prioridades (en orden)

1. Estabilidad
2. Arquitectura limpia
3. UX
4. Sincronización robusta
5. Mantenibilidad
6. Rendimiento móvil
7. Escalabilidad
