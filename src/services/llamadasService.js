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
const BROADCAST_DRIVER = import.meta.env.VITE_BROADCAST_DRIVER || 'pusher';
const PUSHER_APP_KEY = import.meta.env.VITE_PUSHER_APP_KEY || '';
const PUSHER_APP_CLUSTER = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'us2';
const PUSHER_APP_HOST = import.meta.env.VITE_PUSHER_APP_HOST || '';
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
    this.pollingIntervalMs = 2000; // 2 segundos
  }

  /**
   * Inicializa Laravel Echo si está configurado
   */
  async initializeEcho() {
    try {
      // Verificar si tenemos las configuraciones necesarias
      if (!PUSHER_APP_KEY && !PUSHER_APP_HOST) {
        console.warn('⚠️ Laravel Echo no configurado. Usando polling como fallback.');
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

      // Determinar la URL del servidor
      let host = PUSHER_APP_HOST || `ws-${PUSHER_APP_CLUSTER}.pusher.com`;
      let wsPort = PUSHER_APP_PORT || '6001';
      let wsProtocol = PUSHER_APP_USE_TLS ? 'wss' : 'ws';
      let httpProtocol = PUSHER_APP_USE_TLS ? 'https' : 'http';

      // Si es un servidor personalizado (Laravel WebSockets o Soketi)
      let authEndpoint = `${API_BASE_URL}/broadcasting/auth`;
      let wsHost = PUSHER_APP_HOST ? `${wsProtocol}://${PUSHER_APP_HOST}:${wsPort}` : undefined;

      // Configurar Echo
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

      // Si hay un host personalizado, agregarlo
      if (PUSHER_APP_HOST) {
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
   */
  startPolling() {
    if (this.isPolling) {
      return; // Ya está haciendo polling
    }

    console.log('🔄 Iniciando polling cada 2 segundos...');
    this.isPolling = true;
    this.useEcho = false;

    // Hacer la primera consulta inmediatamente
    this.pollLlamadasActivas();

    // Configurar intervalo
    this.pollingInterval = setInterval(() => {
      this.pollLlamadasActivas();
    }, this.pollingIntervalMs);

    this.isConnected = true;
    this.emit('connected', { method: 'polling' });
  }

  /**
   * Consulta el endpoint de llamadas activas
   */
  async pollLlamadasActivas() {
    try {
      const response = await apiRequest('/api/llamadas/activas', 'GET');
      
      if (response.data && Array.isArray(response.data)) {
        // Procesar cada llamada activa
        response.data.forEach(llamada => {
          this.handleLlamadaEvent(llamada);
        });
      } else if (response.llamada) {
        // Si retorna una sola llamada
        this.handleLlamadaEvent(response.llamada);
      }
    } catch (error) {
      // Si el endpoint no existe o hay error, no hacer nada
      // Solo loguear en desarrollo
      if (import.meta.env.DEV) {
        console.warn('⚠️ Error al consultar llamadas activas:', error.message);
      }
    }
  }

  /**
   * Maneja eventos de llamadas recibidos
   */
  handleLlamadaEvent(data) {
    // Normalizar el formato del evento
    const llamadaData = {
      id: data.id || data.llamada_id || Date.now(),
      direction: data.direction || data.tipo || 'Inbound',
      phoneNumber: data.telefono || data.phone_number || data.numero || data.from || data.to,
      status: data.status || data.estado || 'active',
      startTime: data.start_time || data.created_at || data.fecha || new Date().toISOString(),
      clienteId: data.cliente_id || null,
      cliente: data.cliente || null,
      raw: data // Guardar datos originales
    };

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
      clearInterval(this.pollingInterval);
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

