import axios from 'axios';

/**
 * Service para gestionar el versionado de cambios en el sistema
 */
class HistorialVersionService {
  constructor() {
    this.baseUrl = '/api/historial';
  }

  /**
   * Guarda una nueva versión del estado actual
   * Solo necesita el estado nuevo, el backend maneja el estado anterior
   * @param {string} modelo - Nombre del modelo (ej: 'GrupoFamiliar', 'Cliente')
   * @param {number} modeloId - ID del registro
   * @param {string} accion - Tipo de acción ('create', 'update', 'delete')
   * @param {object} estadoNuevo - Nuevo estado del objeto
   * @param {string} usuario - Nombre del usuario que realizó el cambio
   * @returns {Promise} Respuesta del servidor
   */
  async guardarVersion({
    modelo,
    modeloId,
    accion = 'update',
    estadoNuevo = {},
    usuario = 'Usuario'
  }) {
    try {
      const payload = {
        modelo_afectado: modelo,
        modelo_id: modeloId,
        accion,
        estado_nuevo: estadoNuevo,
        usuario
      };

      const response = await axios.post(`${this.baseUrl}/guardar`, payload);
      return response.data;
    } catch (error) {
      console.error('Error al guardar versión:', error);
      throw error;
    }
  }

  /**
   * Obtiene el historial de cambios de un modelo específico
   * @param {string} modelo - Nombre del modelo
   * @param {number} modeloId - ID del registro
   * @returns {Promise} Lista de versiones
   */
  async obtenerHistorial(modelo, modeloId) {
    try {
      const response = await axios.get(`${this.baseUrl}/${modelo}/${modeloId}`);
      return response.data;
    } catch (error) {
      console.error('Error al obtener historial:', error);
      throw error;
    }
  }

  /**
   * Compara dos versiones y devuelve los cambios
   * @param {object} versionAnterior - Versión anterior
   * @param {object} versionNueva - Versión nueva
   * @returns {object} Objeto con los campos que cambiaron
   */
  compararVersiones(versionAnterior, versionNueva) {
    const cambios = {};
    
    // Comparar campos del objeto nuevo
    Object.keys(versionNueva).forEach(key => {
      if (JSON.stringify(versionAnterior[key]) !== JSON.stringify(versionNueva[key])) {
        cambios[key] = {
          anterior: versionAnterior[key],
          nuevo: versionNueva[key]
        };
      }
    });

    return cambios;
  }

  /**
   * Extrae un snapshot del estado actual del grupo familiar
   * @param {object} formData - Datos del formulario
   * @param {array} familyMembers - Miembros de la familia
   * @returns {object} Snapshot completo del estado
   */
  crearSnapshotGrupoFamiliar(formData, familyMembers) {
    return {
      timestamp: new Date().toISOString(),
      formData: {
        captadoPor: formData?.captadoPor,
        cual: formData?.cual,
        asesor: formData?.asesor,
        nombre: formData?.nombre,
        apellidos: formData?.apellidos,
        perteneceFamilia: formData?.perteneceFamilia,
        telefono1: formData?.telefono1,
        telefono2: formData?.telefono2,
        nota: formData?.nota,
        relacion: formData?.relacion,
        whatsapp: formData?.whatsapp,
        telegram: formData?.telegram,
        sms: formData?.sms,
        zipCode: formData?.zipCode,
        fechaAutorizacion: formData?.fechaAutorizacion,
        nombreAutorizado: formData?.nombreAutorizado,
        ingresoFamiliar: formData?.ingresoFamiliar,
        personasCobertura: formData?.personasCobertura,
        personasTaxes: formData?.personasTaxes,
      },
      familyMembers: familyMembers.map(member => ({
        id: member.id,
        cliente_id: member.cliente_id,
        cobertura_id: member.cobertura_id,
        primer_nombre: member.primer_nombre,
        segundo_nombre: member.segundo_nombre,
        apellidos: member.apellidos,
        nombreCompleto: member.nombreCompleto,
        genero: member.genero,
        fecha_nacimiento: member.fecha_nacimiento,
        edad: member.edad,
        idioma: member.idioma,
        ingreso_anual: member.ingreso_anual,
        parentesco: member.parentesco,
        tipo: member.tipo,
        estado_cobertura: member.estado_cobertura,
        cobertura_tipo: member.cobertura_tipo,
        ano_cobertura: member.ano_cobertura,
        fecha_activacion: member.fecha_activacion,
        plan: member.plan,
        metal: member.metal,
        red: member.red,
        codigo_poliza: member.codigo_poliza,
        elegibilidad: member.elegibilidad,
        precio: member.precio,
        tipo_pago: member.tipo_pago,
        dia_pago: member.dia_pago,
        compania_id: member.compania_id,
        pagador_id: member.pagador_id,
      })),
      metadata: {
        totalMiembros: familyMembers.length,
        tieneCobertura: familyMembers.filter(m => m.estado_cobertura === 'Sí').length,
      }
    };
  }

  /**
   * Formatea el historial para mostrar en UI
   * @param {array} historial - Array de versiones
   * @returns {array} Historial formateado
   */
  formatearHistorial(historial) {
    return historial.map(version => ({
      id: version.id,
      accion: this.traducirAccion(version.accion),
      usuario: version.usuario,
      fecha: (() => {
        const d = new Date(version.created_at);
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const year = d.getFullYear();
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hoursStr = String(hours).padStart(2, "0");
            return `${month}-${day}-${year} ${hoursStr}:${minutes} ${ampm}`;
      })(),
      cambios: this.compararVersiones(
        version.estado_anterior || {},
        version.estado_nuevo || {}
      ),
      estadoAnterior: version.estado_anterior,
      estadoNuevo: version.estado_nuevo
    }));
  }

  /**
   * Traduce el código de acción a texto legible
   * @param {string} accion - Código de acción
   * @returns {string} Texto traducido
   */
  traducirAccion(accion) {
    const acciones = {
      create: 'Creación',
      update: 'Actualización',
      delete: 'Eliminación',
      estado_cambio: 'Cambio de Estado'
    };
    return acciones[accion] || accion;
  }
}

// Exportar instancia única (Singleton)
const historialVersionService = new HistorialVersionService();
export default historialVersionService;