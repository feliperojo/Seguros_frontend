# CORS para POST /broadcasting/auth (Laravel)

Cuando el frontend está en **https://vantun.com** y el backend en **https://api.vantun.com**, Laravel Echo envía una petición **POST** a `https://api.vantun.com/broadcasting/auth` para autorizar canales privados (Bearer token). El navegador aplica CORS: si el backend no responde con `Access-Control-Allow-Origin: https://vantun.com`, la respuesta se bloquea aunque el servidor devuelva 200.

---

## Síntoma en el frontend

En la consola del navegador:

- `Origin https://vantun.com is not allowed by Access-Control-Allow-Origin. Status code: 200`
- `XMLHttpRequest cannot load https://api.vantun.com/broadcasting/auth due to access control checks.`

---

## Qué debe hacer el backend (Laravel)

El servidor **api.vantun.com** debe incluir en las respuestas de `/broadcasting/auth` (y en la preflight OPTIONS si existe) los headers CORS que permitan el origen del frontend.

### 1. Configurar CORS en Laravel

En **`config/cors.php`** (o el archivo de CORS que use el proyecto):

- Incluir el origen del frontend en `allowed_origins`:

```php
'allowed_origins' => [
    'https://vantun.com',
    'https://www.vantun.com',
    // en local: 'http://localhost:5173',
],
```

- Asegurar que se permitan los métodos y headers que usa Echo:

```php
'allowed_methods' => ['GET', 'POST', 'OPTIONS'],
'allowed_headers' => ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
'supports_credentials' => true,  // si se usan cookies; con Bearer a veces no hace falta
```

### 2. Aplicar CORS a la ruta de broadcasting

La ruta **POST /broadcasting/auth** debe estar cubierta por el middleware CORS de Laravel. Si usan **fruitcake/laravel-cors** o el middleware `HandleCors` por defecto, suele aplicarse a todas las rutas. Comprobar que:

- La ruta `/broadcasting/auth` no esté excluida de CORS.
- En respuestas de error (401, 403, 500) también se envíen los headers CORS (en Laravel el middleware CORS suele añadirlos a todas las respuestas).

### 3. Nginx (si aplica)

Si Nginx hace proxy a Laravel, no debe eliminar ni sobrescribir los headers `Access-Control-Allow-*` que envía Laravel. No añadir en Nginx algo que reemplace o quite esos headers.

### 4. Comprobar la respuesta

Desde el navegador (pestaña Red), al llamar a `POST https://api.vantun.com/broadcasting/auth` con `Origin: https://vantun.com`, la respuesta debe incluir:

- `Access-Control-Allow-Origin: https://vantun.com` (o el origen que haga la petición)
- Si hay preflight OPTIONS: mismo header en la respuesta OPTIONS.

---

## Resumen

| Dónde        | Acción |
|-------------|--------|
| `config/cors.php` | Añadir `https://vantun.com` (y `https://www.vantun.com` si aplica) a `allowed_origins`. |
| Ruta broadcasting | Asegurar que no esté excluida del middleware CORS. |
| Respuesta 200/401/403 | Debe incluir los headers CORS en todas las respuestas a ese origen. |

Con esto, el frontend en vantun.com podrá completar la autorización de canales privados contra api.vantun.com y la conexión a Pusher Cloud funcionará de extremo a extremo.
