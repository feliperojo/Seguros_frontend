import React, { useState, useEffect } from 'react';
import apiRequest from "../services/api"; // Usando el servicio API existente

const MediosPago = ({ clienteId, grupoFamiliarId, onSave }) => {
  // Inicialización de estados
  const [mediosPago, setMediosPago] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [currentMedioPago, setCurrentMedioPago] = useState({
    forma_pago: 'tarjeta',
    quien_paga: '',
    titular: '',
    direccion: '',
    tipo_tarjeta: '',
    numero_tarjeta: '',
    fecha_expiracion: '',
    cvv: '',
    banco: '',
    ruta: '',
    cuenta_numero: '',
    cliente_id: ''
  });

  // Cargar medios de pago cuando el componente se monta o cambia clienteId
  useEffect(() => {
    if (clienteId) {
      fetchMediosPago();
      // Actualizar el cliente_id en el currentMedioPago
      setCurrentMedioPago(prev => ({
        ...prev,
        cliente_id: clienteId
      }));
    }
  }, [clienteId]);

  // Función para obtener medios de pago - ajustada a la nueva ruta
  const fetchMediosPago = async () => {
    try {
      // Usando la ruta definida en tu controlador
      const response = await apiRequest(`mediopago/`, "GET");
      // Filtrar solo los medios de pago del cliente actual si la API devuelve todos
      const clienteMediosPago = Array.isArray(response) 
        ? response.filter(medio => medio.cliente_id === clienteId)
        : [];
      setMediosPago(clienteMediosPago);
    } catch (error) {
      console.error('Error al cargar medios de pago:', error);
      setMediosPago([]);
    }
  };

  // Manejador para abrir modal y agregar nuevo medio de pago
  const handleAddClick = () => {
    setEditingIndex(-1);
    setCurrentMedioPago({
      forma_pago: 'tarjeta',
      quien_paga: '',
      titular: '',
      direccion: '',
      tipo_tarjeta: '',
      numero_tarjeta: '',
      fecha_expiracion: '',
      cvv: '',
      banco: '',
      ruta: '',
      cuenta_numero: '',
      cliente_id: clienteId // Asegurar que cliente_id esté siempre establecido
    });
    setShowModal(true);
  };

  // Manejador para editar medio de pago existente
  const handleEditClick = (index) => {
    setEditingIndex(index);
    setCurrentMedioPago({...mediosPago[index]});
    setShowModal(true);
  };

  // Manejador para cambios en campos del formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentMedioPago(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Función para guardar medio de pago - ajustada a nuevas rutas
  const handleSave = async () => {
    try {
      let response;
      const payloadData = {
        ...currentMedioPago,
        cliente_id: clienteId
      };
      
      if (editingIndex >= 0 && mediosPago[editingIndex].id) {
        // Actualizar medio de pago existente usando la ruta definida
        response = await apiRequest(`mediopago/${mediosPago[editingIndex].id}`, "PUT", payloadData);
        const updatedMediosPago = [...mediosPago];
        updatedMediosPago[editingIndex] = response.data || response;
        setMediosPago(updatedMediosPago);
      } else {
        // Crear nuevo medio de pago usando la ruta definida
        response = await apiRequest("mediopago/create", "POST", payloadData);
        setMediosPago([...mediosPago, response.data || response]);
      }
      setShowModal(false);
      if (onSave) onSave(response.data || response);
    } catch (error) {
      console.error('Error al guardar medio de pago:', error);
    }
  };

  // Manejador para eliminar medio de pago - ajustado a nuevas rutas
  const handleDeleteClick = async (index) => {
    if (window.confirm('¿Está seguro que desea eliminar este medio de pago?')) {
      try {
        const id = mediosPago[index].id;
        if (id) {
          // Usar la ruta definida para eliminar
          await apiRequest(`mediopago/${id}`, "DELETE");
          const updatedMediosPago = [...mediosPago];
          updatedMediosPago.splice(index, 1);
          setMediosPago(updatedMediosPago);
        }
      } catch (error) {
        console.error('Error al eliminar medio de pago:', error);
      }
    }
  };
 
  // Renderizar campos del formulario según tipo de pago
  const renderFormFields = () => {
    switch (currentMedioPago.forma_pago) {
      case 'tarjeta':
        return (
          <>
            <div className="form-group mb-3">
              <label htmlFor="titular">Titular de la Tarjeta</label>
              <input
                type="text"
                className="form-control"
                id="titular"
                name="titular"
                value={currentMedioPago.titular || ''}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="form-row">
              <div className="form-group col-md-6 mb-3">
                <label htmlFor="tipo_tarjeta">Tipo de Tarjeta</label>
                <select
                  className="form-control"
                  id="tipo_tarjeta"
                  name="tipo_tarjeta"
                  value={currentMedioPago.tipo_tarjeta || ''}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccione...</option>
                  <option value="visa">Visa</option>
                  <option value="mastercard">MasterCard</option>
                  <option value="american_express">American Express</option>
                  <option value="Discover">Discover</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="form-group col-md-6 mb-3">
                <label htmlFor="numero_tarjeta">Número de Tarjeta</label>
                <input
                  type="text"
                  className="form-control"
                  id="numero_tarjeta"
                  name="numero_tarjeta"
                  value={currentMedioPago.numero_tarjeta || ''}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group col-md-6 mb-3">
                <label htmlFor="fecha_expiracion">Fecha de Expiración (MM/AA)</label>
                <input
                  type="text"
                  className="form-control"
                  id="fecha_expiracion"
                  name="fecha_expiracion"
                  placeholder="MM/AA"
                  value={currentMedioPago.fecha_expiracion || ''}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group col-md-6 mb-3">
                <label htmlFor="cvv">CVV</label>
                <input
                  type="text"
                  className="form-control"
                  id="cvv"
                  name="cvv"
                  value={currentMedioPago.cvv || ''}
                  onChange={handleChange}
                  required
                />
              </div>
              

            </div>
          </>
        );
      case 'cuenta_bancaria':
        return (
          <>
            <div className="form-group mb-3">
              <label htmlFor="titular">Titular de la Cuenta</label>
              <input
                type="text"
                className="form-control"
                id="titular"
                name="titular"
                value={currentMedioPago.titular || ''}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group mb-3">
              <label htmlFor="direccion">Dirección</label>
              <input
                type="text"
                className="form-control"
                id="direccion"
                name="direccion"
                value={currentMedioPago.direccion || ''}
                onChange={handleChange}
              />
            </div>
            <div className="form-group mb-3">
              <label htmlFor="banco">Banco</label>
              <input
                type="text"
                className="form-control"
                id="banco"
                name="banco"
                value={currentMedioPago.banco || ''}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group mb-3">
              <label htmlFor="ruta">Ruta/Código de Banco</label>
              <input
                type="text"
                className="form-control"
                id="ruta"
                name="ruta"
                value={currentMedioPago.ruta || ''}
                onChange={handleChange}
              />
            </div>
            <div className="form-group mb-3">
              <label htmlFor="cuenta_numero">Número de Cuenta</label>
              <input
                type="text"
                className="form-control"
                id="cuenta_numero"
                name="cuenta_numero"
                value={currentMedioPago.cuenta_numero || ''}
                onChange={handleChange}
                required
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="medios-pago-container">
     

      {/* Lista de medios de pago */}
      <div className="medios-pago-list">
        {mediosPago.length === 0 ? (
          <p>No hay medios de pago registrados.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Titular</th>
                <th>Detalles</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {mediosPago.map((medio, index) => (
                <tr key={index}>
                  <td>{medio.forma_pago === 'tarjeta' ? 'Tarjeta' : 'Cuenta Bancaria'}</td>
                  <td>{medio.titular}</td>
                  <td>
                    {medio.forma_pago === 'tarjeta' 
                      ? `${medio.tipo_tarjeta || ''} •••• ${medio.numero_tarjeta ? medio.numero_tarjeta.slice(-4) : ''}` 
                      : `${medio.banco || ''} - ${medio.cuenta_numero || ''}`}
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => handleEditClick(index)}
                    >
                      Editar
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDeleteClick(index)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Botón para agregar nuevo medio de pago */}
      <button 
        className="btn btn-primary mt-3"
        onClick={handleAddClick}
      >
        + Agregar Medio de Pago
      </button>

      {/* Modal para agregar/editar medio de pago */}
      {showModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingIndex >= 0 ? 'Editar' : 'Agregar'} Medio de Pago
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <form>
                  <div className="form-group mb-3">
                    <label htmlFor="forma_pago">Tipo de Medio de Pago</label>
                    <select
                      className="form-control"
                      id="forma_pago"
                      name="forma_pago"
                      value={currentMedioPago.forma_pago || 'tarjeta'}
                      onChange={handleChange}
                      required
                    >
                      <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                      <option value="cuenta_bancaria">Cuenta Bancaria</option>
                    </select>
                  </div>

                  <div className="form-group mb-3">
                    <label htmlFor="quien_paga">¿Quién paga?</label>
                    <select
                      className="form-control"
                      id="quien_paga"
                      name="quien_paga"
                      value={currentMedioPago.quien_paga || ''}
                      onChange={handleChange}
                    >
                      <option value="">Seleccione...</option>
                      <option value="titular">Titular</option>
                      <option value="tercero">Tercero</option>
                    </select>
                  </div>

                  {renderFormFields()}
                </form>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleSave}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop para el modal */}
      {showModal && <div className="modal-backdrop show" onClick={() => setShowModal(false)}></div>}
    </div>
  );
};

export default MediosPago;