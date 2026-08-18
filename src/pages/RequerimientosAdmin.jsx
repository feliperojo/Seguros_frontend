import React, { useEffect, useState } from 'react';

import apiRequest from '../services/api';
import ObservacionesModal from '../components/ObservacionesModal';
import ModalAdjuntos from '../components/ModalAdjuntos';
import '../styles/RequerimientosAdmin.css';
import { Helmet } from "react-helmet-async";
import useToast from '../hooks/useToast';

import {
  FaSearch, FaEdit, FaEye, FaTrashAlt, FaUserPlus, FaCog,
  FaFilter, FaSortAmountDown, FaSortAmountUp, FaFile, FaFileExport
} from "react-icons/fa";
const estados = {
  Pendiente: { label: 'Pendiente', color: 'badge bg-warning text-dark' },
  'Se pidio': { label: 'Se pidio', color: 'badge bg-primary' },
  Enviado: { label: 'Enviado', color: 'badge bg-info text-dark' },
  Insuficiente: { label: 'Insuficiente', color: 'badge bg-danger' },
  Completado: { label: 'Completado', color: 'badge bg-success' },
};

const esEstadoCompletado = (estado) =>
  String(estado || "").trim().toLowerCase() === "completado";

const isoDateOnly = (valor) => {
  if (!valor) return "";
  const s = String(valor).split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

const hoyIsoLocal = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const yearFromDate = (valor) => {
  const iso = isoDateOnly(valor);
  if (iso) return iso.slice(0, 4);
  const y = String(valor || "").slice(0, 4);
  return /^\d{4}$/.test(y) ? y : "";
};

const fechaCierreRequerimiento = (req) =>
  isoDateOnly(req?.fecha_envio) || isoDateOnly(req?.updated_at) || isoDateOnly(req?.updatedAt);

export default function RequerimientosAdmin() {
  const toast = useToast();
  const [requerimientos, setRequerimientos] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [showObservaciones, setShowObservaciones] = useState(false);
  const [selectedDocumentoId, setSelectedDocumentoId] = useState(null);

  const [showModalAdjuntos, setShowModalAdjuntos] = useState(false);
const [reqActivo, setReqActivo] = useState(null);


  // Filtros
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [anioFiltro, setAnioFiltro] = useState('');

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

  const handleMostrarAdjuntos = (req) => {
    setReqActivo(req);
    setShowModalAdjuntos(true);
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
      toast.showSuccess('Requerimiento actualizado correctamente');
    } catch (err) {
      toast.showError('Error al actualizar el requerimiento.');
    }
  };

  const handleDelete = async (req) => {
    const confirmed = confirm('¿Deseas eliminar este requerimiento?');
    if (!confirmed) return;

    try {
      await apiRequest(`documentos/${req.id}`, 'DELETE');
      fetchRequerimientos();
      toast.showSuccess('Requerimiento eliminado correctamente');
    } catch (err) {
      toast.showError('Error al eliminar el requerimiento.');
    }
  };

  const handleShowObservaciones = (documentoId) => {
    setSelectedDocumentoId(documentoId);
    setShowObservaciones(true);
  };

  const anioActual = String(new Date().getFullYear());
  const aniosDisponibles = Array.from(
    new Set(
      [
        anioActual,
        ...requerimientos.map((req) =>
          yearFromDate(req.fecha_solicitud || req.created_at)
        ),
      ].filter(Boolean)
    )
  ).sort((a, b) => Number(b) - Number(a));

  // 🔎 Aplicar Filtros
  const requerimientosFiltrados = requerimientos.filter((req) => {
    const clienteNombre = req.cobertura?.cliente?.nombre_completo?.toLowerCase() || '';
    const estado = req.estado || '';
    const vencimiento = req.fecha_vencimiento || '';
    const anioReq = yearFromDate(req.fecha_solicitud || req.created_at);

    const cumpleEstado = !estadoFiltro || estado === estadoFiltro;
    const cumpleCliente = !clienteFiltro || clienteNombre.includes(clienteFiltro.toLowerCase());
    const cumpleFechaDesde = !fechaDesde || vencimiento >= fechaDesde;
    const cumpleFechaHasta = !fechaHasta || vencimiento <= fechaHasta;
    const cumpleAnio = !anioFiltro || anioReq === String(anioFiltro);

    return cumpleEstado && cumpleCliente && cumpleFechaDesde && cumpleFechaHasta && cumpleAnio;
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
        <Helmet>
      <title>Vantun/Requerimientos</title>
    </Helmet>
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

        <div>
          <label className="form-label">Año</label>
          <select
            className="form-select"
            value={anioFiltro}
            onChange={(e) => setAnioFiltro(e.target.value)}
          >
            <option value="">Todos</option>
            {aniosDisponibles.map((anio) => (
              <option key={anio} value={anio}>{anio}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla agrupada */}
      {Object.entries(requerimientosPorCliente).map(([clienteKey, docs]) => (
        <div key={clienteKey} className="requerimientos-bloque">
        <h6>{clienteKey}</h6>
        <div className="table-responsive">
          <table className="requerimientos-table">
              <thead>
                <tr>
                  <th className="col-doc">DOCUMENTO</th>
                  <th className="col-doc">Numero ID</th>
                  <th className="col-fecha">FECHA VENCIMIENTO</th>
                  <th className="col-fecha">FECHA SOLICITUD</th>
                  <th className="col-estado">ESTADO</th>
                  <th className="col-obs">OBSERVACIONES</th>
                  <th className="col-acciones">ACCIONES</th>
                </tr>
              </thead>

              <tbody>
                {docs.map((req) => (
                  <tr key={req.id}>
                    <td>{req.documento_requerido}</td>
                    <td>{req.codigo_poliza || req.cobertura?.codigo_poliza || '-'}</td>
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
                        <>
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
                          {esEstadoCompletado(formData.estado) && (
                            <div
                              className="small text-muted mt-1"
                              title="Fecha en que se completó el requerimiento"
                            >
                              {esEstadoCompletado(req.estado)
                                ? (fechaCierreRequerimiento(req) || hoyIsoLocal())
                                : hoyIsoLocal()}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <span className={estados[req.estado]?.color || 'badge bg-secondary'}>
                            {estados[req.estado]?.label || req.estado || 'Sin estado'}
                          </span>
                          {esEstadoCompletado(req.estado) && fechaCierreRequerimiento(req) && (
                            <div
                              className="small text-muted mt-1"
                              title="Fecha en que se completó el requerimiento"
                            >
                              {fechaCierreRequerimiento(req)}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td>{req.observaciones || '-'}</td>
                    <td>
                        {editingId === req.id ? (
                          <button onClick={() => handleUpdate(req)} className="btn btn-success btn-sm w-100">Guardar</button>
                        ) : (
                          <div className="requerimientos-acciones">
                            <button onClick={() => handleEdit(req)} className="btn btn-primary btn-sm"><FaEdit /></button>
                            <button onClick={() => handleDelete(req)} className="btn btn-danger btn-sm"><FaTrashAlt /></button>
                            <button onClick={() => handleShowObservaciones(req.id)} className="btn btn-info btn-sm"><FaEye /></button>
                            <button onClick={() => handleMostrarAdjuntos(req)} className="btn btn-secondary btn-sm"><FaFile /></button>
                          </div>
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

        {showModalAdjuntos && reqActivo && (
          <ModalAdjuntos
            show={showModalAdjuntos}
            onHide={() => setShowModalAdjuntos(false)}
            documentoId={reqActivo.id}
          />
        )}

    </div>
  );
}
