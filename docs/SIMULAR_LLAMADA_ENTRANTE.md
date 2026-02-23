# Simular llamada entrante (sin RingCentral)

Para probar el popup de llamada entrante sin depender de RingCentral puedes:

1. **Desde la consola del navegador** (solo en desarrollo).
2. **Desde Postman** llamando a un endpoint del backend que emita el evento por WebSocket.

---

## 1. Desde la consola del navegador (desarrollo)

### Pasos para que se muestre el modal

1. **Ejecuta la app en modo desarrollo** (`npm run dev`). La simulación desde consola solo está activa en desarrollo.
2. **Inicia sesión** en la app con cualquier usuario.
3. **Abre la consola del navegador** (F12 → pestaña *Console*).
4. **Pega y ejecuta** uno de los dos comandos siguientes.

---

### Opción A: Simulación que siempre muestra el modal (recomendada para probar)

En desarrollo, si incluyes **`__simulate: true`** en el `detail`, el modal se muestra siempre (no se valida si el usuario tiene esa extensión asignada). Sirve para ver el popup sin configurar extensiones.

```javascript
window.dispatchEvent(new CustomEvent('incoming_call_simulate', {
  detail: {
    __simulate: true,
    call_id: 'sim-' + Date.now(),
    phone_number: '+573001234567',
    extension_id: '63015562023',
    extension_number: '105',
    direction: 'Inbound',
    status: 'Ringing',
    timestamp: new Date().toISOString()
  }
}));
```

Deberías ver el **modal de llamada entrante** con el número y la extensión.

---

### Opción B: Simulación que valida extensiones (como en producción)

Sin `__simulate: true`, el modal **solo se muestra** si el `extension_id` está en las extensiones asignadas al usuario actual (Configurador → `ringcentral_extension_ids`).

```javascript
// Sustituye '63015562023' por un extension_id que tenga asignado el usuario actual
window.dispatchEvent(new CustomEvent('incoming_call_simulate', {
  detail: {
    call_id: 'sim-' + Date.now(),
    phone_number: '+573001234567',
    extension_id: '63015562023',
    extension_number: '105',
    direction: 'Inbound',
    status: 'Ringing',
    timestamp: new Date().toISOString()
  }
}));
```

Para ver las extensiones del usuario actual:

```javascript
JSON.parse(localStorage.getItem('ringcentral_extension_ids') || '[]')
// o
JSON.parse(localStorage.getItem('user') || '{}').ringcentral_extension_ids
```

---

## 2. Desde Postman (backend debe emitir el evento)

El frontend **solo escucha por WebSocket** (Laravel Echo). No hay un endpoint HTTP en el frontend para “recibir” la llamada. Por tanto, para simular desde Postman:

1. El **backend** debe exponer un endpoint (por ejemplo `POST /api/integrations/ringcentral/simulate-incoming-call` o `POST /api/broadcast-test/incoming-call`) que:
   - Acepte el body que envías desde Postman.
   - Emita el evento **`incoming_call`** al canal correspondiente (Reverb/Pusher), con el mismo formato que usa cuando recibe un webhook de RingCentral.

2. Desde **Postman** llamas a ese endpoint con el payload de la “llamada simulada”.

### Payload que debe emitir el backend (y que puedes enviar en el body desde Postman)

El evento que el frontend espera tiene esta forma. El backend debe enviar **exactamente esto** al broadcast (y puede aceptar el mismo JSON en el endpoint de simulación):

```json
{
  "call_id": "2085305270023",
  "phone_number": "+17866142302",
  "extension_id": "63015562023",
  "extension_number": "105",
  "direction": "Inbound",
  "status": "Ringing",
  "timestamp": "2026-02-21T15:02:19.531Z",
  "cliente": null
}
```

Campos importantes para que el modal se muestre en el usuario correcto:

| Campo           | Tipo   | Descripción |
|----------------|--------|-------------|
| **extension_id** | string | **Obligatorio.** ID de la extensión RingCentral donde “suena” la llamada. El frontend solo muestra el modal si este valor está en las extensiones asignadas al usuario logueado. |
| call_id        | string | ID de la sesión de llamada (evita duplicados). |
| phone_number   | string | Número que llama. |
| extension_number | string \| null | Número corto de la extensión (ej. "105"). |
| status         | string | `Ringing` o `CallConnected`. |
| direction      | string | `Inbound`. |
| cliente        | object \| null | Opcional; si viene, se muestra en el modal. |

### Ejemplo de solicitud en Postman

- **Método:** `POST`
- **URL:** la de tu endpoint de simulación en el backend (ej. `https://api.tudominio.com/api/integrations/ringcentral/simulate-incoming-call`).
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {token}` (token del usuario con el que estás logueado en el frontend, si el endpoint lo requiere).
- **Body (raw, JSON):**

```json
{
  "call_id": "sim-postman-1",
  "phone_number": "+573001234567",
  "extension_id": "63015562023",
  "extension_number": "105",
  "direction": "Inbound",
  "status": "Ringing",
  "timestamp": "2026-02-21T15:02:19.531Z"
}
```

Sustituye **`extension_id`** por uno de los que tenga asignado el usuario con el que estás probando en el frontend (mismo que en el Configurador / `ringcentral_extension_ids`).

### Qué debe hacer el backend al recibir esta petición

1. Validar el body (y opcionalmente el token).
2. Emitir el evento de broadcasting con nombre **`.incoming_call`** al menos a:
   - `private-ringcentral.extension.{extension_id}` (reemplazando por el `extension_id` del body),
   - y/o `private-ringcentral.calls`,
   según cómo tengas definido en Laravel (ej. `broadcast(new LlamadaEntrante($payload))` o equivalente).
3. El payload del evento debe ser el mismo objeto (o incluir como mínimo `call_id`, `phone_number`, `extension_id`, `extension_number`, `direction`, `status`, `timestamp`).

Si el backend ya tiene un evento tipo `LlamadaEntrante` que usa con RingCentral, el endpoint de simulación puede construir ese mismo DTO con el body de Postman y hacer `broadcast(...)` sin tocar el resto de la lógica.

---

## Validación en el frontend

El modal se muestra **solo si**:

1. El evento incluye **`extension_id`**.
2. Ese **`extension_id`** está en la lista de extensiones asignadas al usuario actual (guardada en localStorage en `ringcentral_extension_ids` y en `user.ringcentral_extension_ids`).

La comparación se hace siempre en string (por si el backend envía número o string). Si no aparece el modal, revisa en consola los logs `🔍` y que las extensiones del usuario estén guardadas en localStorage y que el `extension_id` del evento coincida con una de ellas.
