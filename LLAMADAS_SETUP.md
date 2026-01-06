# 🔧 Configuración del Sistema de Identificación de Llamadas

## ⚠️ IMPORTANTE: Flujo Completo

El sistema **NO se conecta directamente a RingCentral**. El flujo es:

```
RingCentral → Webhook → Laravel → Frontend
```

### Paso 1: RingCentral envía webhook a Laravel
Cuando hay una llamada, RingCentral envía un webhook a tu servidor Laravel.

### Paso 2: Laravel procesa el webhook
Laravel debe:
- Recibir el webhook de RingCentral
- Procesar la información de la llamada
- **OPCIÓN A (WebSockets)**: Emitir un evento de broadcasting
- **OPCIÓN B (Polling)**: Guardar la llamada y exponerla en `GET /api/llamadas/activas`

### Paso 3: Frontend recibe la información
- Si usas WebSockets: Recibe el evento en tiempo real
- Si usas Polling: Consulta cada 2 segundos el endpoint

---

## 🔍 Diagnóstico del Problema

### 1. Verifica el estado de conexión

En la esquina inferior derecha de la aplicación verás un botón que indica:
- 🟢 **Conectado (Polling)** - El sistema está funcionando
- 🟡 **Conectando...** - Está intentando conectar
- ⚪ **Desconectado** - No está conectado

### 2. Usa el componente de diagnóstico

Hay un botón de "Diagnóstico" que aparece cuando hay errores o en desarrollo. Muestra:
- Si hay token de autenticación
- Si está conectado
- Si el endpoint de polling existe
- Errores encontrados

### 3. Revisa la consola del navegador

Abre las herramientas de desarrollador (F12) y revisa la consola. Deberías ver:
- `🔄 Polling - Respuesta recibida:` - Cada 2 segundos
- `📞 Procesando llamada del polling:` - Cuando hay una llamada
- `⚠️ Error al consultar llamadas activas:` - Si hay problemas

---

## 🛠️ Qué Necesitas en Laravel

### OPCIÓN A: Usar Polling (Más Simple)

#### 1. Crear el endpoint

```php
// routes/api.php
Route::get('/llamadas/activas', [LlamadasController::class, 'activas'])
    ->middleware('auth:sanctum');
```

#### 2. Crear el controlador

```php
// app/Http/Controllers/LlamadasController.php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class LlamadasController extends Controller
{
    /**
     * Retorna las llamadas activas
     * Este endpoint se consulta cada 2 segundos
     */
    public function activas(Request $request)
    {
        // OPCIÓN 1: Obtener de la base de datos
        $llamadas = \App\Models\Llamada::where('estado', 'activa')
            ->where('created_at', '>', now()->subMinutes(5))
            ->get()
            ->map(function ($llamada) {
                return [
                    'id' => $llamada->id,
                    'direction' => $llamada->direction, // 'Inbound' o 'Outbound'
                    'telefono' => $llamada->telefono,
                    'status' => $llamada->status, // 'ringing', 'active', 'ended'
                    'start_time' => $llamada->created_at->toISOString(),
                    'cliente_id' => $llamada->cliente_id,
                    'cliente' => $llamada->cliente ? [
                        'id' => $llamada->cliente->id,
                        'nombre' => $llamada->cliente->nombre,
                        'empresa' => $llamada->cliente->empresa,
                        // ... más campos
                    ] : null
                ];
            });

        return response()->json([
            'data' => $llamadas
        ]);

        // OPCIÓN 2: Obtener de Cache (si guardas las llamadas en cache)
        // $llamadas = Cache::get('llamadas_activas', []);
        // return response()->json(['data' => $llamadas]);
    }
}
```

#### 3. Procesar webhooks de RingCentral

```php
// routes/api.php o routes/web.php
Route::post('/webhooks/ringcentral', [RingCentralWebhookController::class, 'handle'])
    ->withoutMiddleware([\App\Http\Middleware\VerifyCsrfToken::class]);

// app/Http/Controllers/RingCentralWebhookController.php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Llamada;

class RingCentralWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $data = $request->all();
        
        // Procesar el webhook de RingCentral
        // La estructura depende de cómo RingCentral envía los datos
        
        $llamada = Llamada::create([
            'direction' => $data['direction'] ?? 'Inbound', // 'Inbound' o 'Outbound'
            'telefono' => $this->extraerTelefono($data),
            'status' => $data['status'] ?? 'ringing',
            'ringcentral_data' => $data,
            'created_at' => now()
        ]);

        // Buscar cliente por teléfono
        $cliente = $this->buscarClientePorTelefono($llamada->telefono);
        if ($cliente) {
            $llamada->cliente_id = $cliente->id;
            $llamada->save();
        }

        return response()->json(['success' => true]);
    }

    private function extraerTelefono($data)
    {
        // Extraer el número de teléfono del webhook
        // Ajusta según la estructura que envía RingCentral
        return $data['from']['phoneNumber'] 
            ?? $data['to']['phoneNumber']
            ?? $data['phoneNumber']
            ?? null;
    }

    private function buscarClientePorTelefono($telefono)
    {
        // Buscar cliente en tu base de datos
        return \App\Models\Cliente::where('telefono', $telefono)
            ->orWhere('telefono_alternativo', $telefono)
            ->first();
    }
}
```

