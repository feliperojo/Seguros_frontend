import React, { useEffect, useState } from 'react';
import apiRequest from '../services/api';
import ObservacionesModal from '../components/ObservacionesModal';
import {
  FaSearch, FaEdit, FaEye, FaTrashAlt, FaUserPlus, FaCog,
  FaFilter, FaSortAmountDown, FaSortAmountUp, FaFile, FaFileExport
} from "react-icons/fa";
const estados = {
  Pendiente: { label: 'Pendiente', color: 'badge bg-warning text-dark' },
  Enviado: { label: 'Enviado', color: 'badge bg-info text-dark' },
  Aprobado: { label: 'Aprobado', color: 'badge bg-success' },
  Rechazado: { label: 'Rechazado', color: 'badge bg-danger' },
  Procesando: { label: 'Procesando', color: 'badge bg-secondary' },
  Completado: { label: 'Completado', color: 'badge bg-success' },
  Insuficiente: { label: 'Insuficiente', color: 'badge bg-danger' },
};

export default function RequerimientosAdmin() {
  const [requerimientos, setRequerimientos] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [showObservaciones, setShowObservaciones] = useState(false);
  const [selectedDocumentoId, setSelectedDocumentoId] = useState(null);

  // Filtros
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => {
    fetchRequerimientos();
  }, []);

  const fetchRequerimientos = async () => {
    try {
      const data = await apiRequest(`Requerimientos`);
      setRequerimientos(data);
    } catch (err) {
      console.error('Error al cargar requerimientos:', err.message);
    }
  };

  const handleEdit = (req) => {
    setEditingId(req.id);
    setFormData({
      fecha_vencimiento: req.fecha_vencimiento || '',
      estado: req.estado || '',
      observaciones: req.observaciones || '',
    });
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUpdate = async (req) => {
    try {
      await apiRequest(`coberturas/${req.cobertura_id}/documentos/${req.id}`, 'PUT', formData);
      setEditingId(null);
      fetchRequerimientos();
    } catch (err) {
      alert('Error al actualizar el requerimiento.');
    }
  };

  const handleDelete = async (req) => {
    const confirmed = confirm('¿Deseas eliminar este requerimiento?');
    if (!confirmed) return;

    try {
      await apiRequest(`documentos/${req.id}`, 'DELETE');
      fetchRequerimientos();
    } catch (err) {
      alert('Error al eliminar el requerimiento.');
    }
  };

  const handleShowObservaciones = (documentoId) => {
    setSelectedDocumentoId(documentoId);
    setShowObservaciones(true);
  };

  // 🔎 Aplicar Filtros
  const requerimientosFiltrados = requerimientos.filter((req) => {
    const clienteNombre = req.cobertura?.cliente?.nombre_completo?.toLowerCase() || '';
    const estado = req.estado || '';
    const vencimiento = req.fecha_vencimiento || '';

    const cumpleEstado = !estadoFiltro || estado === estadoFiltro;
    const cumpleCliente = !clienteFiltro || clienteNombre.includes(clienteFiltro.toLowerCase());
    const cumpleFechaDesde = !fechaDesde || vencimiento >= fechaDesde;
    const cumpleFechaHasta = !fechaHasta || vencimiento <= fechaHasta;

    return cumpleEstado && cumpleCliente && cumpleFechaDesde && cumpleFechaHasta;
  });

  // Agrupar por cliente
  const requerimientosPorCliente = requerimientosFiltrados.reduce((acc, req) => {
    const cliente = req.cobertura?.cliente?.nombre_completo || 'Cliente desconocido';
    const documento = req.cobertura?.codigo_poliza || 'N/D';
    const key = `${cliente} - CP ${documento}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(req);
    return acc;
  }, {});

  return (
    <div>
      {/* 🔍 Filtros */}
      <div className="d-flex flex-wrap gap-3 mb-4">
        <div>
          <label className="form-label">Estado</label>
          <select className="form-select" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="">Todos</option>
            {Object.keys(estados).map((key) => (
              <option key={key} value={key}>{estados[key].label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Cliente</label>
          <input
            type="text"
            className="form-control"
            placeholder="Buscar cliente..."
            value={clienteFiltro}
            onChange={(e) => setClienteFiltro(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label">Desde</label>
          <input
            type="date"
            className="form-control"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label">Hasta</label>
          <input
            type="date"
            className="form-control"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla agrupada */}
      {Object.entries(requerimientosPorCliente).map(([clienteKey, docs]) => (
        <div key={clienteKey} className="mb-4">
          <h6 className="fw-bold">{clienteKey}</h6>
          <div className="table-responsive">
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>DOCUMENTO</th>
                  <th>FECHA VENCIMIENTO</th>
                  <th>FECHA SOLICITUD</th>
                  <th>ESTADO</th>
                  <th>OBSERVACIONES</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((req) => (
                  <tr key={req.id}>
                    <td>{req.documento_requerido}</td>
                    <td>
                      {editingId === req.id ? (
                        <input
                          type="date"
                          name="fecha_vencimiento"
                          value={formData.fecha_vencimiento}
                          onChange={handleChange}
                          className="form-control"
                        />
                      ) : (
                        req.fecha_vencimiento || '-'
                      )}
                    </td>
                    <td>{req.fecha_solicitud || '-'}</td>
                    <td>
                      {editingId === req.id ? (
                        <select
                          name="estado"
                          value={formData.estado}
                          onChange={handleChange}
                          className="form-control"
                        >
                          <option value="">Seleccionar estado</option>
                          {Object.keys(estados).map((key) => (
                            <option key={key} value={key}>{estados[key].label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={estados[req.estado]?.color || 'badge bg-secondary'}>
                          {estados[req.estado]?.label || 'Sin estado'}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingId === req.id ? (
                        <input
                          type="text"
                          name="observaciones"
                          value={formData.observaciones}
                          onChange={handleChange}
                          className="form-control"
                        />
                      ) : (
                        req.observaciones || '-'
                      )}
                    </td>
                    <td>
                      {editingId === req.id ? (
                        <button onClick={() => handleUpdate(req)} className="btn btn-success btn-sm">Guardar</button>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(req)} className="btn btn-primary btn-sm me-1"><FaEdit /></button>
                          <button onClick={() => handleDelete(req)} className="btn btn-danger btn-sm me-1"><FaTrashAlt /></button>
                          <button onClick={() => handleShowObservaciones(req.id)} className="btn btn-info btn-sm"> <FaEye /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Modal de Observaciones */}
      <ObservacionesModal
        show={showObservaciones}
        onHide={() => setShowObservaciones(false)}
        documentoId={selectedDocumentoId}
      />
    </div>
  );
}
