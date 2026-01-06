/**
 * Servicio para interactuar con la API Laravel del ERP
 * Específicamente para buscar información de clientes por número de teléfono
 */

import apiRequest from './api';

/**
 * Busca un cliente en el ERP por número de teléfono
 * @param {string} phoneNumber - Número de teléfono a buscar
 * @returns {Promise<Object>} - Datos del cliente encontrado
 */
export const buscarCliente = async (phoneNumber) => {
  try {
    // Limpiar el número de teléfono (remover caracteres especiales)
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    
    const response = await apiRequest('/api/buscar-cliente', 'POST', {
      telefono: cleanPhone
    });

    return {
      success: true,
      cliente: response.data || response,
      encontrado: true
    };
  } catch (error) {
    // Si el cliente no se encuentra (404), retornar un objeto indicando que no se encontró
    if (error.response?.status === 404) {
      return {
        success: true,
        cliente: null,
        encontrado: false,
        telefono: phoneNumber
      };
    }

    // Para otros errores, lanzar la excepción
    throw error;
  }
};

/**
 * Crea un nuevo cliente en el ERP
 * @param {Object} clienteData - Datos del cliente a crear
 * @returns {Promise<Object>} - Cliente creado
 */
export const crearCliente = async (clienteData) => {
  try {
    const response = await apiRequest('/api/clientes', 'POST', clienteData);
    return {
      success: true,
      cliente: response.data || response
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Obtiene el historial de compras de un cliente
 * @param {number} clienteId - ID del cliente
 * @returns {Promise<Array>} - Historial de compras
 */
export const obtenerHistorialCompras = async (clienteId) => {
  try {
    const response = await apiRequest(`/api/clientes/${clienteId}/compras`, 'GET');
    return response.data || response || [];
  } catch (error) {
    // Si no hay historial, retornar array vacío
    if (error.response?.status === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Obtiene las notas importantes de un cliente
 * @param {number} clienteId - ID del cliente
 * @returns {Promise<Array>} - Notas del cliente
 */
export const obtenerNotasCliente = async (clienteId) => {
  try {
    const response = await apiRequest(`/api/clientes/${clienteId}/notas`, 'GET');
    return response.data || response || [];
  } catch (error) {
    // Si no hay notas, retornar array vacío
    if (error.response?.status === 404) {
      return [];
    }
    throw error;
  }
};