---

### OPCIÓN B: Usar WebSockets (Más Complejo pero en Tiempo Real)

#### 1. Configurar Broadcasting en Laravel

```php
// config/broadcasting.php
'connections' => [
    'pusher' => [
        'driver' => 'pusher',
        'key' => env('PUSHER_APP_KEY'),
        'secret' => env('PUSHER_APP_SECRET'),
        'app_id' => env('PUSHER_APP_ID'),
        'options' => [
            'cluster' => env('PUSHER_APP_CLUSTER'),
            'host' => env('PUSHER_APP_HOST'),
            'port' => env('PUSHER_APP_PORT', 6001),
            'scheme' => env('PUSHER_APP_SCHEME', 'http'),
        ],
    ],
],
```

#### 2. Crear el Evento

```php
// app/Events/LlamadaEntrante.php
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LlamadaEntrante implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $llamada;
    public $cliente;

    public function __construct($llamada, $cliente = null)
    {
        $this->llamada = $llamada;
        $this->cliente = $cliente;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('llamadas');
        // O canal público: return new Channel('llamadas');
    }

    public function broadcastAs()
    {
        return 'LlamadaEntrante';
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->llamada['id'],
            'direction' => $this->llamada['direction'],
            'telefono' => $this->llamada['telefono'],
            'status' => $this->llamada['status'],
            'start_time' => $this->llamada['start_time'],
            'cliente_id' => $this->cliente?->id,
            'cliente' => $this->cliente ? [
                'id' => $this->cliente->id,
                'nombre' => $this->cliente->nombre,
                // ... más campos
            ] : null
        ];
    }
}
```

#### 3. Emitir el evento cuando recibas el webhook

```php
// En RingCentralWebhookController
use App\Events\LlamadaEntrante;

public function handle(Request $request)
{
    // ... procesar webhook ...
    
    // Emitir evento
    broadcast(new LlamadaEntrante($llamadaData, $cliente));
    
    return response()->json(['success' => true]);
}
```

---

## ✅ Checklist de Verificación

- [ ] El botón de estado muestra "Conectado"
- [ ] El endpoint `GET /api/llamadas/activas` existe y retorna datos
- [ ] Laravel está recibiendo webhooks de RingCentral
- [ ] Los webhooks se están procesando correctamente
- [ ] Las llamadas se están guardando o emitiendo
- [ ] La consola del navegador muestra logs de polling
- [ ] El componente de diagnóstico no muestra errores

---

## 🐛 Problemas Comunes

### "No se detectan las llamadas"

1. **Verifica que Laravel esté recibiendo webhooks:**
   - Revisa los logs de Laravel
   - Agrega logs en el controlador de webhooks

2. **Verifica el endpoint de polling:**
   - Abre el componente de diagnóstico
   - Prueba manualmente: `GET /api/llamadas/activas`

3. **Verifica la consola del navegador:**
   - Debe mostrar logs cada 2 segundos
   - Si hay errores, aparecerán ahí

### "El botón muestra 'Desconectado'"

- Verifica que tengas token de autenticación
- Intenta hacer clic en el botón verde para conectar manualmente
- Revisa la consola para errores

### "El endpoint retorna 404"

- El endpoint `GET /api/llamadas/activas` no está implementado
- Necesitas crearlo en Laravel (ver código arriba)

---

## 📝 Notas Importantes

1. **La aplicación de RingCentral en los teléfonos NO es necesaria** para que funcione este sistema. El sistema funciona con webhooks del servidor de RingCentral.

2. **El sistema funciona así:**
   - RingCentral (servidor) → Webhook → Laravel → Frontend
   - NO es: RingCentral (app móvil) → Frontend

3. **Si los funcionarios tienen la app de RingCentral instalada**, eso es independiente. El sistema necesita que el servidor de RingCentral envíe webhooks a Laravel.

---

## 🔗 Recursos

- [Laravel Broadcasting](https://laravel.com/docs/broadcasting)
- [RingCentral Webhooks](https://developers.ringcentral.com/guide/webhooks)
- [Laravel WebSockets](https://beyondco.de/docs/laravel-websockets)

