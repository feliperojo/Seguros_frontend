/**
 * Servicio para recibir eventos de llamadas desde Laravel
 * Soporta dos modos:
 * 1. Laravel Echo (WebSockets) - Modo preferido
 * 2. Polling - Fallback cada 2 segundos
 */

import apiRequest from './api';

// Importaciones dinámicas para evitar errores en build si no están instaladas
let Echo = null;
let Pusher = null;

// Función para cargar dinámicamente las dependencias de Echo
const loadEchoDependencies = async () => {
  if (Echo && Pusher) {
    return { Echo, Pusher };
  }

  try {
    // Intentar cargar las dependencias dinámicamente
    const echoModule = await import('laravel-echo');
    const pusherModule = await import('pusher-js');
    
    Echo = echoModule.default || echoModule;
    Pusher = pusherModule.default || pusherModule;
    
    return { Echo, Pusher };
  } catch (error) {
    console.warn('⚠️ Laravel Echo no está disponible:', error.message);
    return null;
  }
};

// Configuración desde variables de entorno
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const rawDriver = import.meta.env.VITE_BROADCAST_DRIVER;
const BROADCAST_DRIVER = (typeof rawDriver === 'string' && rawDriver.trim() !== '')
  ? rawDriver.trim().toLowerCase()
  : 'pusher';
const isPusherCloud = BROADCAST_DRIVER === 'pusher';
const PUSHER_APP_KEY = import.meta.env.VITE_PUSHER_APP_KEY || '';
const PUSHER_APP_CLUSTER = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'us2';
const PUSHER_APP_HOST = import.meta.env.VITE_PUSHER_APP_HOST || import.meta.env.VITE_PUSHER_HOST || import.meta.env.VITE_REVERB_HOST || '';
const PUSHER_APP_PORT = import.meta.env.VITE_PUSHER_APP_PORT || '6001';
const PUSHER_APP_USE_TLS = import.meta.env.VITE_PUSHER_APP_USE_TLS === 'true';

class LlamadasService {
  constructor() {
    this.echo = null;
    this.pollingInterval = null;
    this.isPolling = false;
    this.eventHandlers = new Map();
    this.useEcho = false;
    this.isConnected = false;
    this.pollingIntervalMs = 3000; // 3 segundos (recomendado)
    this.llamadasAnteriores = []; // Para detectar nuevas llamadas
    this.hayLlamadasActivas = false; // Para optimizar polling
  }

