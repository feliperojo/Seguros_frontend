import React, { useState, useEffect } from 'react';
import apiRequest from "../services/api"; // Usando el servicio API existente
import { 
  FaSearch, FaEdit, FaEye, FaTrashAlt, FaUserPlus, 
  FaFilter, FaSortAmountDown, FaSortAmountUp, FaFileExport, FaTimes
} from "react-icons/fa";
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
  const [error, setError] = useState({ campo: '', mensaje: '' });
  const tarjetas = mediosPago.filter(m => m.forma_pago === 'tarjeta');
  const cuentasBancarias = mediosPago.filter(m => m.forma_pago === 'cuenta_bancaria');

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
      const response = await apiRequest(`mediopago/cliente/${clienteId}`, "GET");
      setMediosPago(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error al cargar medios de pago:', error);
      setMediosPago([]);
    }
  };
  
  const handleViewClick = (index) => {
    const medio = mediosPago[index];
    alert(`Ver medio de pago:\nTitular: ${medio.titular}\nTipo: ${medio.forma_pago}`);
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
    setError({ campo: '', mensaje: '' });
    setShowModal(true);
  };

  // Manejador para editar medio de pago existente
  const handleEditClick = (index) => {
    setEditingIndex(index);
    setCurrentMedioPago({...mediosPago[index]});
    setError({ campo: '', mensaje: '' });
    setShowModal(true);
  };

  // Formatear número de tarjeta según el tipo
  const formatCardNumber = (value, cardType) => {
    // Eliminar espacios y caracteres no numéricos
    const numbers = value.replace(/\D/g, '');
    
    // Limitar a los dígitos máximos según el tipo de tarjeta
    const maxLength = cardType === 'american_express' ? 15 : 16;
    const limitedNumbers = numbers.slice(0, maxLength);
    
    // Formatear según el tipo de tarjeta
    if (cardType === 'american_express') {
      // Formato 4-6-5 para Amex
      const parts = [
        limitedNumbers.slice(0, 4),
        limitedNumbers.slice(4, 10),
        limitedNumbers.slice(10, 15)
      ].filter(part => part.length > 0);
      return parts.join(' ');
    } else {
      // Formato 4-4-4-4 para otras tarjetas
      const parts = [];
      for (let i = 0; i < limitedNumbers.length; i += 4) {
        parts.push(limitedNumbers.slice(i, i + 4));
      }
      return parts.join(' ');
    }
  };

  // Formatear fecha de expiración (MM/AAAA)
  const formatExpirationDate = (value) => {
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length <= 2) {
      return numbers;
    }
    
    const month = numbers.slice(0, 2);
    const year = numbers.slice(2, 6);
    
    return `${month}/${year}`;
  };

  // Validar CVV
  const validateCVV = (cvv, cardType) => {
    const digits = cvv.replace(/\D/g, '');
    const requiredLength = cardType === 'american_express' ? 4 : 3;
    
    return digits.length === requiredLength;
  };

  // Manejador para cambios en campos del formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setError({ campo: '', mensaje: '' }); // Limpiar errores previos
    
    if (name === 'tipo_tarjeta') {
      // Al cambiar el tipo de tarjeta, resetear el número y CVV
      setCurrentMedioPago(prev => ({
        ...prev,
        [name]: value,
        numero_tarjeta: '',
        cvv: ''
      }));
    } else if (name === 'numero_tarjeta') {
      // Formatear número de tarjeta
      const formattedValue = formatCardNumber(value, currentMedioPago.tipo_tarjeta);
      setCurrentMedioPago(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    } else if (name === 'fecha_expiracion') {
      // Formatear fecha de expiración
      const formattedValue = formatExpirationDate(value);
      setCurrentMedioPago(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    } else if (name === 'cvv') {
      // Limitar CVV a solo números
      const digitsOnly = value.replace(/\D/g, '');
      const maxLength = currentMedioPago.tipo_tarjeta === 'american_express' ? 4 : 3;
      setCurrentMedioPago(prev => ({
        ...prev,
        [name]: digitsOnly.slice(0, maxLength)
      }));
    } else {
      setCurrentMedioPago(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Validar formulario antes de guardar
  const validateForm = () => {
    // Validar según forma de pago
    if (currentMedioPago.forma_pago === 'tarjeta') {
      // Validar titular
      if (!currentMedioPago.titular.trim()) {
        setError({ campo: 'titular', mensaje: 'Debe ingresar el nombre del titular' });
        return false;
      }
      
      // Validar tipo de tarjeta
      if (!currentMedioPago.tipo_tarjeta) {
        setError({ campo: 'tipo_tarjeta', mensaje: 'Debe seleccionar un tipo de tarjeta' });
        return false;
      }
      
      // Validar número de tarjeta
      const numeroLimpio = currentMedioPago.numero_tarjeta.replace(/\D/g, '');
      const longitudRequerida = currentMedioPago.tipo_tarjeta === 'american_express' ? 15 : 16;
      if (numeroLimpio.length !== longitudRequerida) {
        setError({ campo: 'numero_tarjeta', mensaje: `El número debe tener ${longitudRequerida} dígitos` });
        return false;
      }
      
      // Validar fecha de expiración
      const fechaPattern = /^(0[1-9]|1[0-2])\/20\d{2}$/;
      if (!fechaPattern.test(currentMedioPago.fecha_expiracion)) {
        setError({ campo: 'fecha_expiracion', mensaje: 'Formato inválido. Use MM/AAAA' });
        return false;
      }
      
      // Validar CVV
      if (!validateCVV(currentMedioPago.cvv, currentMedioPago.tipo_tarjeta)) {
        const longitudCVV = currentMedioPago.tipo_tarjeta === 'american_express' ? 4 : 3;
        setError({ campo: 'cvv', mensaje: `El CVV debe tener ${longitudCVV} dígitos` });
        return false;
      }
    } else if (currentMedioPago.forma_pago === 'cuenta_bancaria') {
      // Validar titular
      if (!currentMedioPago.titular.trim()) {
        setError({ campo: 'titular', mensaje: 'Debe ingresar el nombre del titular' });
        return false;
      }
      
      // Validar banco
      if (!currentMedioPago.banco.trim()) {
        setError({ campo: 'banco', mensaje: 'Debe ingresar el nombre del banco' });
        return false;
      }
      
      // Validar número de cuenta
      if (!currentMedioPago.cuenta_numero.trim()) {
        setError({ campo: 'cuenta_numero', mensaje: 'Debe ingresar el número de cuenta' });
        return false;
      }
    }
    
    return true;
  };

  // Función para guardar medio de pago - ajustada a nuevas rutas
  const handleSave = async () => {
    // Validar formulario
    if (!validateForm()) {
      return;
    }
    
    try {
      let response;
      // Preparar datos, eliminando espacios del número de tarjeta para almacenamiento
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
      setError({ campo: 'general', mensaje: 'Error al guardar el medio de pago. Inténtelo de nuevo.' });
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

  const renderTablaTarjetas = () => (
    <>
      <h5 className="mt-4 mb-2">Tarjetas de Crédito/Débito</h5>
      {tarjetas.length === 0 ? (
        <p>No hay tarjetas registradas.</p>
      ) : (
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Quien paga</th>
              <th>Titular</th>
              <th>Número</th>
              <th>Vencimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tarjetas.map((medio, index) => (
              <tr key={medio.id}>
                <td>{medio.tipo_tarjeta}</td>
                <td>{medio.quien_paga}</td>
                <td>{medio.titular}</td>
                <td>{medio.numero_tarjeta}</td>
                <td>{medio.fecha_expiracion}</td>
                <td>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => handleViewClick(index)}>
                      <FaEye />
                    </button>
                    <button className="btn btn-sm btn-outline-success" onClick={() => handleEditClick(index)}>
                      <FaEdit />
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteClick(index)}>
                      <FaTrashAlt />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
  
  const renderTablaCuentas = () => (
    <>
      <h5 className="mt-4 mb-2">Cuentas Bancarias</h5>
      {cuentasBancarias.length === 0 ? (
        <p>No hay cuentas bancarias registradas.</p>
      ) : (
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Banco</th>
              <th>Quien paga</th>
              <th>Titular</th>
              <th>Dirección</th>
              <th>Ruta/Código de Banco</th>
              <th>Número de Cuenta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cuentasBancarias.map((medio, index) => (
              <tr key={medio.id}>
                <td>{medio.banco}</td>
                <td>{medio.quien_paga}</td>
                <td>{medio.titular}</td>
                <td>{medio.direccion}</td>
                <td>{medio.ruta}</td>
                <td>{medio.cuenta_numero}</td>
                {/* <td>•••• {medio.cuenta_numero?.slice(-4)}</td> */}
                <td>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => handleViewClick(index)}>
                      <FaEye />
                    </button>
                    <button className="btn btn-sm btn-outline-success" onClick={() => handleEditClick(index)}>
                      <FaEdit />
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteClick(index)}>
                      <FaTrashAlt />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
  


 
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
                className={`form-control ${error.campo === 'titular' ? 'is-invalid' : ''}`}
                id="titular"
                name="titular"
                value={currentMedioPago.titular || ''}
                onChange={handleChange}
                required
              />
              {error.campo === 'titular' && (
                <div className="invalid-feedback">{error.mensaje}</div>
              )}
            </div>
            
            <div className="form-row">
              <div className="form-group col-md-6 mb-3">
                <label htmlFor="tipo_tarjeta">Tipo de Tarjeta</label>
                <select
                  className={`form-control ${error.campo === 'tipo_tarjeta' ? 'is-invalid' : ''}`}
                  id="tipo_tarjeta"
                  name="tipo_tarjeta"
                  value={currentMedioPago.tipo_tarjeta || ''}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccione...</option>
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">MasterCard</option>
                  <option value="American Express">American Express</option>
                  <option value="Discover">Discover</option>
                  <option value="otro">Otro</option>
                </select>
                {error.campo === 'tipo_tarjeta' && (
                  <div className="invalid-feedback">{error.mensaje}</div>
                )}
              </div>
              <div className="form-group col-md-6 mb-3">
                <label htmlFor="numero_tarjeta">Número de Tarjeta</label>
                <input
                  type="text"
                  className={`form-control ${error.campo === 'numero_tarjeta' ? 'is-invalid' : ''}`}
                  id="numero_tarjeta"
                  name="numero_tarjeta"
                  value={currentMedioPago.numero_tarjeta || ''}
                  onChange={handleChange}
                  placeholder={currentMedioPago.tipo_tarjeta === 'American Express' ? 'XXXX XXXXXX XXXXX' : 'XXXX XXXX XXXX XXXX'}
                  required
                />
                {error.campo === 'numero_tarjeta' && (
                  <div className="invalid-feedback">{error.mensaje}</div>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group col-md-6 mb-3">
                <label htmlFor="fecha_expiracion">Fecha de Expiración (MM/AAAA)</label>
                <input
                  type="text"
                  className={`form-control ${error.campo === 'fecha_expiracion' ? 'is-invalid' : ''}`}
                  id="fecha_expiracion"
                  name="fecha_expiracion"
                  placeholder="MM/AAAA"
                  value={currentMedioPago.fecha_expiracion || ''}
                  onChange={handleChange}
                  required
                />
                {error.campo === 'fecha_expiracion' && (
                  <div className="invalid-feedback">{error.mensaje}</div>
                )}
              </div>
              <div className="form-group col-md-6 mb-3">
                <label htmlFor="cvv">CVV</label>
                <input
                  type="text"
                  className={`form-control ${error.campo === 'cvv' ? 'is-invalid' : ''}`}
                  id="cvv"
                  name="cvv"
                  value={currentMedioPago.cvv || ''}
                  onChange={handleChange}
                  placeholder={currentMedioPago.tipo_tarjeta === 'american_express' ? '4 dígitos' : '3 dígitos'}
                  required
                />
                {error.campo === 'cvv' && (
                  <div className="invalid-feedback">{error.mensaje}</div>
                )}
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
                className={`form-control ${error.campo === 'titular' ? 'is-invalid' : ''}`}
                id="titular"
                name="titular"
                value={currentMedioPago.titular || ''}
                onChange={handleChange}
                required
              />
              {error.campo === 'titular' && (
                <div className="invalid-feedback">{error.mensaje}</div>
              )}
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
                className={`form-control ${error.campo === 'banco' ? 'is-invalid' : ''}`}
                id="banco"
                name="banco"
                value={currentMedioPago.banco || ''}
                onChange={handleChange}
                required
              />
              {error.campo === 'banco' && (
                <div className="invalid-feedback">{error.mensaje}</div>
              )}
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
                className={`form-control ${error.campo === 'cuenta_numero' ? 'is-invalid' : ''}`}
                id="cuenta_numero"
                name="cuenta_numero"
                value={currentMedioPago.cuenta_numero || ''}
                onChange={handleChange}
                required
              />
              {error.campo === 'cuenta_numero' && (
                <div className="invalid-feedback">{error.mensaje}</div>
              )}
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
            <>
              {renderTablaTarjetas()}
              {renderTablaCuentas()}
            </>
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
                {error.campo === 'general' && (
                  <div className="alert alert-danger" role="alert">
                    {error.mensaje}
                  </div>
                )}
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