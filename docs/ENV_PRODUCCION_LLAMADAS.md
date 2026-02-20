# Configuración manual .env en producción (llamadas en tiempo real)

Los archivos `.env` están en `.gitignore`, así que **debes configurar las variables a mano** en el entorno de producción (o en el archivo que uses para el build de producción).

---

## Dónde hacer los cambios

- **Si en producción construyes el frontend** (ej. `npm run build` en un servidor o en CI): edita **`.env.production`** en ese entorno (o las variables de entorno que inyecte tu pipeline).
- **Si usas un host que inyecta env en el build** (Vercel, Netlify, etc.): añade las variables en el panel de **Environment Variables** del proyecto, con **Production** seleccionado.

---

## Variables que debes tener en producción

Copia y pega en tu `.env.production` (o en el panel de env de tu host) y **sustituye los valores** por los reales de tu backend.

```env
# API (ya lo tienes; si no, descomenta y ajusta)
VITE_API_BASE_URL=https://api.vantun.com/api

# =============================================================================
# Llamadas en tiempo real (popup de llamada entrante) – PRODUCCIÓN
# =============================================================================
# Origen del backend SIN /api (para POST /broadcasting/auth)
VITE_BACKEND_URL=https://api.vantun.com

# Reverb (DEBEN coincidir con el .env del backend Laravel en producción)
VITE_REVERB_APP_KEY=<mismo valor que REVERB_APP_KEY del backend>
VITE_REVERB_HOST=api.vantun.com
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
```

---

## Pasos concretos

### 1. Obtener valores del backend

En el servidor o repo del **backend Laravel** (producción), revisa el `.env` y anota:

- `REVERB_APP_KEY` → ese mismo valor va en `VITE_REVERB_APP_KEY`.
- Host y puerto donde esté Reverb:
  - Si Reverb va en el mismo dominio que la API (ej. `api.vantun.com`), normalmente:
    - `VITE_REVERB_HOST=api.vantun.com`
    - `VITE_REVERB_PORT=443`
    - `VITE_REVERB_SCHEME=https`
  - Si Reverb va en otro host/puerto, usa ese host, ese puerto y `https` si usa SSL.

### 2. Editar `.env.production` en el frontend

1. Abre el archivo **`.env.production`** del proyecto frontend (en tu máquina o en el servidor donde hagas el build).
2. Deja o añade `VITE_API_BASE_URL` si no está.
3. Añade **exactamente** estas líneas (sustituyendo los valores entre `<>`):

```env
VITE_API_BASE_URL=https://api.vantun.com/api

VITE_BACKEND_URL=https://api.vantun.com

VITE_REVERB_APP_KEY=<peg aquí REVERB_APP_KEY del backend>
VITE_REVERB_HOST=api.vantun.com
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
```

4. Guarda el archivo.
5. Vuelve a generar el build: `npm run build` (o el comando que uses). Las `VITE_*` se embeben en el build en el momento de compilar.

### 3. Si usas Vercel / Netlify / similar

1. Entra al proyecto → **Settings** → **Environment Variables**.
2. Añade cada variable con **Production** (y opcionalmente Preview si quieres):
   - `VITE_API_BASE_URL` = `https://api.vantun.com/api`
   - `VITE_BACKEND_URL` = `https://api.vantun.com`
   - `VITE_REVERB_APP_KEY` = (valor del backend)
   - `VITE_REVERB_HOST` = `api.vantun.com`
   - `VITE_REVERB_PORT` = `443`
   - `VITE_REVERB_SCHEME` = `https`
3. Guarda y **vuelve a desplegar** (redeploy) para que el nuevo build tome las variables.

---

## Resumen de qué agregar o modificar

| Variable | Acción en producción | Ejemplo de valor |
|----------|----------------------|------------------|
| `VITE_API_BASE_URL` | Ya la tienes en .env.production; verifica que sea la URL de la API | `https://api.vantun.com/api` |
| `VITE_BACKEND_URL` | **Agregar** (origen del backend sin `/api`) | `https://api.vantun.com` |
| `VITE_REVERB_APP_KEY` | **Agregar** (mismo que en el backend) | Valor del backend |
| `VITE_REVERB_HOST` | **Agregar** (dominio donde corre Reverb) | `api.vantun.com` |
| `VITE_REVERB_PORT` | **Agregar** (443 si es HTTPS) | `443` |
| `VITE_REVERB_SCHEME` | **Agregar** | `https` |

Sin estas variables (sobre todo key y host), el popup de llamada entrante **no se mostrará** en producción porque Echo no se inicializará.

---

## Pusher Cloud (producción actual)

Si usas **Pusher Cloud** (no Reverb self-host), en `.env.production` debe estar:

- `VITE_BROADCAST_DRIVER=pusher`
- `VITE_PUSHER_APP_KEY=<tu-key>` (ej. la de tu app en Pusher)
- `VITE_PUSHER_APP_CLUSTER=us2` (o el cluster de tu app)
- **No** definir host ni puertos: `VITE_PUSHER_HOST=`, `VITE_PUSHER_APP_HOST=`, `VITE_REVERB_HOST=` (vacíos o sin definir).

Así el WebSocket conecta a los servidores de Pusher, no a `wss://api.vantun.com/app/...`.

---

## Verificación post-build

Tras `npm run build`, comprobar que la URL de WebSocket no quede fijada a tu API:

```bash
grep -R "api.vantun.com" -n dist/
```

No debe aparecer ninguna ruta tipo `wss://api.vantun.com/app/...` en el bundle. Sí puede aparecer `api.vantun.com` en la URL de la API REST (`VITE_API_BASE_URL`); lo importante es que el WebSocket use Pusher (ej. `ws-us2.pusher.com` o similar).

---

## Opcional

- **`VITE_BROADCASTING_AUTH_URL`**: solo si el backend expone la autorización de canales en una URL distinta a `{VITE_BACKEND_URL}/broadcasting/auth`. En ese caso pon la URL completa, ej. `https://api.vantun.com/broadcasting/auth`.
