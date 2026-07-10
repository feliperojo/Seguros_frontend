# Identificador de Llamadas - Integración con Laravel

Sistema de identificación de llamadas en tiempo real que se conecta a Laravel, el cual recibe webhooks de RingCentral.

## 📋 Características

- ✅ Conexión a Laravel mediante Laravel Echo (WebSockets) o Polling
- ✅ Detección automática de llamadas entrantes y salientes
- ✅ Búsqueda automática de clientes en el ERP por número de teléfono
- ✅ Modal informativo con datos del cliente
- ✅ Historial de compras y notas importantes
- ✅ Fallback automático a polling si WebSockets no están disponibles
- ✅ Indicador visual del estado de conexión
- ✅ Notificaciones toast para eventos importantes

## 🚀 Instalación

Las dependencias ya están instaladas:
- `laravel-echo` - Para WebSockets
- `pusher-js` - Cliente de Pusher/WebSockets

## 📦 Estructura de Archivos

```
src/
  components/
    CallIdentifier/
      CallIdentifier.jsx      # Componente principal
      CallModal.jsx           # Modal que muestra info del cliente
      CallNotification.jsx    # Manejo de notificaciones
      index.js                # Exportaciones
  hooks/
    useRingCentral.js         # Hook personalizado (renombrado, pero funciona igual)
  services/
    llamadasService.js        # Servicio de llamadas (Echo/Polling)
    apiService.js             # Servicio de API Laravel
  utils/
    constants.js              # Constantes del sistema
```

## 🔧 Configuración

### 1. Variables de Entorno

Crea o actualiza tu archivo `.env` con las siguientes variables:

```env
# API Laravel
VITE_API_BASE_URL=https://api.vantun.com

# Laravel Echo / WebSockets (Opcional)
# Si no configuras estas, el sistema usará polling automáticamente

# Opción 1: Usar Pusher.com
VITE_BROADCAST_DRIVER=pusher
VITE_PUSHER_APP_KEY=tu-pusher-key
VITE_PUSHER_APP_CLUSTER=us2

# Opción 2: Usar servidor WebSocket propio (Laravel WebSockets / Soketi)
VITE_BROADCAST_DRIVER=pusher
VITE_PUSHER_APP_KEY=tu-app-key
VITE_PUSHER_APP_HOST=localhost
VITE_PUSHER_APP_PORT=6001
VITE_PUSHER_APP_USE_TLS=false

# Para producción con SSL:
# VITE_PUSHER_APP_HOST=ws.tudominio.com
# VITE_PUSHER_APP_PORT=6001
# VITE_PUSHER_APP_USE_TLS=true
```

**Nota:** Si no configuras las variables de WebSocket, el sistema automáticamente usará polling cada 2 segundos.

### 2. Backend Laravel - Endpoints Requeridos

#### A. Endpoint de Polling (si no usas WebSockets)

```php
// routes/api.php
Route::get('/llamadas/activas', [LlamadasController::class, 'activas'])
    ->middleware('auth:sanctum');
```

**Response esperado:**
```json
{
  "data": [
    {
      "id": 1,
      "direction": "Inbound",
      "telefono": "+1234567890",
      "status": "ringing",
      "start_time": "2024-01-15T10:30:00Z",
      "cliente_id": 123,
      "cliente": {
        "id": 123,
        "nombre": "Juan Pérez",
        "empresa": "Empresa S.A.",
        // ... más datos del cliente
      }
    }
  ]
}
```

#### B. Eventos de Broadcasting (si usas WebSockets)

En tu backend Laravel, emite eventos cuando recibas webhooks de RingCentral:

```php
// app/Events/LlamadaEntrante.php
class LlamadaEntrante implements ShouldBroadcast
{
    public function __construct(
        public $llamada,
        public $cliente = null
    ) {}

    public function broadcastOn()
    {
        return new PrivateChannel('llamadas');
        // O canal público: return new Channel('llamadas');
    }

    public function broadcastAs()
    {
        return 'LlamadaEntrante';
    }
}
```

**Emitir el evento:**
```php
// Cuando recibas el webhook de RingCentral
broadcast(new LlamadaEntrante($llamadaData, $clienteData));
```

#### C. Endpoint de Búsqueda de Cliente

```php
// routes/api.php
Route::post('/buscar-cliente', [ClienteController::class, 'buscarPorTelefono'])
    ->middleware('auth:sanctum');
```

**Request:**
```json
{
  "telefono": "+1234567890"
}
```

