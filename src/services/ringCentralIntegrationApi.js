/**
 * API de integración RingCentral (backend Laravel).
 * Todas las rutas bajo /api/integrations/ringcentral/ con Authorization: Bearer {token} (Sanctum).
 * @see Documentación: API RingCentral para el frontend
 */

import apiRequest from './api';

const BASE = 'integrations/ringcentral';

/**
 * Estado de la integración y eventos 24h. No requiere auth.
 * GET /api/integrations/ringcentral/health
 */
export async function getHealth() {
  return apiRequest(`${BASE}/health`, 'GET');
}

/**
 * Últimos eventos recibidos por webhook (diagnóstico). No requiere auth.
 * GET /api/integrations/ringcentral/last-events?limit=10&extension_id=...
 */
export async function getLastEvents(params = {}) {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set('limit', params.limit);
  if (params.extension_id) qs.set('extension_id', params.extension_id);
  const query = qs.toString();
  return apiRequest(`${BASE}/last-events${query ? `?${query}` : ''}`, 'GET');
}

/**
 * Resumen para dashboard: cuenta, extensiones con presencia, estadísticas. Requiere auth.
 * GET /api/integrations/ringcentral/dashboard
 */
export async function getDashboard() {
  return apiRequest(`${BASE}/dashboard`, 'GET');
}

/**
 * Lista de extensiones (selects, asignación). Requiere auth.
 * GET /api/integrations/ringcentral/extensions?type=User&per_page=250
 */
export async function getExtensions(params = {}) {
  const qs = new URLSearchParams();
  if (params.type) qs.set('type', params.type);
  if (params.per_page != null) qs.set('per_page', params.per_page);
  const query = qs.toString();
  return apiRequest(`${BASE}/extensions${query ? `?${query}` : ''}`, 'GET');
}

/**
 * Presencia de una extensión. Requiere auth.
 * GET /api/integrations/ringcentral/presence?extension_id=63011175023
 */
export async function getPresence(extensionId) {
  return apiRequest(`${BASE}/presence?extension_id=${encodeURIComponent(extensionId)}`, 'GET');
}

/**
 * Presencia de varias extensiones. Requiere auth.
 * GET /api/integrations/ringcentral/presence?extension_ids=63011175023,63015547023
 */
export async function getPresenceBulk(extensionIds) {
  const ids = Array.isArray(extensionIds) ? extensionIds.join(',') : String(extensionIds);
  return apiRequest(`${BASE}/presence?extension_ids=${encodeURIComponent(ids)}`, 'GET');
}

/**
 * Indicador "en llamada" por extensión (helper).
 * @returns {Promise<boolean>} true si telephony_status es CallConnected o Ringing
 */
export async function isExtensionInCall(extensionId) {
  const res = await getPresence(extensionId);
  const status = res?.data?.telephony_status || res?.telephony_status;
  return status === 'CallConnected' || status === 'Ringing';
}

/**
 * Historial de llamadas (call-log). Requiere auth.
 * GET /api/integrations/ringcentral/call-log?date_from=...&date_to=...&extension_id=...&direction=...&per_page=...
 */
export async function getCallLog(params = {}) {
  const qs = new URLSearchParams();
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.extension_id) qs.set('extension_id', params.extension_id);
  if (params.direction) qs.set('direction', params.direction);
  if (params.per_page != null) qs.set('per_page', params.per_page);
  const query = qs.toString();
  return apiRequest(`${BASE}/call-log${query ? `?${query}` : ''}`, 'GET');
}

/**
 * Información de la cuenta RingCentral. Requiere auth.
 * GET /api/integrations/ringcentral/account
 */
export async function getAccount() {
  return apiRequest(`${BASE}/account`, 'GET');
}

export default {
  getHealth,
  getLastEvents,
  getDashboard,
  getExtensions,
  getPresence,
  getPresenceBulk,
  isExtensionInCall,
  getCallLog,
  getAccount,
};
