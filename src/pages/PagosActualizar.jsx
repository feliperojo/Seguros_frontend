import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Table,
  Spinner,
  Alert,
  Form,
  Container,
  Row,
  Col,
  Button,
} from "react-bootstrap";
import { FaEye, FaSyncAlt, FaFilter, FaTable, FaCreditCard } from "react-icons/fa";

import apiRequest from "../services/api";
import ModalMediosPago from "../components/ModalMediosPago";
import { renderClienteLink } from "./ListaClientes";
import "../styles/GruposFamiliaresListado.css";
import "../styles/PagosActualizar.css";

const clampDay = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  const int = Math.trunc(num);
  if (int < 1) return 1;
  if (int > 31) return 31;
  return int;
};

/**
 * Soporta:
 * - "10" -> { mode: "single", day: 10 }
 * - "10-20" -> { mode: "range", from: 10, to: 20 }
 * - "20-10" -> se normaliza a 10-20
 */
const parseDiaPagoFilter = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  const normalized = s.replace(/\s+/g, "");
  if (normalized.includes("-")) {
    const [a, b] = normalized.split("-").slice(0, 2);
    const from = clampDay(a);
    const to = clampDay(b);
    if (from == null || to == null) return null;
    return from <= to ? { mode: "range", from, to } : { mode: "range", from: to, to: from };
  }

  const day = clampDay(normalized);
  if (day == null) return null;
  return { mode: "single", day };
};

const getEstadoClass = (estado) => {
  const key = String(estado ?? "").toLowerCase();
  if (key === "pagado") return "pagos-actualizar__estado--pagado";
  if (key === "procesando") return "pagos-actualizar__estado--procesando";
  return "pagos-actualizar__estado--pendiente";
};