  /**
   * Inicializa Laravel Echo si está configurado
   */
  async initializeEcho() {
    try {
      if (!PUSHER_APP_KEY) {
        console.warn('⚠️ Laravel Echo no configurado (falta VITE_PUSHER_APP_KEY). Usando polling como fallback.');
        return false;
      }
      if (!isPusherCloud && !PUSHER_APP_HOST) {
        console.warn('⚠️ Laravel Echo (Reverb/self-host): falta host. Usando polling como fallback.');
        return false;
      }

      // Cargar dependencias dinámicamente
      const deps = await loadEchoDependencies();
      if (!deps) {
        console.warn('⚠️ No se pudieron cargar las dependencias de Laravel Echo. Usando polling.');
        return false;
      }

      const { Echo: EchoClass, Pusher: PusherClass } = deps;

      // Configurar Pusher
      window.Pusher = PusherClass;

      let wsPort = PUSHER_APP_PORT || '6001';
      let authEndpoint = `${API_BASE_URL}/broadcasting/auth`;

      const echoConfig = {
        broadcaster: BROADCAST_DRIVER,
        key: PUSHER_APP_KEY,
        cluster: PUSHER_APP_CLUSTER,
        encrypted: PUSHER_APP_USE_TLS,
        disableStats: true,
        enabledTransports: ['ws', 'wss'],
        authEndpoint: authEndpoint,
        auth: {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`
          }
        }
      };

      // Pusher Cloud: no setear wsHost/wsPort/wssPort. Reverb/self-host: sí
      if (!isPusherCloud && PUSHER_APP_HOST) {
        echoConfig.wsHost = PUSHER_APP_HOST;
        echoConfig.wsPort = wsPort;
        echoConfig.wssPort = wsPort;
      }

      // Usar EchoClass que ya cargamos
      this.echo = new EchoClass(echoConfig);

      this.useEcho = true;
      console.log('✅ Laravel Echo inicializado');
      return true;
    } catch (error) {
      console.error('❌ Error al inicializar Laravel Echo:', error);
      return false;
    }
  }

  /**
   * Conecta al servicio (Echo o Polling)
   */
  async connect() {
    // Intentar usar Echo primero
    const echoInitialized = await this.initializeEcho();
    if (echoInitialized) {
      try {
        await this.connectEcho();
      } catch (error) {
        console.warn('⚠️ Error al conectar Echo, usando polling:', error);
        this.startPolling();
      }
    } else {
      // Usar polling como fallback
      this.startPolling();
    }
  }

  /**
   * Conecta usando Laravel Echo
   */
  async connectEcho() {
    if (!this.echo) {
      throw new Error('Echo no está inicializado');
    }

    try {
      // Obtener el token de autenticación
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      // Suscribirse al canal privado del usuario
      // Laravel emite eventos en el canal 'llamadas' o canal privado del usuario
      // Intentar canal privado primero, luego público como fallback
      const channelName = 'llamadas'; // Ajusta según tu configuración de Laravel
      
      try {
        // Canal privado (requiere autenticación)
        this.echo.private(channelName)
          .listen('.LlamadaEntrante', (data) => {
            console.log('📞 Evento LlamadaEntrante recibido:', data);
            this.handleLlamadaEvent(data);
          })
          .listen('.LlamadaSaliente', (data) => {
            console.log('📞 Evento LlamadaSaliente recibido:', data);
            this.handleLlamadaEvent(data);
          })
          .listen('.LlamadaFinalizada', (data) => {
            console.log('📞 Evento LlamadaFinalizada recibido:', data);
            this.handleLlamadaEvent(data);
          });
      } catch (error) {
        console.warn('⚠️ No se pudo suscribir al canal privado, intentando canal público:', error);
        
        // Canal público como fallback
        this.echo.channel(channelName)
          .listen('.LlamadaEntrante', (data) => {
            console.log('📞 Evento LlamadaEntrante (público) recibido:', data);
            this.handleLlamadaEvent(data);
          })
          .listen('.LlamadaSaliente', (data) => {
            console.log('📞 Evento LlamadaSaliente (público) recibido:', data);
            this.handleLlamadaEvent(data);
          });
      }

      this.isConnected = true;
      this.emit('connected', { method: 'echo' });
      console.log('✅ Conectado a Laravel Echo');
    } catch (error) {
      console.error('❌ Error al conectar Echo:', error);
      // Fallback a polling
      this.startPolling();
      throw error;
    }
  }

  /**
   * Inicia el polling como fallback
   * Optimizado para reducir frecuencia cuando no hay llamadas
   */
  startPolling() {
    if (this.isPolling) {
      return; // Ya está haciendo polling
    }

    console.log('🔄 Iniciando polling inteligente...');
    this.isPolling = true;
    this.useEcho = false;

    // Hacer la primera consulta inmediatamente
    this.pollLlamadasActivas();

    // Configurar intervalo adaptativo
    this.startAdaptivePolling();

    this.isConnected = true;
    this.emit('connected', { method: 'polling' });
  }

  /**
   * Inicia polling adaptativo que cambia la frecuencia según haya llamadas
   * Si hay llamadas activas: cada 3 segundos
   * Si no hay llamadas: cada 10 segundos (para ahorrar recursos)
   */
  startAdaptivePolling() {
    // Limpiar cualquier polling anterior
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }

    const poll = () => {
      if (!this.isPolling) {
        return; // Detener si ya no estamos en modo polling
      }

      this.pollLlamadasActivas();
      
      // Re-programar con intervalo adaptativo
      const interval = this.hayLlamadasActivas ? 3000 : 10000;
      
      this.pollingInterval = setTimeout(poll, interval);
    };

    // Iniciar el primer ciclo
    poll();
  }

  /**
   * Consulta el endpoint de llamadas activas de RingCentral
   * Este endpoint ya identifica automáticamente los clientes
   * Optimizado para reducir logs innecesarios
   */
  async pollLlamadasActivas() {
    try {
      const response = await apiRequest('/ringcentral/identificar-llamadas-activas', 'GET');
      
      if (response.success && response.data && Array.isArray(response.data)) {
        const hayLlamadas = response.data.length > 0;
        const llamadasAnteriores = this.llamadasAnteriores || [];
        const habiaLlamadas = llamadasAnteriores.length > 0;
        
        // Detectar nuevas llamadas comparando con las anteriores
        const nuevasLlamadas = response.data.filter(nueva => {
          // Una llamada es nueva si no existe en las anteriores
          return !llamadasAnteriores.some(anterior => 
            (anterior.extension_id || anterior.extensionId) === (nueva.extension_id || nueva.extensionId) &&
            (anterior.phone_number || anterior.phoneNumber) === (nueva.phone_number || nueva.phoneNumber) &&
            (anterior.timestamp || anterior.start_time) === (nueva.timestamp || nueva.start_time)
          );
        });
        
        // Actualizar estado para polling adaptativo
        const estadoAnterior = this.hayLlamadasActivas;
        this.hayLlamadasActivas = hayLlamadas;
        
        // Si cambió el estado (de sin llamadas a con llamadas o viceversa), re-programar polling
        if (estadoAnterior !== hayLlamadas) {
          console.log(`🔄 Cambio de estado: ${hayLlamadas ? 'Llamadas activas detectadas' : 'No hay llamadas activas'}`);
          // Re-programar con nuevo intervalo
          this.startAdaptivePolling();
        }
        
        // Solo loguear si hay llamadas o si cambió el estado
        if (hayLlamadas || habiaLlamadas !== hayLlamadas) {
          console.log(`🔄 Polling: ${response.total || response.data.length} llamada(s) activa(s)`);
        }
        
        // Procesar todas las llamadas activas
        response.data.forEach(llamada => {
          this.handleLlamadaEvent(llamada);
        });
        
        // Si hay nuevas llamadas, emitir evento especial
        if (nuevasLlamadas.length > 0) {
          nuevasLlamadas.forEach(llamada => {
            console.log('🆕 Nueva llamada detectada:', {
              extension: llamada.extension_name || llamada.extensionName,
              telefono: llamada.phone_number || llamada.phoneNumber,
              cliente: llamada.cliente_encontrado ? (llamada.cliente?.nombre_completo || llamada.cliente?.nombre) : 'No encontrado'
            });
            this.emit('nueva-llamada', llamada);
          });
        }
        
        // Guardar llamadas actuales para la próxima comparación
        this.llamadasAnteriores = response.data;
      } else if (response.success && response.data && response.data.length === 0) {
        // Actualizar estado para polling adaptativo
        const estadoAnterior = this.hayLlamadasActivas;
        this.hayLlamadasActivas = false;
        
        // Si había llamadas antes y ahora no, re-programar polling
        if (estadoAnterior && !this.hayLlamadasActivas) {
          console.log('ℹ️ No hay llamadas activas - Cambiando a polling lento');
          this.startAdaptivePolling();
        }
        
        // Solo limpiar si había llamadas antes
        if (this.llamadasAnteriores && this.llamadasAnteriores.length > 0) {
          this.llamadasAnteriores = [];
        }
      } else {
        console.warn('⚠️ Respuesta inesperada del endpoint:', response);
      }
    } catch (error) {
      // Solo loguear errores importantes
      if (error.response?.status !== 404) {
        console.warn('⚠️ Error al consultar llamadas activas:', error.message);
      }
      
      // Si es 404, el endpoint no existe
      if (error.response?.status === 404) {
        console.warn('⚠️ El endpoint /ringcentral/identificar-llamadas-activas no está implementado');
      }
    }
  }

  /**
   * Maneja eventos de llamadas recibidos
   * El formato viene directamente del endpoint de RingCentral
   */
  handleLlamadaEvent(data) {
    // Normalizar el formato del evento (el endpoint ya viene con formato correcto)
    const llamadaData = {
      id: `${data.extension_id || data.extensionId || 'unknown'}-${data.phone_number || data.phoneNumber || 'unknown'}-${data.timestamp || Date.now()}`,
      extensionId: data.extension_id || data.extensionId || null,
      extensionName: data.extension_name || data.extensionName || data.extension_name || 'Desconocida',
      extensionNumber: data.extension_number || data.extensionNumber || data.extension_number || 'N/A',
      direction: data.direction || 'Inbound', // 'Inbound' o 'Outbound'
      phoneNumber: data.phone_number || data.phoneNumber || data.telefono || 'N/A',
      status: data.status || 'Ringing', // 'Ringing', 'CallConnected', 'OnHold'
      startTime: data.timestamp || data.start_time || data.created_at || new Date().toISOString(),
      clienteEncontrado: data.cliente_encontrado !== undefined ? data.cliente_encontrado : (data.cliente ? true : false),
      clienteId: data.cliente?.id || data.cliente_id || null,
      cliente: data.cliente || null,
      raw: data // Guardar datos originales completos para debugging
    };

    // Solo loguear si hay información relevante
    if (llamadaData.phoneNumber !== 'N/A' || llamadaData.clienteEncontrado) {
      console.log('📞 Llamada detectada:', {
        extension: `${llamadaData.extensionName} (${llamadaData.extensionNumber})`,
        telefono: llamadaData.phoneNumber,
        direccion: llamadaData.direction,
        estado: llamadaData.status,
        cliente: llamadaData.clienteEncontrado ? llamadaData.cliente?.nombre_completo || llamadaData.cliente?.nombre : 'No encontrado'
      });
    }

    // Emitir evento
    this.emit('llamada', llamadaData);
  }

  /**
   * Registra un handler para eventos
   */
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  /**
   * Remueve un handler de eventos
   */
  off(eventType, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emite un evento a todos los handlers registrados
   */
  emit(eventType, data) {
    if (this.eventHandlers.has(eventType)) {
      this.eventHandlers.get(eventType).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error en handler de evento ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Desconecta el servicio
   */
  disconnect() {
    // Detener polling
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
    }

    // Desconectar Echo
    if (this.echo) {
      try {
        this.echo.disconnect();
      } catch (error) {
        console.error('Error al desconectar Echo:', error);
      }
      this.echo = null;
    }

    this.isConnected = false;
    this.eventHandlers.clear();
    console.log('🔌 Desconectado del servicio de llamadas');
  }

  /**
   * Verifica el estado de la conexión
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      method: this.useEcho ? 'echo' : 'polling',
      isPolling: this.isPolling
    };
  }
}

// Exportar una instancia singleton
const llamadasService = new LlamadasService();

export default llamadasService;

