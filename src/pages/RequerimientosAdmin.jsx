import React, { useEffect, useState } from 'react';
import {
  Container,
  Row,
  Col,
  Form,
  Button,
} from 'react-bootstrap';
import apiRequest from '../services/api';
import ObservacionesModal from '../components/ObservacionesModal';
import ModalAdjuntos from '../components/ModalAdjuntos';
import '../styles/GruposFamiliaresListado.css';
import '../styles/RequerimientosAdmin.css';
import { Helmet } from "react-helmet-async";
import useToast from '../hooks/useToast';
import { formatDateMMDDYYYY } from '../utils/formatters';
import DateInputWithCalendar from '../components/common/DateInputWithCalendar';
import {
  esEstadoCompletado,
  fechaCierreAlCompletar,
  fechaCierreRequerimiento,
  hoyIsoLocal,
  isoDateOnly,
} from '../utils/requerimientoFechas';
import {
  FaEdit, FaEye, FaTrashAlt, FaFile, FaFilter, FaTable, FaSyncAlt,
} from "react-icons/fa";

const estados = {
  Pendiente: { label: 'Pendiente', className: 'req-admin__estado--pendiente' },
  'Se pidio': { label: 'Se pidio', className: 'req-admin__estado--se-pidio' },
  Enviado: { label: 'Enviado', className: 'req-admin__estado--enviado' },
  Insuficiente: { label: 'Insuficiente', className: 'req-admin__estado--insuficiente' },
  Completado: { label: 'Completado', className: 'req-admin__estado--completado' },
};

const yearFromDate = (valor) => {
  const iso = isoDateOnly(valor);
  if (iso) return iso.slice(0, 4);
  const y = String(valor || "").slice(0, 4);
  return /^\d{4}$/.test(y) ? y : "";
};

const formatReqDateCell = (valor) => {
  if (!valor) return "-";
  const formatted = formatDateMMDDYYYY(String(valor).split("T")[0]);
  return formatted || "-";
};

