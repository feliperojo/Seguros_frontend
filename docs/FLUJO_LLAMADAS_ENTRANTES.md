# Flujo: popup de llamada entrante en tiempo real

Resumen del flujo y checklist para que el evento del backend llegue al frontend y se muestre el popup sin romper lo existente.

---

## Flujo resumido

1. **Usuario autenticado** → entra a una ruta protegida → se monta `CallIdentifierContainer`.
2. **useIncomingCalls** (hook) lee token de `localStorage`, comprueba env (key + host) e **inicializa Laravel Echo**.
3. Echo se conecta a **Reverb/Pusher** (wsHost, wsPort, scheme) y llama a **POST /broadcasting/auth** con `Authorization: Bearer {token}` para autorizar canales privados.
4. Frontend se suscribe a:
   - `private-ringcentral.extension.{extensionId}` (si el usuario tiene extensión)
   - `private-App.Models.User.{userId}`
   - `private-ringcentral.calls`
   - canal público `llamadas` (fallback)
5. Backend emite el evento **`.incoming_call`** en el canal correspondiente cuando hay Ringing/CallConnected.
6. El hook recibe el payload, actualiza estado y **IncomingCallModal** muestra el popup (número, estado, cliente si viene en el evento o se busca por teléfono).

---

## Checklist frontend (sin romper nada)

- [ ] **.env** con todas las variables necesarias:
  - `VITE_REVERB_APP_KEY` (o `VITE_PUSHER_APP_KEY`) – obligatorio
  - `VITE_REVERB_HOST` (o `VITE_PUSHER_HOST`) – obligatorio
  - `VITE_REVERB_PORT`, `VITE_REVERB_SCHEME` (o equivalentes Pusher)
  - `VITE_BACKEND_URL`: origen del backend **sin** `/api` (ej. `http://127.0.0.1:8000` o `https://api.vantun.com`) para que la auth de broadcasting sea `{VITE_BACKEND_URL}/broadcasting/auth`
- [ ] **CallIdentifierContainer** se monta **solo dentro de rutas protegidas** (ya está dentro de `ProtectedLayout`), así solo se conecta Echo cuando hay token.
- [ ] Si el backend expone la auth en otra URL, definir **`VITE_BROADCASTING_AUTH_URL`** (URL completa, ej. `https://api.vantun.com/broadcasting/auth`).

---

## Checklist backend (para que el evento llegue)

- [ ] **POST /broadcasting/auth** acepta **Bearer token** (Sanctum). Si la ruta está bajo middleware `web`, puede ser necesario exponer una ruta bajo `api` que acepte Bearer y delegue a la lógica de autorización de canales.
- [ ] **Reverb (o Pusher)** en marcha y accesible desde el navegador (mismo host/puerto que en el frontend o CORS/WS permitidos).
- [ ] Emisión del evento **`incoming_call`** en el canal correcto:
  - Por extensión: `private-ringcentral.extension.{extensionId}`
  - Por usuario: `private-App.Models.User.{userId}`
  - General: `private-ringcentral.calls`
- [ ] Payload del evento con al menos: `call_id`, `phone_number`, `extension_id`, `extension_number`, `cliente` (opcional), `direction`, `status` (`Ringing` | `CallConnected`), `timestamp`.

---

## Recomendaciones

1. **Producción**: usar `VITE_BACKEND_URL=https://api.vantun.com` (o el dominio real). Reverb en el mismo dominio con WSS (puerto 443 o el que use el backend).
2. **Diagnóstico**: en consola del navegador aparecen logs con prefijo `[timestamp] 🔍` cuando Echo se conecta, se suscribe a canales o recibe `incoming_call`. Revisar si hay "Conectado a Laravel Echo" y "Suscrito al canal...".
3. **Si el popup no aparece**: comprobar que las variables de Reverb/Pusher estén definidas (key + host), que el usuario tenga `extension_id` o `id` en el objeto `user` de localStorage (para suscribirse al canal correcto) y que el backend esté emitiendo en ese canal con el nombre de evento `.incoming_call`.
4. **No tocar**: `useIncomingCalls` ya normaliza el payload del backend (`call_id`, `phone_number`, `cliente`), evita duplicados entre pestañas y reconecta ante desconexiones. El modal ya muestra número, estado y cliente; solo hace falta que Echo reciba el evento.
