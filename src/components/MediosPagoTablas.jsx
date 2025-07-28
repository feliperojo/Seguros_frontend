import React from 'react';
import { FaEye, FaEdit, FaTrashAlt } from 'react-icons/fa';

const MediosPagoTablas = ({ mediosPago, onView, onEdit, onDelete, showActions = true }) => {
    const tarjetas = mediosPago.filter(m => m.forma_pago === 'tarjeta');
  const cuentasBancarias = mediosPago.filter(m => m.forma_pago === 'cuenta_bancaria');

  return (
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
                    <th>Direccion</th>
                    <th>Número</th>
                    <th>Vencimiento</th>
                    {showActions && <th>Acciones</th>}
                </tr>
                </thead>

          <tbody>
            {tarjetas.map((medio, index) => (
                    <tr key={medio.id}>
                        <td>{medio.tipo_tarjeta}</td>
                        <td>{medio.quien_paga}</td>
                        <td>{medio.titular}</td>
                        <td>{medio.direccion}</td>
                        <td>{medio.numero_tarjeta}</td>
                        <td>{medio.fecha_expiracion}</td>
                        {showActions && (
                        <td>
                            <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-primary" onClick={() => onView(medio, index)}>
                                <FaEye />
                            </button>
                            <button className="btn btn-sm btn-outline-success" onClick={() => onEdit(medio, index)}>
                                <FaEdit />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(medio, index)}>
                                <FaTrashAlt />
                            </button>
                            </div>
                        </td>
                        )}
                    </tr>
                    ))}

          </tbody>
        </table>
      )}

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
                    {showActions && <th>Acciones</th>}
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
                        {showActions && (
                        <td>
                            <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-primary" onClick={() => onView(medio, index)}>
                                <FaEye />
                            </button>
                            <button className="btn btn-sm btn-outline-success" onClick={() => onEdit(medio, index)}>
                                <FaEdit />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(medio, index)}>
                                <FaTrashAlt />
                            </button>
                            </div>
                        </td>
                        )}
                    </tr>
                    ))}

          </tbody>
        </table>
      )}
    </>
  );
};

export default MediosPagoTablas;