**Response (Cliente encontrado):**
```json
{
  "data": {
    "id": 1,
    "nombre": "Juan Pérez",
    "empresa": "Empresa S.A.",
    "email": "juan@ejemplo.com",
    "telefono": "+1234567890",
    "estado": "Activo",
    "tags": ["VIP", "Cliente Frecuente"],
    "historialCompras": [
      {
        "producto": "Seguro Auto",
        "fecha": "2024-01-15",
        "monto": 500.00
      }
    ],
    "notas": [
      {
        "contenido": "Cliente preferencial",
        "fecha": "2024-01-10",
        "importante": true
      }
    ]
  }
}
```

**Response (Cliente no encontrado):**
```json
{
  "message": "Cliente no encontrado"
}
```
Con status code `404`.

### 3. Integración en el Layout

El componente ya está integrado en `MainLayout.jsx`. No necesitas hacer nada adicional.

## 🎯 Uso

### Funcionamiento Automático

Una vez que el usuario está autenticado:
1. El sistema se conecta automáticamente (Echo o Polling)
2. Detecta llamadas entrantes y salientes
3. Busca automáticamente el cliente en tu ERP
4. Muestra un modal con la información del cliente
5. Cierra el modal automáticamente cuando termina la llamada

### Estados de Conexión

El botón de estado muestra:
- 🟢 **Conectado (WebSocket)**: Usando Laravel Echo
- 🟢 **Conectado (Polling)**: Usando polling cada 2 segundos
- 🟡 **Conectando**: Estableciendo conexión
- ⚪ **Desconectado**: No hay conexión

### Control Manual

- **Conectar**: Clic en el botón verde para conectar manualmente
- **Desconectar**: Clic en el botón rojo para desconectar

## 🔌 Modos de Operación

### Modo 1: Laravel Echo (WebSockets) - Recomendado

**Ventajas:**
- Tiempo real instantáneo
- Menor carga en el servidor
- Más eficiente

**Requisitos:**
- Configurar variables de entorno de WebSocket
- Backend debe emitir eventos de broadcasting
- Servidor WebSocket funcionando (Pusher, Laravel WebSockets, Soketi, etc.)

### Modo 2: Polling - Fallback Automático

**Ventajas:**
- No requiere configuración adicional
- Funciona sin WebSockets
- Fácil de implementar

**Desventajas:**
- Consulta cada 2 segundos (ligero delay)
- Mayor carga en el servidor

**Requisitos:**
- Endpoint `GET /api/llamadas/activas` implementado

## 🛠️ Personalización

### Cambiar el intervalo de polling

En `llamadasService.js`:
```javascript
this.pollingIntervalMs = 2000; // Cambiar a 3000 para 3 segundos
```

### Cambiar el nombre del canal

En `llamadasService.js`:
```javascript
const channelName = 'llamadas'; // Cambiar según tu configuración
```

### Modificar el formato de eventos

Ajusta `handleLlamadaEvent` en `llamadasService.js` según el formato que envía tu backend.

## 🐛 Solución de Problemas

### No se detectan las llamadas (WebSocket)

1. Verifica las variables de entorno
2. Revisa la consola del navegador para errores
3. Verifica que el servidor WebSocket esté funcionando
4. Asegúrate de que Laravel esté emitiendo eventos correctamente

### No se detectan las llamadas (Polling)

1. Verifica que el endpoint `/api/llamadas/activas` esté funcionando
2. Revisa la consola del navegador
3. Verifica que retorne el formato correcto

### Error de autenticación en WebSocket

1. Verifica que el token de autenticación esté presente
2. Revisa que el endpoint `/broadcasting/auth` esté configurado en Laravel
3. Verifica los permisos del canal privado

### El sistema siempre usa polling

1. Verifica las variables de entorno de WebSocket
2. Revisa la consola para errores de inicialización
3. El sistema automáticamente usa polling si Echo falla

## 📝 Notas Importantes

- **Autenticación**: El sistema usa el token de autenticación existente (`auth_token` en localStorage)
- **Fallback Automático**: Si WebSockets no están disponibles, automáticamente usa polling
- **Conexión Automática**: Se conecta automáticamente cuando el usuario está autenticado
- **Reconexión**: El sistema intenta reconectar automáticamente si se pierde la conexión

## 🔒 Seguridad

- Las conexiones WebSocket usan el token de autenticación
- Los canales privados requieren autenticación en Laravel
- Las peticiones de polling usan el token de autenticación existente

## 📚 Recursos

- [Laravel Broadcasting](https://laravel.com/docs/broadcasting)
- [Laravel Echo](https://laravel.com/docs/broadcasting#client-side-installation)
- [Pusher Documentation](https://pusher.com/docs)
- [Laravel WebSockets](https://beyondco.de/docs/laravel-websockets)
