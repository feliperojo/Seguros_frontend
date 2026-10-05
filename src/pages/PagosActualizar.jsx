import { useEffect, useMemo, useRef, useState } from "react";
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
import { FaEye, FaSyncAlt, FaFilter, FaTable, FaCreditCard, FaCalendarAlt, FaPen } from "react-icons/fa";

import apiRequest from "../services/api";
import { fetchListadoPagosPeriodo, fetchResumenAnual } from "../services/coberturaPagosApi";
import { fetchCompanies } from "../services/companies";
import ModalMediosPago from "../components/ModalMediosPago";
import CobrosPeriodoResumen from "../components/CobrosPeriodoResumen";
import CorregirCobroModal from "../components/CorregirCobroModal";
import { renderClienteLink } from "./ListaClientes";
import { condicionCobro, tituloCondicionCobro } from "../utils/condicionCobro";
import {
  MESES_COBRO,
  etiquetaMes,
  formatearInstante,
  normalizarMes,
} from "../utils/periodoCobros";
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
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [pagos, setPagos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [anio, setAnio] = useState("");
  const [mes, setMes] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const anioRef = useRef(null);
  const mesRef = useRef(null);
  const [alerta, setAlerta] = useState({ show: false, variant: "", mensaje: "" });
  const [filtros, setFiltros] = useState({ cliente: "", compania: "", plan: "", estado: "", dia_pago: "" });
  const [paginaActual, setPaginaActual] = useState(1);
  const itemsPorPagina = 10;
  const [showMediosModal, setShowMediosModal] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [cobroACorregir, setCobroACorregir] = useState(null);
  const [companiasCatalogo, setCompaniasCatalogo] = useState([]);
  const [guardandoCorreccion, setGuardandoCorreccion] = useState(false);
  const [errorCorreccion, setErrorCorreccion] = useState("");

  const abrirCorreccion = async (pago) => {
    setErrorCorreccion("");
    setCobroACorregir(pago);
    if (companiasCatalogo.length === 0) {
      try {
        const catalogoCompanias = await fetchCompanies();
        setCompaniasCatalogo(Array.isArray(catalogoCompanias) ? catalogoCompanias : []);
      } catch {
        setCompaniasCatalogo([]);
      }
    }
  };

  const guardarCorreccion = async (payload) => {
    if (!cobroACorregir) return;
    setGuardandoCorreccion(true);
    setErrorCorreccion("");
    try {
      await apiRequest(`cobertura/pagos/${cobroACorregir.id}/corregir`, "POST", payload);
      mostrarAlerta("Se corrigieron los datos históricos de este cobro.");
      setCobroACorregir(null);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setErrorCorreccion(err.message || "No se pudo corregir el cobro.");
    } finally {
      setGuardandoCorreccion(false);
    }
  };

  const abrirModalMedios = (clienteId) => {
    setClienteSeleccionado(clienteId);
    setShowMediosModal(true);
  };

  const mostrarAlerta = (mensaje, tipo = "success", duracion = 5000) => {
    setAlerta({ show: true, variant: tipo, mensaje });
    setTimeout(() => setAlerta({ show: false, variant: "", mensaje: "" }), duracion);
  };

  useEffect(() => {
    let cancel = false;

    (async () => {
      setLoading(true);
      setErrorCarga(false);
      try {
        const anioGuardado = anioRef.current;
        const mesGuardado = mesRef.current;
        const resumenInicial = await fetchResumenAnual(anioGuardado || undefined);
        if (cancel) return;

        let anioUsado = anioGuardado;
        let mesUsado = mesGuardado;
        if (!anioUsado || !mesUsado) {
          anioUsado = String(resumenInicial.anio_actual);
          mesUsado = normalizarMes(resumenInicial.mes_actual);
          anioRef.current = anioUsado;
          mesRef.current = mesUsado;
          setAnio(anioUsado);
          setMes(mesUsado);
        }

        const resumenPeriodo =
          String(resumenInicial.anio) === String(anioUsado)
            ? resumenInicial
            : await fetchResumenAnual(anioUsado);
        if (cancel) return;

        const listado = await fetchListadoPagosPeriodo(anioUsado, mesUsado);
        if (cancel) return;

        setCatalogo(resumenPeriodo);
        setResumen(resumenPeriodo);
        setPagos(listado);
      } catch (err) {
        console.error("Error al cargar pagos:", err);
        if (!cancel) {
          setErrorCarga(true);
          setPagos([]);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [reloadKey]);

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

  const cambiarAnio = (valor) => {
    anioRef.current = String(valor);
    setAnio(String(valor));
    setPaginaActual(1);
    setReloadKey((key) => key + 1);
  };

  const cambiarMes = (valor) => {
    const mesNorm = normalizarMes(valor);
    if (!mesNorm) return;
    mesRef.current = mesNorm;
    setMes(mesNorm);
    setPaginaActual(1);
    setReloadKey((key) => key + 1);
  };

  const diaPagoFilter = parseDiaPagoFilter(filtros.dia_pago);

  const pagosFiltrados = pagos.filter((p) => {
    const cliente = p.cliente?.nombre_completo?.toLowerCase() || "";
    const compania = condicionCobro(p, "compania_nombre").texto.toLowerCase();
    const plan = condicionCobro(p, "plan").texto.toLowerCase();
    const estado = p.estado?.toLowerCase() || "";
    const fecha = p.fecha_pago || "";
    const dia = fecha.split("-")[2] || "";
    const diaNum = Number(String(dia).slice(0, 2));

    return (
      cliente.includes(filtros.cliente.toLowerCase()) &&
      compania.includes(filtros.compania.toLowerCase()) &&
      plan.includes(filtros.plan.toLowerCase()) &&
      (filtros.estado ? estado === filtros.estado.toLowerCase() : true) &&
      (diaPagoFilter
        ? diaPagoFilter.mode === "single"
          ? diaNum === diaPagoFilter.day
          : diaNum >= diaPagoFilter.from && diaNum <= diaPagoFilter.to
        : true)
    );
  });

  const indexInicio = (paginaActual - 1) * itemsPorPagina;
  const indexFin = indexInicio + itemsPorPagina;
  const pagosPaginados = pagosFiltrados.slice(indexInicio, indexFin);
  const totalPaginas = Math.ceil(pagosFiltrados.length / itemsPorPagina);

  const resumenVisible = resumen && String(resumen.anio) === String(anio) ? resumen : null;
  const mesInfo = resumenVisible?.meses?.find((item) => item.mes === mes) || null;
  const totalGenerado = mesInfo ? Number(mesInfo.cobros) || 0 : null;
  const nombrePeriodo = anio && mes ? `${etiquetaMes(mes)} ${anio}` : "";
  const ultimaGeneracion = formatearInstante(
    mesInfo?.ultima_generacion,
    resumenVisible?.timezone
  );
  const anioActual = catalogo?.anio_actual;
  const anios = useMemo(() => {
    const base = Array.isArray(catalogo?.anios_disponibles) ? catalogo.anios_disponibles : [];
    return Array.from(
      new Set(
        [...base, ...(anio ? [Number(anio)] : [])].filter(
          (year) => Number.isFinite(Number(year))
        )
      )
    )
      .map((year) => Number(year))
      .sort((a, b) => b - a);
  }, [catalogo, anio]);

  const textoChip = (() => {
    if (loading && totalGenerado == null) return "Cargando…";
    if (errorCarga) return "No fue posible cargar los datos";
    if (!nombrePeriodo || totalGenerado == null) return "Cargando…";
    return `${nombrePeriodo} · ${totalGenerado} cobro${totalGenerado === 1 ? "" : "s"} generado${totalGenerado === 1 ? "" : "s"}`;
  })();

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
            <span className="gf-listado__chip">{textoChip}</span>
            <Button
              size="sm"
              className="gf-listado__btn-ghost"
              onClick={() => setReloadKey((key) => key + 1)}
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
              <Col xs={12} md={6} lg={2}>
                <div className="gf-listado__label">Cliente</div>
                <Form.Control
                  placeholder="Filtrar por cliente"
                  name="cliente"
                  value={filtros.cliente}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col xs={12} md={6} lg={2}>
                <div className="gf-listado__label">Compañía</div>
                <Form.Control
                  placeholder="Filtrar por compañía"
                  name="compania"
                  value={filtros.compania}
                  onChange={handleFiltroChange}
                />
                <div className="gf-listado__label mt-2">Plan</div>
                <Form.Control
                  placeholder="Filtrar por plan"
                  name="plan"
                  value={filtros.plan}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col xs={6} md={4} lg={2}>
                <div className="gf-listado__label">Mes</div>
                <Form.Select
                  value={mes}
                  onChange={(e) => cambiarMes(e.target.value)}
                  aria-label="Mes del período"
                  disabled={!mes}
                >
                  {MESES_COBRO.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.etiqueta}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={6} md={4} lg={2}>
                <div className="gf-listado__label">Año</div>
                <Form.Select
                  value={anio}
                  onChange={(e) => cambiarAnio(e.target.value)}
                  aria-label="Año del período"
                  disabled={!anio}
                >
                  {anios.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                      {year === anioActual ? " (actual)" : ""}
                      {anioActual != null && year > anioActual ? " (futuro)" : ""}
                    </option>
                  ))}
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

          <div className="gf-listado__section">
            <div className="gf-listado__section-title">
              <FaCalendarAlt aria-hidden="true" />
              Cobros generados en {anio || "el año"}
            </div>
            {errorCarga ? (
              <div className="gf-listado__empty" role="status">
                No fue posible cargar los datos.
              </div>
            ) : resumenVisible ? (
              <CobrosPeriodoResumen
                anio={resumenVisible.anio}
                meses={resumenVisible.meses}
                mesSeleccionado={mes}
                onSeleccionarMes={cambiarMes}
                limitacion={resumenVisible.limitacion}
                registrosSinPeriodo={resumenVisible.registros_sin_periodo}
              />
            ) : (
              <div className="pagos-actualizar__loading">
                <Spinner animation="border" size="sm" role="status" />
              </div>
            )}
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

            {nombrePeriodo && totalGenerado != null && !errorCarga && (
              <div className="pagos-actualizar__periodo">
                <p className="pagos-actualizar__periodo-principal">
                  <strong>
                    {nombrePeriodo} · {totalGenerado} cobro{totalGenerado === 1 ? "" : "s"} generado
                    {totalGenerado === 1 ? "" : "s"}
                  </strong>
                </p>
                {ultimaGeneracion ? <p>Última generación: {ultimaGeneracion}</p> : null}
                {totalGenerado > 0 ? (
                  <p>
                    {pagosFiltrados.length} coinciden con los filtros de un total de {totalGenerado}{" "}
                    cobros generados. El estado de cada fila es el estado del pago, distinto de si
                    el cobro fue generado.
                  </p>
                ) : (
                  <p>El estado del pago se actualiza en cada fila y no equivale a la generación del cobro.</p>
                )}
              </div>
            )}

            {!loading && !errorCarga && pagosFiltrados.length > 0 && (
              <div className="gf-listado__summary">
                Mostrando{" "}
                <strong>
                  {indexInicio + 1}–{Math.min(indexFin, pagosFiltrados.length)}
                </strong>{" "}
                de <strong>{pagosFiltrados.length}</strong> resultados filtrados
                {totalGenerado != null ? (
                  <>
                    {" "}
                    · <strong>{totalGenerado}</strong> cobros generados en el período
                  </>
                ) : null}
              </div>
            )}

            {loading ? (
              <div className="pagos-actualizar__loading">
                <Spinner animation="border" role="status" />
                <div>Cargando pagos…</div>
              </div>
            ) : errorCarga ? (
              <div className="gf-listado__empty" role="status">
                No fue posible cargar los datos.
              </div>
            ) : totalGenerado === 0 ? (
              <div className="gf-listado__empty" role="status">
                El período {nombrePeriodo} todavía no tiene cobros generados.
              </div>
            ) : pagosFiltrados.length === 0 ? (
              <div className="gf-listado__empty" role="status">
                El período tiene cobros, pero ninguno coincide con los filtros.
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
                        <th>Plan</th>
                        <th>Tipo de pago</th>
                        <th>Monto</th>
                        <th className="text-center">Acciones</th>
                        <th>Estado del pago</th>
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
                          <td>
                            {(() => {
                              const condicion = condicionCobro(p, "codigo_poliza");
                              return (
                                <span className={condicion.pendiente ? "text-muted" : undefined} title={tituloCondicionCobro(condicion)}>
                                  {condicion.texto}
                                </span>
                              );
                            })()}
                          </td>
                          <td>
                            {renderClienteLink(
                              p.cliente?.id || p.cliente_id,
                              p.cliente?.nombre_completo || "—"
                            )}
                          </td>
                          <td>
                            {(() => {
                              const condicion = condicionCobro(p, "pagador_nombre");
                              return (
                                <span className={condicion.pendiente ? "text-muted" : undefined} title={tituloCondicionCobro(condicion)}>
                                  {condicion.texto}
                                </span>
                              );
                            })()}
                          </td>
                          <td>{p.fecha_pago || "—"}</td>
                          <td>
                            {(() => {
                              const condicion = condicionCobro(p, "compania_nombre");
                              return (
                                <span className={condicion.pendiente ? "text-muted" : undefined} title={tituloCondicionCobro(condicion)}>
                                  {condicion.texto}
                                </span>
                              );
                            })()}
                          </td>
                          <td>
                            {(() => {
                              const condicion = condicionCobro(p, "plan");
                              return (
                                <span className={condicion.pendiente ? "text-muted" : undefined} title={tituloCondicionCobro(condicion)}>
                                  {condicion.texto}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="pagos-actualizar__tipo-pago text-center">
                            {(() => {
                              const condicion = condicionCobro(p, "tipo_pago");
                              return (
                                <span className={condicion.pendiente ? "text-muted" : undefined} title={tituloCondicionCobro(condicion)}>
                                  {condicion.texto}
                                </span>
                              );
                            })()}
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
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="ms-1"
                              onClick={() => void abrirCorreccion(p)}
                            >
                              <FaPen className="me-1" aria-hidden="true" />
                              Corregir datos del cobro
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

      <CorregirCobroModal
        show={cobroACorregir != null}
        pago={cobroACorregir}
        companias={companiasCatalogo}
        guardando={guardandoCorreccion}
        error={errorCorreccion}
        onCancel={() => {
          if (!guardandoCorreccion) {
            setCobroACorregir(null);
            setErrorCorreccion("");
          }
        }}
        onGuardar={(payload) => void guardarCorreccion(payload)}
      />

      <ModalMediosPago
        show={showMediosModal}
        onHide={() => setShowMediosModal(false)}
        clienteId={clienteSeleccionado}
      />
    </Container>
  );
};

export default PagosActualizar;
