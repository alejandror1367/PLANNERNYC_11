# API_CONTRACTS.md — Travel Planner v2

Contratos entre el frontend (`js/api.js`) y el backend (Apps Script `Code.gs`).
Para arquitectura general ver `ARCHITECTURE.md`.

## Transporte

- **Base**: la URL de la Web App de Apps Script, hardcodeada en `js/config.js`
  como `API_URL`.
- **Lectura**: `GET {API_URL}?action=<accion>&<params>`.
- **Escritura**: `POST {API_URL}` con body JSON `{ action, data }` y
  `Content-Type: text/plain` (evita el preflight CORS que Apps Script no maneja
  bien).
- **Frontend**: `api.getAll()` y `api.callAction(action, data)`.

## Forma de las respuestas

Normalizadas por `Response.gs`:

```json
// Éxito
{ "ok": true, "data": { ... } }

// Error
{ "ok": false, "error": { "code": "VALIDATION", "message": "..." } }
```

Códigos de error usados: `VALIDATION`, `NOT_FOUND`, y errores genéricos.

## Acciones (ROUTES)

### Lectura (GET)

| action          | params | devuelve |
|-----------------|--------|----------|
| `health`        | —      | `{ ok, version, schemaVersion, time }` |
| `getAll`        | —      | `{ expenses, itinerary, notes, wishlist, config, settlements, schemaVersion }` |
| `getExpenses`   | —      | lista de gastos |
| `getItinerary`  | —      | lista de días con actividades |
| `getNotes`      | —      | `{ notes }` |
| `getWishlist`   | —      | `{ wishlist }` (photodump, JSON) |
| `getConfig`     | —      | config (incluye tasa de cambio) |
| `getSettlements`| —      | lista de liquidaciones |

`getAll` es la llamada principal al cargar la app (un solo round-trip).

### Escritura (POST `{ action, data }`)

| action            | data | efecto |
|-------------------|------|--------|
| `addExpense`      | `{ ...gasto }` | crea gasto → `{ expense }` |
| `updateExpense`   | `{ id, ...campos }` | actualiza gasto → `{ expense }` |
| `deleteExpense`   | `{ id }` | elimina gasto |
| `addActivity`     | `{ day, time, name, desc, location, tags }` | crea actividad |
| `updateActivity`  | `{ id, ...campos }` | actualiza actividad (merge) |
| `deleteActivity`  | `{ id }` | elimina actividad |
| `updateDay`       | `{ day, title, city, energy, weather }` | edita metadatos del día |
| `addSettlement`   | `{ ...liquidacion }` | registra pago entre Alejo/Ana |
| `deleteSettlement`| `{ id }` | elimina liquidación |
| `updateNotes`     | `{ notes }` | guarda notas |
| `updateWishlist`  | `{ wishlist }` | guarda photodump (JSON) |
| `updateRate`      | `{ rate }` | actualiza tasa de cambio COP/USD |
| `updateConfig`    | `{ key, value }` | setea una clave de config |
| `resetAll`        | `{ ... }` | reset (requiere confirmación en UI) |

## Modelo de datos

### Actividad (itinerario)
Columnas en la hoja Itinerary (`ITINERARY_COLUMNS` en `Itinerary.gs`):
`activity_id, day_num, date, city, day_title, energy, weather, time,
activity_name, description, tags, clientId`
+ columna opcional `location` (se crea automáticamente al guardar una ubicación).

En el frontend, una actividad luce:
```js
{ id, time, name, desc, location, tags: [], _pending?, _queued?, _failed? }
```

Y un día:
```js
{ day, date, city, title, energy, weather, activities: [ ...actividades ] }
```

### Gasto
Campos típicos: quién pagó (ale/ana), monto (USD), categoría, ciudad, día,
descripción, si es compartido. (Ver `Expenses.gs` y `Validators.gs` para los
campos exactos y validaciones.)

### Liquidación (settlement)
Pago de una persona a otra para saldar cuentas. (Ver `Settlements.gs`.)

## Acciones encolables (offline)

Definidas en `config.js → enqueueableActions`. Si no hay red, estas se guardan
en la cola (`localStorage`) y se reintenta al reconectar:
`addExpense, updateExpense, deleteExpense, addActivity, updateActivity,
deleteActivity, updateDay, addSettlement, deleteSettlement, updateRate,
updateWishlist`.

Al añadir una acción de escritura nueva que deba funcionar offline, registrarla
también aquí y mantener el patrón optimista en el store.

## Versionado

- `API_VERSION` y `SCHEMA_VERSION` viven en `Code.gs`.
- `getAll` y `health` devuelven `schemaVersion`; el frontend puede detectar
  desajustes de esquema.
- `Migrate.gs` adapta hojas creadas con esquemas anteriores.

## Reglas al tocar el backend

- Añadir una acción nueva: registrarla en `ROUTES` (Code.gs) apuntando a una
  función `Modulo_funcion` definida en el `.gs` correspondiente.
- Validar SIEMPRE las entradas con `Validators.gs`.
- Devolver con el formato normalizado de `Response.gs`.
- Recordar el flujo de despliegue: editar la implementación existente (✏️ →
  Nueva versión), NO crear una implementación nueva (cambiaría la URL).