const PagosActualizar = () => {
  const [loading, setLoading] = useState(false);
  const [pagos, setPagos] = useState([]);
  const [alerta, setAlerta] = useState({ show: false, variant: "", mensaje: "" });
  const [mesActual, setMesActual] = useState(() => {
    const now = new Date();
    return String(now.getMonth() + 1).padStart(2, "0");
  });
  const [filtros, setFiltros] = useState({ cliente: "", compania: "", estado: "", dia_pago: "" });
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;
  const [showMediosModal, setShowMediosModal] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  const abrirModalMedios = (clienteId) => {
    setClienteSeleccionado(clienteId);
    setShowMediosModal(true);
  };

  const mostrarAlerta = (mensaje, tipo = "success", duracion = 5000) => {
    setAlerta({ show: true, variant: tipo, mensaje });
    setTimeout(() => setAlerta({ show: false, variant: "", mensaje: "" }), duracion);
  };

  const fetchPagos = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("cobertura/pagos/listado", "GET");
      setPagos(response);
    } catch (err) {
      console.error("Error al cargar pagos:", err);
      mostrarAlerta("Error al cargar los pagos", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPagos();
  }, []);

  const updatePago = async (pagoId, patch) => {
    const pagoActual = pagos.find((p) => p.id === pagoId);
    const payload = {
      estado: patch?.estado ?? pagoActual?.estado,
      portal: patch?.portal ?? (pagoActual?.portal ?? false),
    };

    try {
      await apiRequest(`cobertura/pagos/${pagoId}`, "PUT", payload);

      setPagos((prev) => prev.map((p) => (p.id === pagoId ? { ...p, ...payload } : p)));
      mostrarAlerta("Pago actualizado correctamente", "success");
    } catch (err) {
      console.error("Error al actualizar el pago:", err);
      mostrarAlerta("Error al actualizar el pago", "danger");
    }
  };

  const handleEstadoChange = async (pagoId, nuevoEstado) => {
    await updatePago(pagoId, { estado: nuevoEstado });
  };

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
    setPaginaActual(1);
  };

  const diaPagoFilter = parseDiaPagoFilter(filtros.dia_pago);

  const pagosFiltrados = pagos.filter((p) => {
    const cliente = p.cliente?.nombre_completo?.toLowerCase() || "";
    const compania = p.cobertura?.compania?.nombre?.toLowerCase() || "";
    const estado = p.estado?.toLowerCase() || "";
    const fecha = p.fecha_pago || "";
    const dia = fecha.split("-")[2] || "";
    const diaNum = Number(dia);

    return (
      cliente.includes(filtros.cliente.toLowerCase()) &&
      compania.includes(filtros.compania.toLowerCase()) &&
      (filtros.estado ? estado === filtros.estado.toLowerCase() : true) &&
      (diaPagoFilter
        ? diaPagoFilter.mode === "single"
          ? diaNum === diaPagoFilter.day
          : diaNum >= diaPagoFilter.from && diaNum <= diaPagoFilter.to
        : true) &&
      fecha.includes(`-${mesActual}-`)
    );
  });

  const indexInicio = (paginaActual - 1) * itemsPorPagina;
  const indexFin = indexInicio + itemsPorPagina;
  const pagosPaginados = pagosFiltrados.slice(indexInicio, indexFin);

  const totalPaginas = Math.ceil(pagosFiltrados.length / itemsPorPagina);
  const mesLabel = new Date(2000, Number(mesActual) - 1).toLocaleString("es", { month: "long" });
  const mesCapitalizado = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  return (
    <Container fluid className="gf-listado-container py-3 pagos-actualizar">
      <Helmet>
        <title>Vantun / Actualización de pagos</title>
      </Helmet>

      <div className="gf-listado">
        <div className="gf-listado__header gf-listado__header--split">
          <div className="gf-listado__header-main">
            <div className="gf-listado__header-icon" aria-hidden="true">
              <FaCreditCard />
            </div>
            <div>
              <h1 className="gf-listado__title">Actualización de Pagos Generados</h1>
              <p className="gf-listado__subtitle">
                Visualiza y actualiza el estado de los pagos generados.
              </p>
            </div>
          </div>
          <div className="gf-listado__header-actions">
            <span className="gf-listado__chip">
              {loading
                ? "Cargando…"
                : `${pagosFiltrados.length} pago${pagosFiltrados.length !== 1 ? "s" : ""} · ${mesCapitalizado}`}
            </span>
            <Button
              size="sm"
              className="gf-listado__btn-ghost"
              onClick={fetchPagos}
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
              <Col xs={12} md={6} lg={3}>
                <div className="gf-listado__label">Cliente</div>
                <Form.Control
                  placeholder="Filtrar por cliente"
                  name="cliente"
                  value={filtros.cliente}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col xs={12} md={6} lg={3}>
                <div className="gf-listado__label">Compañía</div>
                <Form.Control
                  placeholder="Filtrar por compañía"
                  name="compania"
                  value={filtros.compania}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col xs={12} sm={6} lg={2}>
                <div className="gf-listado__label">Mes</div>
                <Form.Select value={mesActual} onChange={(e) => setMesActual(e.target.value)}>
                  {[...Array(12)].map((_, i) => {
                    const mes = new Date(0, i).toLocaleString("es", { month: "long" });
                    const mesNombre = mes.charAt(0).toUpperCase() + mes.slice(1);
                    return (
                      <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                        {mesNombre}
                      </option>
                    );
                  })}
                </Form.Select>
              </Col>
              <Col xs={12} sm={6} lg={2}>
                <div className="gf-listado__label">Día de pago</div>
                <Form.Control
                  placeholder="01-31 o 10-20"
                  name="dia_pago"
                  value={filtros.dia_pago}
                  onChange={handleFiltroChange}
                  type="text"
                />
              </Col>
              <Col xs={12} sm={6} lg={2}>
                <div className="gf-listado__label">Estado</div>
                <Form.Select name="estado" value={filtros.estado} onChange={handleFiltroChange}>
                  <option value="">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                  <option value="procesando">Procesando</option>
                </Form.Select>
              </Col>
            </Row>
          </div>

          {alerta.show && (
            <Alert variant={alerta.variant} className="pagos-actualizar__alert text-center">
              {alerta.mensaje}
            </Alert>
          )}

          <div className="gf-listado__section gf-listado__section--table">
            <div className="gf-listado__section-title">
              <FaTable aria-hidden="true" />
              Listado de pagos
            </div>

            {!loading && pagosFiltrados.length > 0 && (
              <div className="gf-listado__summary">
                Mostrando{" "}
                <strong>
                  {indexInicio + 1}–{Math.min(indexFin, pagosFiltrados.length)}
                </strong>{" "}
                de <strong>{pagosFiltrados.length}</strong> pagos
              </div>
            )}

            {loading ? (
              <div className="pagos-actualizar__loading">
                <Spinner animation="border" role="status" />
                <div>Cargando pagos…</div>
              </div>
            ) : pagosFiltrados.length === 0 ? (
              <div className="gf-listado__empty">
                No hay pagos que coincidan con los filtros seleccionados.
              </div>
            ) : (
              <>
                <div className="gf-listado__table-wrap">
                  <Table hover responsive className="gf-listado__table mb-0">
                    <thead>
                      <tr>
                        <th>ID GF</th>
                        <th>ID Póliza</th>
                        <th>Cliente</th>
                        <th>Pagador</th>
                        <th>Fecha de pago</th>
                        <th>Compañía</th>
                        <th>Tipo de pago</th>
                        <th>Monto</th>
                        <th className="text-center">Medios</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagosPaginados.map((p) => (
                        <tr key={p.id}>
                          <td>
                            {p.grupo_familiar_id ? (
                              <Link
                                to={`/grupo_familiar/${p.grupo_familiar_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`Ver grupo familiar #${p.grupo_familiar_id}`}
                              >
                                {p.grupo_familiar_id}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{p.cobertura?.codigo_poliza || "—"}</td>
                          <td>
                            {renderClienteLink(
                              p.cliente?.id || p.cliente_id,
                              p.cliente?.nombre_completo || "—"
                            )}
                          </td>
                          <td>{p.cobertura?.pagador?.nombre_completo || "—"}</td>
                          <td>{p.fecha_pago || "—"}</td>
                          <td>{p.cobertura?.compania?.nombre || "—"}</td>
                          <td className="pagos-actualizar__tipo-pago text-center">
                            {p.cobertura?.tipo_pago || "—"}
                          </td>
                          <td className="pagos-actualizar__monto">
                            ${Number(p.monto).toFixed(2)}
                          </td>
                          <td className="pagos-actualizar__table-actions">
                            <Button
                              variant="outline-secondary"
                              className="pagos-actualizar__btn-medios"
                              onClick={() => abrirModalMedios(p.cliente?.id)}
                              disabled={!p.cliente?.id}
                              title="Ver medios de pago"
                              aria-label="Ver medios de pago"
                            >
                              <FaEye />
                            </Button>
                          </td>
                          <td>
                            <Form.Select
                              value={p.estado}
                              onChange={(e) => handleEstadoChange(p.id, e.target.value)}
                              className={`pagos-actualizar__estado ${getEstadoClass(p.estado)}`}
                              aria-label={`Estado del pago ${p.id}`}
                            >
                              <option value="pendiente">Pendiente</option>
                              <option value="pagado">Pagado</option>
                              <option value="procesando">Procesando</option>
                            </Form.Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                {totalPaginas > 1 && (
                  <div className="pagos-actualizar__pagination">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="gf-listado__btn-icon"
                      disabled={paginaActual <= 1}
                      onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="pagos-actualizar__page-indicator">
                      Página {paginaActual} de {totalPaginas}
                    </span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="gf-listado__btn-icon"
                      disabled={paginaActual >= totalPaginas}
                      onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ModalMediosPago
        show={showMediosModal}
        onHide={() => setShowMediosModal(false)}
        clienteId={clienteSeleccionado}
      />
    </Container>
  );
};

export default PagosActualizar;