export default function RequerimientosAdmin() {
  const toast = useToast();
  const [requerimientos, setRequerimientos] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [showObservaciones, setShowObservaciones] = useState(false);
  const [selectedDocumentoId, setSelectedDocumentoId] = useState(null);
  const [showModalAdjuntos, setShowModalAdjuntos] = useState(false);
  const [reqActivo, setReqActivo] = useState(null);
  const [loading, setLoading] = useState(false);

  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [anioFiltro, setAnioFiltro] = useState('');

  useEffect(() => {
    fetchRequerimientos();
  }, []);

  const fetchRequerimientos = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`Requerimientos`);
      setRequerimientos(data);
    } catch (err) {
      console.error('Error al cargar requerimientos:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMostrarAdjuntos = (req) => {
    setReqActivo(req);
    setShowModalAdjuntos(true);
  };

  const handleEdit = (req) => {
    setEditingId(req.id);
    setFormData({
      fecha_vencimiento: isoDateOnly(req.fecha_vencimiento) || req.fecha_vencimiento || '',
      estado: req.estado || '',
      observaciones: req.observaciones || '',
      fecha_cierre: esEstadoCompletado(req.estado) ? fechaCierreAlCompletar(req) : fechaCierreRequerimiento(req),
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'estado' && esEstadoCompletado(value) && !isoDateOnly(prev.fecha_cierre)) {
        next.fecha_cierre = hoyIsoLocal();
      }
      return next;
    });
  };

  const handleUpdate = async (req) => {
    try {
      const payload = { ...formData };
      if (esEstadoCompletado(payload.estado)) {
        payload.fecha_cierre = isoDateOnly(payload.fecha_cierre) || hoyIsoLocal();
      }
      await apiRequest(`coberturas/${req.cobertura_id}/documentos/${req.id}`, 'PUT', payload);
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

  const requerimientosPorCliente = requerimientosFiltrados.reduce((acc, req) => {
    const cliente = req.cobertura?.cliente?.nombre_completo || 'Cliente desconocido';
    const documento = req.cobertura?.codigo_poliza || 'N/D';
    const key = `${cliente} - CP ${documento}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(req);
    return acc;
  }, {});

  const bloquesCliente = Object.entries(requerimientosPorCliente);

  return (
    <Container fluid className="gf-listado-container py-3 req-admin">
      <Helmet>
        <title>Vantun / Documentos solicitados</title>
      </Helmet>

      <div className="gf-listado">
        <div className="gf-listado__header gf-listado__header--split">
          <div className="gf-listado__header-main">
            <div className="gf-listado__header-icon" aria-hidden="true">
              <FaFile />
            </div>
            <div>
              <h1 className="gf-listado__title">Documentos solicitados</h1>
              <p className="gf-listado__subtitle">
                Gestiona los requerimientos de documentos por cliente y póliza.
              </p>
            </div>
          </div>
          <div className="gf-listado__header-actions">
            <span className="gf-listado__chip">
              {loading
                ? "Cargando…"
                : `${requerimientosFiltrados.length} requerimiento${requerimientosFiltrados.length !== 1 ? "s" : ""}`}
            </span>
            <Button
              size="sm"
              className="gf-listado__btn-ghost"
              onClick={fetchRequerimientos}
              disabled={loading}
            >
              <FaSyncAlt className={loading ? "fa-spin me-1" : "me-1"} />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="gf-listado__body">
          <div className="gf-listado__section">
            <div className="gf-listado__section-title">
              <FaFilter aria-hidden="true" />
              Filtros
            </div>

            <Row className="g-3 align-items-end">
              <Col xs={12} sm={6} lg={2}>
                <div className="gf-listado__label">Estado</div>
                <Form.Select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
                  <option value="">Todos</option>
                  {Object.keys(estados).map((key) => (
                    <option key={key} value={key}>{estados[key].label}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={12} sm={6} lg={3}>
                <div className="gf-listado__label">Cliente</div>
                <Form.Control
                  type="text"
                  placeholder="Buscar cliente..."
                  value={clienteFiltro}
                  onChange={(e) => setClienteFiltro(e.target.value)}
                />
              </Col>
              <Col xs={12} sm={6} lg={2}>
                <div className="gf-listado__label">Desde</div>
                <DateInputWithCalendar
                  valueIso={fechaDesde}
                  onChangeIso={(iso) => setFechaDesde(iso || "")}
                />
              </Col>
              <Col xs={12} sm={6} lg={2}>
                <div className="gf-listado__label">Hasta</div>
                <DateInputWithCalendar
                  valueIso={fechaHasta}
                  onChangeIso={(iso) => setFechaHasta(iso || "")}
                  minIso={fechaDesde || undefined}
                />
              </Col>
              <Col xs={12} sm={6} lg={2}>
                <div className="gf-listado__label">Año</div>
                <Form.Select
                  value={anioFiltro}
                  onChange={(e) => setAnioFiltro(e.target.value)}
                >
                  <option value="">Todos</option>
                  {aniosDisponibles.map((anio) => (
                    <option key={anio} value={anio}>{anio}</option>
                  ))}
                </Form.Select>
              </Col>
            </Row>
          </div>

          <div className="gf-listado__section gf-listado__section--table">
            <div className="gf-listado__section-title">
              <FaTable aria-hidden="true" />
              Requerimientos por cliente
            </div>

            {!loading && bloquesCliente.length > 0 && (
              <div className="gf-listado__summary">
                <strong>{bloquesCliente.length}</strong> cliente
                {bloquesCliente.length !== 1 ? "s" : ""} con requerimientos
              </div>
            )}

            {loading ? (
              <div className="gf-listado__empty">Cargando requerimientos…</div>
            ) : bloquesCliente.length === 0 ? (
              <div className="gf-listado__empty">
                No hay requerimientos que coincidan con los filtros seleccionados.
              </div>
            ) : (
              bloquesCliente.map(([clienteKey, docs]) => (
                <div key={clienteKey} className="req-admin__bloque">
                  <div className="req-admin__bloque-header">
                    <h2 className="req-admin__bloque-title">{clienteKey}</h2>
                  </div>
                  <div className="req-admin__table-wrap">
                    <table className="req-admin__table">
                      <thead>
                        <tr>
                          <th className="req-admin__col-doc">Documento</th>
                          <th className="req-admin__col-id">Número ID</th>
                          <th className="req-admin__col-fecha">Fecha vencimiento</th>
                          <th className="req-admin__col-fecha">Fecha solicitud</th>
                          <th className="req-admin__col-estado">Estado</th>
                          <th className="req-admin__col-obs">Observaciones</th>
                          <th className="req-admin__col-acciones">Acciones</th>
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
                                formatReqDateCell(req.fecha_vencimiento)
                              )}
                            </td>
                            <td>{formatReqDateCell(req.fecha_solicitud)}</td>
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
                                    <div className="mt-2">
                                      <div className="req-admin__fecha-edit-label">
                                        Fecha de cierre
                                      </div>
                                      <DateInputWithCalendar
                                        size="sm"
                                        valueIso={formData.fecha_cierre || hoyIsoLocal()}
                                        minIso="1900-01-01"
                                        maxIso="2099-12-31"
                                        onChangeIso={(iso) =>
                                          setFormData((prev) => ({
                                            ...prev,
                                            fecha_cierre: iso || hoyIsoLocal(),
                                          }))
                                        }
                                        title="Fecha en que se cerró el requerimiento"
                                      />
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span
                                    className={`req-admin__estado ${
                                      estados[req.estado]?.className || 'req-admin__estado--default'
                                    }`}
                                  >
                                    {estados[req.estado]?.label || req.estado || 'Sin estado'}
                                  </span>
                                  {esEstadoCompletado(req.estado) && fechaCierreRequerimiento(req) && (
                                    <div
                                      className="req-admin__fecha-cierre"
                                      title="Fecha en que se cerró el requerimiento"
                                    >
                                      {formatReqDateCell(fechaCierreRequerimiento(req))}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                            <td>{req.observaciones || '-'}</td>
                            <td>
                              {editingId === req.id ? (
                                <Button
                                  onClick={() => handleUpdate(req)}
                                  className="req-admin__btn-guardar w-100"
                                  size="sm"
                                >
                                  Guardar
                                </Button>
                              ) : (
                                <div className="req-admin__acciones">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(req)}
                                    className="req-admin__btn-accion req-admin__btn-accion--edit"
                                    title="Editar"
                                    aria-label="Editar"
                                  >
                                    <FaEdit />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(req)}
                                    className="req-admin__btn-accion req-admin__btn-accion--delete"
                                    title="Eliminar"
                                    aria-label="Eliminar"
                                  >
                                    <FaTrashAlt />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleShowObservaciones(req.id)}
                                    className="req-admin__btn-accion req-admin__btn-accion--view"
                                    title="Ver observaciones"
                                    aria-label="Ver observaciones"
                                  >
                                    <FaEye />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMostrarAdjuntos(req)}
                                    className="req-admin__btn-accion req-admin__btn-accion--file"
                                    title="Ver adjuntos"
                                    aria-label="Ver adjuntos"
                                  >
                                    <FaFile />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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
    </Container>
  );
}
