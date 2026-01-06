/**
 * Servicio para interactuar con la API de RingCentral
 * Maneja autenticación OAuth 2.0, suscripciones y eventos en tiempo real
 */

import {
  RINGCENTRAL_ENVIRONMENTS,
  RINGCENTRAL_ENDPOINTS,
  STORAGE_KEYS,
  TOKEN_EXPIRY_BUFFER,
  RETRY_CONFIG
} from '../utils/constants';

class RingCentralService {
  constructor() {
    this.baseURL = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.subscriptionId = null;
    this.webSocket = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.eventHandlers = new Map();
  }

  /**
   * Inicializa el servicio con las credenciales guardadas
   */
  initialize() {
    const environment = localStorage.getItem(STORAGE_KEYS.RC_ENVIRONMENT) || 'sandbox';
    this.baseURL = RINGCENTRAL_ENVIRONMENTS[environment] || RINGCENTRAL_ENVIRONMENTS.sandbox;
    
    this.accessToken = localStorage.getItem(STORAGE_KEYS.RC_ACCESS_TOKEN);
    this.refreshToken = localStorage.getItem(STORAGE_KEYS.RC_REFRESH_TOKEN);
    const expiry = localStorage.getItem(STORAGE_KEYS.RC_TOKEN_EXPIRY);
    this.tokenExpiry = expiry ? parseInt(expiry, 10) : null;
    this.subscriptionId = localStorage.getItem(STORAGE_KEYS.RC_SUBSCRIPTION_ID);
  }

  /**
   * Obtiene las credenciales desde localStorage
   */
  getCredentials() {
    return {
      clientId: localStorage.getItem(STORAGE_KEYS.RC_CLIENT_ID),
      clientSecret: localStorage.getItem(STORAGE_KEYS.RC_CLIENT_SECRET),
      environment: localStorage.getItem(STORAGE_KEYS.RC_ENVIRONMENT) || 'sandbox'
    };
  }

  /**
   * Guarda las credenciales en localStorage
   */
  saveCredentials(clientId, clientSecret, environment = 'sandbox') {
    localStorage.setItem(STORAGE_KEYS.RC_CLIENT_ID, clientId);
    localStorage.setItem(STORAGE_KEYS.RC_CLIENT_SECRET, clientSecret);
    localStorage.setItem(STORAGE_KEYS.RC_ENVIRONMENT, environment);
    this.baseURL = RINGCENTRAL_ENVIRONMENTS[environment] || RINGCENTRAL_ENVIRONMENTS.sandbox;
  }

  /**
   * Verifica si el token está expirado o próximo a expirar
   */
  isTokenExpired() {
    if (!this.tokenExpiry) return true;
    const now = Math.floor(Date.now() / 1000);
    return now >= (this.tokenExpiry - TOKEN_EXPIRY_BUFFER);
  }

  /**
   * Autenticación OAuth 2.0 - Flujo de credenciales de aplicación
   * Para producción, deberías usar el flujo de autorización con redirect
   */
  async authenticate(username, password, extension = '') {
    const credentials = this.getCredentials();
    
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new Error('Las credenciales de RingCentral no están configuradas');
    }

    const url = `${this.baseURL}${RINGCENTRAL_ENDPOINTS.TOKEN}`;
    
    const body = new URLSearchParams();
    body.append('grant_type', 'password');
    body.append('username', username);
    body.append('password', password);
    if (extension) {
      body.append('extension', extension);
    }

