/**
 * Servicio para configuración global del sistema (tabla system_config).
 * GET  /api/v1/system-config         → listar todas las claves
 * GET  /api/v1/system-config/{key}  → obtener una clave (valor casteado)
 * PUT  /api/v1/system-config/{key}  → crear o actualizar una clave
 */

import apiRequest from "./api";

const BASE = "/v1/system-config";

/**
 * Lista todas las claves de configuración.
 * @returns {Promise<Array<{ key: string, value: string, type: string }>>}
 */
export async function getAll() {
  const response = await apiRequest(BASE, "GET");
  const data = response?.data ?? response;
  return Array.isArray(data) ? data : [];
}

/**
 * Obtiene una clave (valor ya casteado por el backend).
 * @param {string} key
 * @returns {Promise<*>}
 */
export async function get(key) {
  const response = await apiRequest(`${BASE}/${encodeURIComponent(key)}`, "GET");
  return response?.data ?? response?.value ?? response;
}

/**
 * Crea o actualiza una clave.
 * Tabla system_config: key, value (text), type (int|bool|json|string).
 * @param {string} key
 * @param {*} value - valor según type (number para int, boolean para bool, objeto para json, string para string)
 * @param {string} [type='string'] - 'int' | 'bool' | 'json' | 'string'
 * @returns {Promise<Object>}
 */
export async function put(key, value, type = "string") {
  const body = { value, type };
  return apiRequest(`${BASE}/${encodeURIComponent(key)}`, "PUT", body);
}

/**
 * Verifica que la contraseña ingresada sea la del usuario super admin (system_config super_user_id).
 * El backend debe validar contra el usuario configurado como super admin.
 * @param {string} password
 * @returns {Promise<void>} Resuelve si es correcta; lanza si es incorrecta
 */
export async function verifySuperAdminPassword(password) {
  await apiRequest(`${BASE}/verify-super-admin-password`, "POST", { password });
}

const systemConfigService = { getAll, get, put, verifySuperAdminPassword };
export default systemConfigService;
