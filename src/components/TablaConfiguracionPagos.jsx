import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Table, Form, Spinner, Badge, Row, Col, Button, Alert, Modal, Container } from "react-bootstrap";
import apiRequest from "../services/api";
import { fetchPagosExistForPeriodo } from "../services/coberturaPagosApi";
import { renderClienteLink } from "../pages/ListaClientes";
import {
  COBERTURA_TIPO_DENTAL_MS,
  isDentalCoberturaTipo,
} from "../constants/coberturaTipos";
import "./TablaConfiguracionPagos.css";

const etiquetaProducto = (coberturaTipo) => {
  if (isDentalCoberturaTipo(coberturaTipo)) return COBERTURA_TIPO_DENTAL_MS;
  const tipo = String(coberturaTipo ?? "").trim();
  return tipo || "Salud MS";
};

const TablaConfiguracionPagos = () => {
  const [loading, setLoading] = useState(false);
  const [polizas, setPolizas] = useState([]);
  const [filtros, setFiltros] = useState({ cliente: "", compania: "", responsable: "" });
  const [mesSeleccionado, setMesSeleccionado] = useState("");
  const [alerta, setAlerta] = useState({ show: false, variant: "", mensaje: "" });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [validandoPagosMes, setValidandoPagosMes] = useState(false);
  /** Vista previa GET /pagos/existe para el mes+año actual */
  const [infoPagosMes, setInfoPagosMes] = useState({
    loading: false,
    periodo: null,
    exists: null,
    count: null,
  });
  const [showPagosYaExistenModal, setShowPagosYaExistenModal] = useState(false);
  const [pagosYaExistenDetalle, setPagosYaExistenDetalle] = useState({ periodo: "", count: null });
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

  const periodoParaMes = (mesDosDigitos) => {
    if (!mesDosDigitos) return null;
    return `${new Date().getFullYear()}-${mesDosDigitos}`;
  };

  useEffect(() => {
    const periodo = periodoParaMes(mesSeleccionado);
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
      } catch (e) {
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
  }, [mesSeleccionado]);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros({ ...filtros, [name]: value });
  };

  const confirmarGenerarCobros = async () => {
    if (!mesSeleccionado) {
      mostrarAlerta("Seleccione un mes para generar los cobros", "warning");
      return;
    }
    if (polizasFiltradas.length === 0) {
      mostrarAlerta("No hay pólizas válidas para generar cobros", "warning");
      return;
    }

    const periodo = periodoParaMes(mesSeleccionado);
    if (!periodo) {
      mostrarAlerta("Mes no válido", "warning");
      return;
    }

    setValidandoPagosMes(true);
    try {
      const { exists, count } = await fetchPagosExistForPeriodo(periodo);
      if (exists) {
        setPagosYaExistenDetalle({ periodo, count });
        setShowPagosYaExistenModal(true);
        return;
      }
      setShowConfirmModal(true);
    } catch (e) {
      console.error("No se pudo validar pagos del mes:", e);
      mostrarAlerta(
        "No se pudo comprobar si ya hay pagos para este mes. Intente de nuevo o contacte soporte.",
        "warning"
      );
    } finally {
      setValidandoPagosMes(false);
    }
  };

  const handleGenerarCobros = async () => {
    setShowConfirmModal(false);
    try {
      setLoading(true);
      await apiRequest("cobertura/generar-cobros", "POST", {
        mes: mesSeleccionado,
        cobertura_ids: polizasFiltradas.map((p) => p.id),
      });
      mostrarAlerta("Cobros generados correctamente", "success");
      const periodo = periodoParaMes(mesSeleccionado);
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

      if (status === 409) {
        const msg =
          data.message ||
          "Ya existen pagos generados para este mes. No se puede repetir la generación.";
        mostrarAlerta(msg, "warning");
        const periodo = periodoParaMes(mesSeleccionado);
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
      } else if (
        status === 422 &&
        (data.code === "COBERTURAS_INCONSISTENTES" || inconsistencias.length > 0)
      ) {
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
        mostrarAlerta(
          data.message || err.message || "Ocurrió un error al generar los cobros",
          "danger"
        );
      }
    } finally {
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
              <Col md={3}>
                <div className="pagos-mensuales__label">Cliente</div>
                <Form.Control
                  placeholder="Filtrar por cliente"
                  name="cliente"
                  value={filtros.cliente}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col md={3}>
                <div className="pagos-mensuales__label">Compañía</div>
                <Form.Control
                  placeholder="Filtrar por compañía"
                  name="compania"
                  value={filtros.compania}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col md={2}>
                <div className="pagos-mensuales__label">Responsable</div>
                <Form.Control
                  placeholder="Filtrar por responsable"
                  name="responsable"
                  value={filtros.responsable}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col md={2}>
                <div className="pagos-mensuales__label">Mes</div>
                <Form.Select
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(e.target.value)}
                >
                  <option value="">Seleccionar mes</option>
                  {[...Array(12)].map((_, i) => {
                    const mes = new Date(0, i).toLocaleString("es", { month: "long" });
                    const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
                    return (
                      <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                        {mesCapitalizado}
                      </option>
                    );
                  })}
                </Form.Select>
              </Col>
              <Col md={2} className="text-md-end">
                <Button
                  className="pagos-mensuales__btn-primary w-100"
                  onClick={() => void confirmarGenerarCobros()}
                  disabled={
                    loading ||
                    validandoPagosMes ||
                    !mesSeleccionado ||
                    polizasFiltradas.length === 0
                  }
                >
                  {validandoPagosMes ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Validando…
                    </>
                  ) : (
                    "Generar pagos"
                  )}
                </Button>
              </Col>
            </Row>
          </div>

          {mesSeleccionado && (
            <>
              {infoPagosMes.loading ? (
                <div className="pagos-mensuales__notice">
                  <i className="fas fa-info-circle pagos-mensuales__notice-icon" aria-hidden="true" />
                  <span>Comprobando pagos del mes…</span>
                </div>
              ) : infoPagosMes.exists === true ? (
                <div className="pagos-mensuales__notice pagos-mensuales__notice--warn">
                  <i className="fas fa-exclamation-triangle pagos-mensuales__notice-icon" aria-hidden="true" />
                  <span>
                    Ya existen pagos generados para el periodo{" "}
                    <strong>{infoPagosMes.periodo}</strong>
                    {infoPagosMes.count != null ? (
                      <>
                        {" "}
                        ({infoPagosMes.count} registro
                        {infoPagosMes.count !== 1 ? "s" : ""})
                      </>
                    ) : null}
                    . No podrá generar de nuevo hasta usar otro mes.
                  </span>
                </div>
              ) : infoPagosMes.exists === false ? (
                <div className="pagos-mensuales__notice">
                  <i className="fas fa-info-circle pagos-mensuales__notice-icon" aria-hidden="true" />
                  <span>
                    Periodo <strong>{infoPagosMes.periodo}</strong>: no hay pagos generados aún;
                    puede continuar con la generación.
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

      <Modal show={showPagosYaExistenModal} onHide={() => setShowPagosYaExistenModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Pagos ya generados</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">
            Ya existen pagos generados para el mes{" "}
            <strong>{pagosYaExistenDetalle.periodo}</strong>
            {pagosYaExistenDetalle.count != null ? (
              <>
                {" "}
                ({pagosYaExistenDetalle.count} registro
                {pagosYaExistenDetalle.count !== 1 ? "s" : ""})
              </>
            ) : null}
            . No es posible generar cobros duplicados para este periodo.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            className="pagos-mensuales__btn-primary"
            onClick={() => setShowPagosYaExistenModal(false)}
          >
            Entendido
          </Button>
        </Modal.Footer>
      </Modal>

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

      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar generación de cobros</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Está a punto de generar los registros de cobro para{" "}
          <strong>{polizasFiltradas.length}</strong> póliza(s) activas correspondientes al mes
          seleccionado.
          <br />
          Estos registros se crearán en base a los parámetros configurados para cada póliza.
          <br />
          <br />
          ¿Desea continuar con este proceso?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowConfirmModal(false)}>
            Cancelar
          </Button>
          <Button className="pagos-mensuales__btn-primary" onClick={handleGenerarCobros}>
            Generar
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default TablaConfiguracionPagos;