    const auth = btoa(`${credentials.clientId}:${credentials.clientSecret}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`
        },
        body: body.toString()
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Error en la autenticación');
      }

      // Guardar tokens
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiry = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);

      localStorage.setItem(STORAGE_KEYS.RC_ACCESS_TOKEN, this.accessToken);
      localStorage.setItem(STORAGE_KEYS.RC_REFRESH_TOKEN, this.refreshToken);
      localStorage.setItem(STORAGE_KEYS.RC_TOKEN_EXPIRY, this.tokenExpiry.toString());

      return data;
    } catch (error) {
      console.error('Error en autenticación RingCentral:', error);
      throw error;
    }
  }

  /**
   * Refresca el token de acceso usando el refresh token
   */
  async refreshAccessToken() {
    const credentials = this.getCredentials();
    
    if (!this.refreshToken || !credentials.clientId || !credentials.clientSecret) {
      throw new Error('No se puede refrescar el token. Credenciales faltantes.');
    }

    const url = `${this.baseURL}${RINGCENTRAL_ENDPOINTS.TOKEN}`;
    
    const body = new URLSearchParams();
    body.append('grant_type', 'refresh_token');
    body.append('refresh_token', this.refreshToken);

    const auth = btoa(`${credentials.clientId}:${credentials.clientSecret}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`
        },
        body: body.toString()
      });

      const data = await response.json();

      if (!response.ok) {
        // Si el refresh token es inválido, limpiar todo
        this.logout();
        throw new Error(data.error_description || 'Token de refresco inválido');
      }

      // Actualizar tokens
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiry = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);

      localStorage.setItem(STORAGE_KEYS.RC_ACCESS_TOKEN, this.accessToken);
      localStorage.setItem(STORAGE_KEYS.RC_REFRESH_TOKEN, this.refreshToken);
      localStorage.setItem(STORAGE_KEYS.RC_TOKEN_EXPIRY, this.tokenExpiry.toString());

      return data;
    } catch (error) {
      console.error('Error al refrescar token RingCentral:', error);
      throw error;
    }
  }

  /**
   * Asegura que tenemos un token válido (refresca si es necesario)
   */
  async ensureValidToken() {
    if (!this.accessToken) {
      throw new Error('No hay token de acceso. Por favor, autentícate primero.');
    }

    if (this.isTokenExpired()) {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        throw new Error('No se pudo refrescar el token. Por favor, autentícate nuevamente.');
      }
    }
  }

  /**
   * Realiza una petición autenticada a la API de RingCentral
   */
  async apiRequest(endpoint, method = 'GET', body = null) {
    await this.ensureValidToken();

    const url = `${this.baseURL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error_description || `Error ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Error en petición RingCentral:', error);
      throw error;
    }
  }

  /**
   * Crea una suscripción para recibir eventos en tiempo real
   */
  async createSubscription(eventFilters) {
    try {
      await this.ensureValidToken();

      // Primero, obtener la URL del WebSocket desde el endpoint de subscription
      const subscriptionData = {
        eventFilters: eventFilters,
        deliveryMode: {
          transportType: 'WebSocket'
        }
      };

      const response = await this.apiRequest(
        RINGCENTRAL_ENDPOINTS.SUBSCRIPTION,
        'POST',
        subscriptionData
      );

      this.subscriptionId = response.id;
      localStorage.setItem(STORAGE_KEYS.RC_SUBSCRIPTION_ID, this.subscriptionId);

      // Conectar al WebSocket
      if (response.deliveryMode?.address) {
        await this.connectWebSocket(response.deliveryMode.address);
      }

      return response;
    } catch (error) {
      console.error('Error al crear suscripción:', error);
      throw error;
    }
  }

  /**
   * Conecta al WebSocket de RingCentral para recibir eventos en tiempo real
   */
  async connectWebSocket(wsUrl) {
    return new Promise((resolve, reject) => {
      try {
        // Agregar el token de acceso a la URL del WebSocket
        const urlWithToken = `${wsUrl}?access_token=${this.accessToken}`;
        this.webSocket = new WebSocket(urlWithToken);

        this.webSocket.onopen = () => {
          console.log('✅ WebSocket conectado a RingCentral');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.webSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error('Error al parsear mensaje WebSocket:', error);
          }
        };

        this.webSocket.onerror = (error) => {
          console.error('❌ Error en WebSocket:', error);
          reject(error);
        };

        this.webSocket.onclose = () => {
          console.log('⚠️ WebSocket desconectado');
          this.webSocket = null;
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Maneja los mensajes recibidos del WebSocket
   */
  handleWebSocketMessage(data) {
    // RingCentral envía eventos en el formato:
    // { type: 'ServerNotification', body: { ... } }
    if (data.type === 'ServerNotification' && data.body) {
      const event = data.body;
      
      // Emitir evento a los handlers registrados
      this.emit('telephony', event);
      
      // También emitir eventos específicos según el tipo
      if (event.eventType) {
        this.emit(event.eventType, event);
      }
    }
  }

  /**
   * Intenta reconectar el WebSocket
   */
  attemptReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= RETRY_CONFIG.MAX_RETRIES) {
      console.error('❌ Máximo de intentos de reconexión alcanzado');
      this.emit('connection_lost', null);
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Intentando reconectar (${this.reconnectAttempts}/${RETRY_CONFIG.MAX_RETRIES})...`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        // Recrear la suscripción
        const eventFilters = [
          `${RINGCENTRAL_ENDPOINTS.TELEPHONY_SESSIONS}?direction=Inbound`,
          `${RINGCENTRAL_ENDPOINTS.TELEPHONY_SESSIONS}?direction=Outbound`
        ];
        await this.createSubscription(eventFilters);
      } catch (error) {
        console.error('Error al reconectar:', error);
        this.attemptReconnect();
      }
    }, RETRY_CONFIG.RECONNECT_DELAY);
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
   * Renueva la suscripción existente
   */
  async renewSubscription() {
    if (!this.subscriptionId) {
      throw new Error('No hay suscripción activa');
    }

    try {
      await this.ensureValidToken();
      const response = await this.apiRequest(
        `${RINGCENTRAL_ENDPOINTS.SUBSCRIPTION}/${this.subscriptionId}`,
        'PUT',
        {
          eventFilters: [
            `${RINGCENTRAL_ENDPOINTS.TELEPHONY_SESSIONS}?direction=Inbound`,
            `${RINGCENTRAL_ENDPOINTS.TELEPHONY_SESSIONS}?direction=Outbound`
          ]
        }
      );
      return response;
    } catch (error) {
      console.error('Error al renovar suscripción:', error);
      throw error;
    }
  }

  /**
   * Elimina la suscripción
   */
  async removeSubscription() {
    if (!this.subscriptionId) {
      return;
    }

    try {
      await this.apiRequest(
        `${RINGCENTRAL_ENDPOINTS.SUBSCRIPTION}/${this.subscriptionId}`,
        'DELETE'
      );
    } catch (error) {
      console.error('Error al eliminar suscripción:', error);
    } finally {
      this.subscriptionId = null;
      localStorage.removeItem(STORAGE_KEYS.RC_SUBSCRIPTION_ID);
    }
  }

  /**
   * Cierra la conexión WebSocket
   */
  closeWebSocket() {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Cierra sesión y limpia todos los datos
   */
  async logout() {
    this.closeWebSocket();
    
    if (this.subscriptionId) {
      try {
        await this.removeSubscription();
      } catch (error) {
        console.error('Error al eliminar suscripción durante logout:', error);
      }
    }

    // Limpiar tokens
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.subscriptionId = null;

    localStorage.removeItem(STORAGE_KEYS.RC_ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.RC_REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.RC_TOKEN_EXPIRY);
    localStorage.removeItem(STORAGE_KEYS.RC_SUBSCRIPTION_ID);

    this.eventHandlers.clear();
  }

  /**
   * Verifica el estado de la conexión
   */
  isConnected() {
    return this.webSocket && this.webSocket.readyState === WebSocket.OPEN;
  }

  /**
   * Verifica si está autenticado
   */
  isAuthenticated() {
    return !!this.accessToken && !this.isTokenExpired();
  }
}

// Exportar una instancia singleton
const ringCentralService = new RingCentralService();
ringCentralService.initialize();

export default ringCentralService;

