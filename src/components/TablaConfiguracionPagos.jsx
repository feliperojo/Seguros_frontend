import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Table, Form, Spinner, Badge, Row, Col, Button, Alert, Modal, Container } from "react-bootstrap";
import apiRequest from "../services/api";
import { fetchPagosExistForPeriodo } from "../services/coberturaPagosApi";
import { renderClienteLink } from "../pages/ListaClientes";

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
      if (err.response?.status === 409) {
        const msg =
          err.response?.data?.message ||
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
      } else {
        mostrarAlerta(
          err.response?.data?.message || "Ocurrió un error al generar los cobros",
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



    <Container fluid className="mt-4">
      <h2 className="text-primary">Generación de Pagos Mensuales</h2>
      <p className="text-muted">
        Consulta los parámetros de cobro configurados para las pólizas activas y genera automáticamente los registros de pago
        del mes seleccionado según el día de cobro asignado a cada cliente.
      </p>
      <Row className="mb-3 align-items-end">
        <Col md={3} lg={3} xl={3} xxl={3}>
          <Form.Control
            placeholder="Filtrar por cliente"
            name="cliente"
            value={filtros.cliente}
            onChange={handleFiltroChange}
          />
        </Col>
        <Col md={3} lg={3} xl={3} xxl={3}>
          <Form.Control
            placeholder="Filtrar por compañía"
            name="compania"
            value={filtros.compania}
            onChange={handleFiltroChange}
          />
        </Col>
        <Col md={2} lg={2} xl={2} xxl={2}>
          <Form.Control
            placeholder="Filtrar por responsable"
            name="responsable"
            value={filtros.responsable}
            onChange={handleFiltroChange}
          />
        </Col>
        <Col md={2} lg={2} xl={2} xxl={2}>
         <Form.Select value={mesSeleccionado} onChange={(e) => setMesSeleccionado(e.target.value)}>
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

        <Col md={2} lg={2} xl={2} xxl={2} className="text-end">
          <Button
            variant="primary"
            onClick={() => void confirmarGenerarCobros()}
            disabled={loading || validandoPagosMes || !mesSeleccionado || polizasFiltradas.length === 0}
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

      {mesSeleccionado && (
        <Row className="mb-2">
          <Col md={12}>
            {infoPagosMes.loading ? (
              <small className="text-muted">Comprobando pagos del mes…</small>
            ) : infoPagosMes.exists === true ? (
              <Alert variant="warning" className="py-2 mb-0 small">
                Ya existen pagos generados para el periodo{" "}
                <strong>{infoPagosMes.periodo}</strong>
                {infoPagosMes.count != null ? (
                  <>
                    {" "}
                    ({infoPagosMes.count} registro{infoPagosMes.count !== 1 ? "s" : ""})
                  </>
                ) : null}
                . No podrá generar de nuevo hasta usar otro mes (según reglas del sistema).
              </Alert>
            ) : infoPagosMes.exists === false ? (
              <small className="text-muted">
                Periodo <strong>{infoPagosMes.periodo}</strong>: no hay pagos generados aún; puede
                continuar con la generación.
              </small>
            ) : null}
          </Col>
        </Row>
      )}

      {alerta.show && (
        <Alert variant={alerta.variant} className="text-center">
          {alerta.mensaje}
        </Alert>
      )}

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
          <Button variant="primary" onClick={() => setShowPagosYaExistenModal(false)}>
            Entendido
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar generación de cobros</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Está a punto de generar los registros de cobro para <strong>{polizasFiltradas.length}</strong> póliza(s) activas correspondientes al mes seleccionado.
          <br />
          Estos registros se crearán en base a los parámetros configurados para cada póliza.
          <br /><br />
          ¿Desea continuar con este proceso?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>Cancelar</Button>
          <Button variant="primary" onClick={handleGenerarCobros}>Generar</Button>
        </Modal.Footer>
      </Modal>

      {loading ? (
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      ) : (
        <div className="table-responsive">
          <Table striped bordered hover responsive="lg" className="shadow-sm w-100">
            <thead className="table-light text-center">
              <tr>
                <th>ID GF</th>
                <th>ID Póliza</th>
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
                        className="text-decoration-none fw-semibold"
                        title={`Ver grupo familiar #${p.grupo_familiar_id}`}
                      >
                        {p.grupo_familiar_id}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{p.codigo_poliza}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {renderClienteLink(
                      p.cliente?.id || p.cliente_id,
                      p.cliente?.nombre_completo || "-"
                    )}
                    {p.parentesco === "TOMADOR" && <Badge bg="primary" className="ms-2">Tomador</Badge>}
                  </td>
                  <td>{p.pagador?.nombre_completo || "-"}</td>
                  <td>{p.compania?.nombre || "-"}</td>
                  <td>{p.precio ? `$${Number(p.precio).toFixed(2)}` : "-"}</td>
                  <td className="text-center">{p.dia_pago || "-"}</td>
                  <td className="text-center">{p.tipo_pago || "-"}</td>
                  <td>{p.grupo_familiar?.responsable || "-"}</td>
                  <td className="text-center">
                    {p.activo ? <Badge bg="success">Activa</Badge> : <Badge bg="secondary">Cancelada</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

        </div>
      )}
    </Container>

  );
};

export default TablaConfiguracionPagos;