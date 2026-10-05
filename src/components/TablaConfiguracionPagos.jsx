import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Table, Form, Spinner, Badge, Row, Col, Button, Alert, Modal, Container } from "react-bootstrap";
import apiRequest from "../services/api";
import { fetchPagosExistForPeriodo, fetchResumenAnual } from "../services/coberturaPagosApi";
import { fetchCompanies } from "../services/companies";
import CobrosPeriodoResumen from "./CobrosPeriodoResumen";
import VistaPreviaCobrosModal from "./VistaPreviaCobrosModal";
import { MESES_COBRO, etiquetaMes } from "../utils/periodoCobros";
import { renderClienteLink } from "../pages/ListaClientes";
import {
  COBERTURA_TIPO_DENTAL_MS,
  isDentalMsCoberturaTipo,
} from "../constants/coberturaTipos";
import "./TablaConfiguracionPagos.css";

const etiquetaProducto = (coberturaTipo) => {
  if (isDentalMsCoberturaTipo(coberturaTipo)) return COBERTURA_TIPO_DENTAL_MS;
  const tipo = String(coberturaTipo ?? "").trim();
  return tipo || "Salud MS";
};

const TablaConfiguracionPagos = () => {
  const [loading, setLoading] = useState(false);
  const [polizas, setPolizas] = useState([]);
  const [filtros, setFiltros] = useState({ cliente: "", compania: "", responsable: "" });
  const [mesSeleccionado, setMesSeleccionado] = useState("");
  const [alerta, setAlerta] = useState({ show: false, variant: "", mensaje: "" });
  const [showVistaPrevia, setShowVistaPrevia] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [errorVista, setErrorVista] = useState("");
  const [companiasCatalogo, setCompaniasCatalogo] = useState([]);
  const [validandoPagosMes, setValidandoPagosMes] = useState(false);
  const [anioSeleccionado, setAnioSeleccionado] = useState("");
  const [periodoNegocio, setPeriodoNegocio] = useState(null);
  const [resumenAnual, setResumenAnual] = useState(null);
  const [resumenVersion, setResumenVersion] = useState(0);
  const [errorPeriodo, setErrorPeriodo] = useState(false);
  const generandoRef = useRef(false);
  /** Vista previa GET /pagos/existe para el mes+año actual */
  const [infoPagosMes, setInfoPagosMes] = useState({
    loading: false,
    periodo: null,
    exists: null,
    count: null,
  });
  const [showInconsistenciasModal, setShowInconsistenciasModal] = useState(false);
  const [inconsistenciasDetalle, setInconsistenciasDetalle] = useState({
    message: "",
    inconsistencias: [],
  });

  const mostrarAlerta = (mensaje, tipo = "success", duracion = 5000) => {
    setAlerta({ show: true, variant: tipo, mensaje });
    setTimeout(() => {
      setAlerta({ show: false, variant: "", mensaje: "" });
    }, duracion);
  };

  const fetchPolizas = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("cobertura/activas", "GET");
      const normalizado = response.map(p => ({
        ...p,
        precio: p.precio ? Number(p.precio) : 0,
        id: p.id || p.cobertura_id || Math.random(),
      }));
      setPolizas(normalizado);
    } catch (err) {
      console.error("Error al cargar polizas activas:", err);
      mostrarAlerta("Error al cargar las pólizas activas", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolizas();
  }, []);

  const periodoParaMes = (mesDosDigitos, anio) => {
    if (!mesDosDigitos || !anio) return null;
    return `${anio}-${mesDosDigitos}`;
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const resumen = await fetchResumenAnual(anioSeleccionado || undefined);
        if (cancel) return;
        setErrorPeriodo(false);
        setPeriodoNegocio(resumen);
        if (!anioSeleccionado) {
          setAnioSeleccionado(String(resumen.anio_actual));
          return;
        }
        if (String(resumen.anio) === String(anioSeleccionado)) {
          setResumenAnual(resumen);
        }
      } catch (err) {
        console.error("No se pudo cargar el resumen de cobros:", err);
        if (!cancel) setErrorPeriodo(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [anioSeleccionado, resumenVersion]);

  useEffect(() => {
    const periodo = periodoParaMes(mesSeleccionado, anioSeleccionado);
    if (!periodo) {
      setInfoPagosMes({ loading: false, periodo: null, exists: null, count: null });
      return;
    }

    let cancel = false;
    setInfoPagosMes((prev) => ({ ...prev, loading: true, periodo }));

    (async () => {
      try {
        const r = await fetchPagosExistForPeriodo(periodo);
        if (!cancel) {
          setInfoPagosMes({
            loading: false,
            periodo: r.periodo,
            exists: r.exists,
            count: r.count,
          });
        }
      } catch {
        if (!cancel) {
          setInfoPagosMes({
            loading: false,
            periodo,
            exists: null,
            count: null,
          });
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [mesSeleccionado, anioSeleccionado]);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros({ ...filtros, [name]: value });
  };

  const cargarVistaPrevia = async () => {
    if (generandoRef.current) return;
    if (!mesSeleccionado || !anioSeleccionado) {
      mostrarAlerta("Seleccione el mes y el año para generar los cobros", "warning");
      return;
    }
    if (polizasFiltradas.length === 0) {
      mostrarAlerta("No hay pólizas válidas para generar cobros", "warning");
      return;
    }

    setValidandoPagosMes(true);
    setErrorVista("");
    try {
      const [respuesta, catalogo] = await Promise.all([
        apiRequest("cobertura/generar-cobros/vista-previa", "POST", {
          mes: mesSeleccionado,
          anio: Number(anioSeleccionado),
          cobertura_ids: polizasFiltradas.map((p) => p.id),
        }),
        fetchCompanies().catch(() => []),
      ]);
      const vista = respuesta?.data?.items ? respuesta.data : respuesta;
      setVistaPrevia(vista);
      setCompaniasCatalogo(Array.isArray(catalogo) ? catalogo : []);
      setShowVistaPrevia(true);
    } catch (err) {
      console.error("No se pudo armar la vista previa:", err);
      mostrarAlerta(err.message || "No se pudo preparar la revisión de los cobros.", "warning");
    } finally {
      setValidandoPagosMes(false);
    }
  };

  const cerrarVistaPrevia = () => {
    if (generandoRef.current) return;
    setShowVistaPrevia(false);
    setVistaPrevia(null);
    setErrorVista("");
  };

  const handleGenerarCobros = async ({ ajustes, confirmarDatosPeriodo }) => {
    if (generandoRef.current || !vistaPrevia) return;
    generandoRef.current = true;
    try {
      setLoading(true);
      const data = await apiRequest("cobertura/generar-cobros", "POST", {
        mes: mesSeleccionado,
        anio: Number(anioSeleccionado),
        cobertura_ids: polizasFiltradas.map((p) => p.id),
        huella: vistaPrevia.huella,
        confirmar_datos_periodo: Boolean(confirmarDatosPeriodo),
        ajustes,
      });
      const nuevos = Number(data?.nuevos_registros ?? 0);
      const existentes = Number(data?.pagos_existentes ?? 0);
      mostrarAlerta(
        data?.message ||
          `Se crearon ${nuevos} cobros. ${existentes} ya existían y se conservaron.`,
        "success",
        8000
      );
      setShowVistaPrevia(false);
      setVistaPrevia(null);
      setErrorVista("");
      setResumenVersion((version) => version + 1);
      const periodo = periodoParaMes(mesSeleccionado, anioSeleccionado);
      if (periodo) {
        try {
          const r = await fetchPagosExistForPeriodo(periodo);
          setInfoPagosMes({
            loading: false,
            periodo: r.periodo,
            exists: r.exists,
            count: r.count,
          });
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.error("Error al generar cobros:", err);
      const status = err.response?.status;
      const data = err.response?.data || {};
      const inconsistencias = Array.isArray(data.inconsistencias)
        ? data.inconsistencias
        : [];

      if (status === 409 && data.code === "REVISION_DESACTUALIZADA") {
        setErrorVista(
          data.message ||
            "Los datos de las coberturas cambiaron durante la revisión. Actualice la vista previa antes de generar."
        );
      } else if (
        status === 422 &&
        (data.code === "COBERTURAS_INCONSISTENTES" || inconsistencias.length > 0)
      ) {
        setShowVistaPrevia(false);
        setInconsistenciasDetalle({
          message:
            data.message ||
            "No se generaron los pagos por inconsistencias en algunas coberturas.",
          inconsistencias,
        });
        setShowInconsistenciasModal(true);
        mostrarAlerta(
          data.message ||
            "No se generaron los pagos: revise las coberturas con inconsistencias.",
          "danger",
          8000
        );
      } else {
        setErrorVista(data.message || err.message || "Ocurrió un error al generar los cobros");
      }
    } finally {
      generandoRef.current = false;
      setLoading(false);
    }
  };

  const polizasFiltradas = polizas.filter((p) => {
    const clienteNombre = p.cliente?.nombre_completo || "";
    const companiaNombre = p.compania?.nombre || "";
    const responsableNombre = p.grupo_familiar?.responsable || "";
    return (
      clienteNombre.toLowerCase().includes(filtros.cliente.toLowerCase()) &&
      companiaNombre.toLowerCase().includes(filtros.compania.toLowerCase()) &&
      responsableNombre.toLowerCase().includes(filtros.responsable.toLowerCase())
    );
  }).sort((a, b) => (a.grupo_familiar_id || 0) - (b.grupo_familiar_id || 0));

  const aniosGeneracion = Array.from(
    new Set(
      [
        ...(periodoNegocio?.anios_disponibles || []),
        periodoNegocio?.anio_actual,
      ].filter((year) => Number(year) <= Number(periodoNegocio?.anio_actual))
    )
  )
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => b - a);

  const resumenVisible =
    resumenAnual && String(resumenAnual.anio) === String(anioSeleccionado) ? resumenAnual : null;

  return (
    <Container fluid className="mt-4 mb-4">
      <div className="pagos-mensuales">
        <div className="pagos-mensuales__header">
          <div className="pagos-mensuales__header-icon" aria-hidden="true">
            <i className="fas fa-file-invoice-dollar" />
          </div>
          <div>
            <h2 className="pagos-mensuales__title">Generación de Pagos Mensuales</h2>
            <p className="pagos-mensuales__subtitle">
              Consulta los parámetros de cobro de las pólizas activas y genera los registros de pago
              del mes seleccionado según el día de cobro de cada cobertura.
            </p>
          </div>
        </div>

        <div className="pagos-mensuales__body">
          <div className="pagos-mensuales__section">
            <div className="pagos-mensuales__section-title">
              <i className="fas fa-filter" aria-hidden="true" />
              Filtros y generación
            </div>
            <Row className="g-3 align-items-end">
              <Col md={4} lg={2}>
                <div className="pagos-mensuales__label">Cliente</div>
                <Form.Control
                  placeholder="Filtrar por cliente"
                  name="cliente"
                  value={filtros.cliente}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col md={4} lg={2}>
                <div className="pagos-mensuales__label">Compañía</div>
                <Form.Control
                  placeholder="Filtrar por compañía"
                  name="compania"
                  value={filtros.compania}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col md={4} lg={2}>
                <div className="pagos-mensuales__label">Responsable</div>
                <Form.Control
                  placeholder="Filtrar por responsable"
                  name="responsable"
                  value={filtros.responsable}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col md={4} lg={2}>
                <div className="pagos-mensuales__label">Mes</div>
                <Form.Select
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(e.target.value)}
                  aria-label="Mes del período"
                >
                  <option value="">Seleccionar mes</option>
                  {MESES_COBRO.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.etiqueta}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4} lg={2}>
                <div className="pagos-mensuales__label">Año</div>
                <Form.Select
                  value={anioSeleccionado}
                  onChange={(e) => setAnioSeleccionado(e.target.value)}
                  aria-label="Año del período"
                  disabled={aniosGeneracion.length === 0}
                >
                  {aniosGeneracion.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                      {year === periodoNegocio?.anio_actual ? " (actual)" : ""}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4} lg={2} className="text-md-end">
                <Button
                  className="pagos-mensuales__btn-primary w-100"
                  onClick={() => void cargarVistaPrevia()}
                  disabled={
                    loading ||
                    validandoPagosMes ||
                    !mesSeleccionado ||
                    !anioSeleccionado ||
                    polizasFiltradas.length === 0
                  }
                >
                  {validandoPagosMes ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Revisando…
                    </>
                  ) : (
                    "Generar pagos"
                  )}
                </Button>
              </Col>
            </Row>
          </div>

          <div className="pagos-mensuales__section">
            <div className="pagos-mensuales__section-title">
              <i className="fas fa-calendar-alt" aria-hidden="true" />
              Cobros generados en {anioSeleccionado || "el año"}
            </div>
            {errorPeriodo ? (
              <div className="pagos-mensuales__notice pagos-mensuales__notice--warn">
                <i className="fas fa-exclamation-triangle pagos-mensuales__notice-icon" aria-hidden="true" />
                <span>
                  No fue posible cargar los datos del período.{" "}
                  <Button
                    variant="link"
                    className="p-0 align-baseline"
                    onClick={() => setResumenVersion((version) => version + 1)}
                  >
                    Reintentar
                  </Button>
                </span>
              </div>
            ) : resumenVisible ? (
              <CobrosPeriodoResumen
                anio={resumenVisible.anio}
                meses={resumenVisible.meses}
                mesSeleccionado={mesSeleccionado}
                onSeleccionarMes={setMesSeleccionado}
                limitacion={resumenVisible.limitacion}
                registrosSinPeriodo={resumenVisible.registros_sin_periodo}
              />
            ) : (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" style={{ color: "#1a365d" }} />
              </div>
            )}
          </div>

          {mesSeleccionado && anioSeleccionado && (
            <>
              {infoPagosMes.loading ? (
                <div className="pagos-mensuales__notice">
                  <i className="fas fa-info-circle pagos-mensuales__notice-icon" aria-hidden="true" />
                  <span>Comprobando cobros del período…</span>
                </div>
              ) : infoPagosMes.exists === true ? (
                <div className="pagos-mensuales__notice pagos-mensuales__notice--warn">
                  <i className="fas fa-exclamation-triangle pagos-mensuales__notice-icon" aria-hidden="true" />
                  <span>
                    Ya hay cobros generados para{" "}
                    <strong>
                      {etiquetaMes(mesSeleccionado)} {anioSeleccionado}
                    </strong>
                    {infoPagosMes.count != null ? (
                      <>
                        {" "}
                        ({infoPagosMes.count} cobro
                        {infoPagosMes.count !== 1 ? "s" : ""})
                      </>
                    ) : null}
                    . Generar creará solo los faltantes y conservará importe, estado y ajustes de
                    los existentes. Esto no significa que el pago haya sido recibido.
                  </span>
                </div>
              ) : infoPagosMes.exists === false ? (
                <div className="pagos-mensuales__notice">
                  <i className="fas fa-info-circle pagos-mensuales__notice-icon" aria-hidden="true" />
                  <span>
                    <strong>
                      {etiquetaMes(mesSeleccionado)} {anioSeleccionado}
                    </strong>
                    : todavía no tiene cobros generados.
                  </span>
                </div>
              ) : null}
            </>
          )}

          {alerta.show && (
            <Alert variant={alerta.variant} className="text-center mb-3">
              {alerta.mensaje}
            </Alert>
          )}

          <div className="pagos-mensuales__section mb-0">
            <div className="pagos-mensuales__section-title">
              <i className="fas fa-list" aria-hidden="true" />
              Pólizas activas
            </div>
            <div className="pagos-mensuales__summary">
              Mostrando <strong>{polizasFiltradas.length}</strong> de{" "}
              <strong>{polizas.length}</strong> coberturas
            </div>

            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" style={{ color: "#1a365d" }} />
              </div>
            ) : (
              <div className="pagos-mensuales__table-wrap table-responsive">
                <Table hover responsive="lg" className="pagos-mensuales__table w-100">
                  <thead className="text-center">
                    <tr>
                      <th>ID GF</th>
                      <th>ID Póliza</th>
                      <th>Producto</th>
                      <th>Cliente</th>
                      <th>Pagador</th>
                      <th>Compañía</th>
                      <th>Precio</th>
                      <th>Día de Pago</th>
                      <th>Tipo de Pago</th>
                      <th>Responsable</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {polizasFiltradas.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.grupo_familiar_id ? (
                            <Link
                              to={`/grupo_familiar/${p.grupo_familiar_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="pagos-mensuales__link"
                              title={`Ver grupo familiar #${p.grupo_familiar_id}`}
                            >
                              {p.grupo_familiar_id}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{p.codigo_poliza}</td>
                        <td className="pagos-mensuales__producto">
                          {etiquetaProducto(p.cobertura_tipo)}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {renderClienteLink(
                            p.cliente?.id || p.cliente_id,
                            p.cliente?.nombre_completo || "-"
                          )}
                          {p.parentesco === "TOMADOR" && (
                            <Badge className="ms-2 pagos-mensuales__badge-tomador">Tomador</Badge>
                          )}
                        </td>
                        <td>{p.pagador?.nombre_completo || "-"}</td>
                        <td>{p.compania?.nombre || "-"}</td>
                        <td>{p.precio ? `$${Number(p.precio).toFixed(2)}` : "-"}</td>
                        <td className="text-center">{p.dia_pago || "-"}</td>
                        <td className="text-center">{p.tipo_pago || "-"}</td>
                        <td>{p.grupo_familiar?.responsable || "-"}</td>
                        <td className="text-center">
                          {p.activo ? (
                            <Badge bg="success" className="pagos-mensuales__badge-estado">
                              Activa
                            </Badge>
                          ) : (
                            <Badge bg="secondary" className="pagos-mensuales__badge-estado">
                              Cancelada
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        show={showInconsistenciasModal}
        onHide={() => setShowInconsistenciasModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>No se pudieron generar los pagos</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3">
            {inconsistenciasDetalle.message ||
              "Hay coberturas con datos incompletos o inconsistentes. Corrija lo indicado y vuelva a intentar."}
          </p>
          <p className="text-muted small mb-2">
            No se creó ningún pago. Ajuste estas coberturas en su grupo familiar y reintente la generación.
          </p>
          <div className="table-responsive" style={{ maxHeight: "50vh" }}>
            <Table bordered hover size="sm" className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>ID GF</th>
                  <th>Póliza</th>
                  <th>Cliente</th>
                  <th>Motivos</th>
                </tr>
              </thead>
              <tbody>
                {inconsistenciasDetalle.inconsistencias.map((item, idx) => (
                  <tr key={`${item.cobertura_id}-${idx}`}>
                    <td className="text-nowrap">
                      {item.grupo_familiar_id ? (
                        <Link
                          to={`/grupo_familiar/${item.grupo_familiar_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pagos-mensuales__link"
                        >
                          {item.grupo_familiar_id}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {item.grupo_contacto ? (
                        <div className="text-muted small">{item.grupo_contacto}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="fw-semibold">{item.codigo_poliza || "—"}</div>
                      <div className="text-muted small">Cob. #{item.cobertura_id}</div>
                    </td>
                    <td>{item.cliente_nombre || "—"}</td>
                    <td>
                      <ul className="mb-0 ps-3">
                        {(item.motivos || []).map((motivo, mIdx) => (
                          <li key={mIdx}>{motivo}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            className="pagos-mensuales__btn-primary"
            onClick={() => setShowInconsistenciasModal(false)}
          >
            Entendido
          </Button>
        </Modal.Footer>
      </Modal>

      <VistaPreviaCobrosModal
        show={showVistaPrevia}
        vista={vistaPrevia}
        companias={companiasCatalogo}
        error={errorVista}
        generando={loading}
        onCancel={cerrarVistaPrevia}
        onActualizar={() => void cargarVistaPrevia()}
        onConfirmar={(revision) => void handleGenerarCobros(revision)}
      />
    </Container>
  );
};

export default TablaConfiguracionPagos;