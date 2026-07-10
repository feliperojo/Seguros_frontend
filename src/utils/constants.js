/**
 * Constantes para la integración con RingCentral
 */

// URLs base de RingCentral según el entorno
export const RINGCENTRAL_ENVIRONMENTS = {
  production: 'https://platform.ringcentral.com',
  sandbox: 'https://platform.devtest.ringcentral.com'
};

// Endpoints de RingCentral API
export const RINGCENTRAL_ENDPOINTS = {
  TOKEN: '/restapi/oauth/token',
  REVOKE: '/restapi/oauth/revoke',
  SUBSCRIPTION: '/restapi/v1.0/subscription',
  TELEPHONY_SESSIONS: '/restapi/v1.0/account/~/extension/~/telephony/sessions',
  EXTENSION: '/restapi/v1.0/account/~/extension/~'
};

// Estados de llamada
export const CALL_STATES = {
  IDLE: 'idle',
  INCOMING: 'incoming',
  OUTGOING: 'outgoing',
  ACTIVE: 'active',
  ENDED: 'ended',
  MISSED: 'missed'
};

// Tipos de eventos de RingCentral
export const RINGCENTRAL_EVENTS = {
  TELEPHONY_SESSION_START: '/restapi/v1.0/account/~/extension/~/telephony/session',
  PRESENCE: '/restapi/v1.0/account/~/extension/~/presence',
  MESSAGE: '/restapi/v1.0/account/~/extension/~/message-store'
};

// Configuración de reintentos
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // ms
  RECONNECT_DELAY: 5000 // ms
};

// Tiempo de expiración del token (en segundos)
export const TOKEN_EXPIRY_BUFFER = 300; // 5 minutos antes de expirar

// Claves de localStorage
export const STORAGE_KEYS = {
  RC_ACCESS_TOKEN: 'ringcentral_access_token',
  RC_REFRESH_TOKEN: 'ringcentral_refresh_token',
  RC_TOKEN_EXPIRY: 'ringcentral_token_expiry',
  RC_CLIENT_ID: 'ringcentral_client_id',
  RC_CLIENT_SECRET: 'ringcentral_client_secret',
  RC_ENVIRONMENT: 'ringcentral_environment',
  RC_SUBSCRIPTION_ID: 'ringcentral_subscription_id'
};

