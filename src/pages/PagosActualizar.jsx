import React, { useEffect, useState } from "react";
import {
  Table,
  Spinner,
  Alert,
  Form,
  Container,
  Row,
  Col,
  Pagination,
  Badge
} from "react-bootstrap";
import apiRequest from "../services/api";

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

  const handleEstadoChange = async (pagoId, nuevoEstado) => {
    try {
      await apiRequest(`cobertura/pagos/${pagoId}`, "PUT", { estado: nuevoEstado });

      setPagos((prev) => prev.map((p) => (p.id === pagoId ? { ...p, estado: nuevoEstado } : p)));
      mostrarAlerta("Estado actualizado correctamente", "success");
    } catch (err) {
      console.error("Error al actualizar el estado:", err);
      mostrarAlerta("Error al actualizar el estado del pago", "danger");
    }
  };

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
    setPaginaActual(1);
  };

  const pagosFiltrados = pagos.filter((p) => {
    const cliente = p.cliente?.nombre_completo?.toLowerCase() || "";
    const compania = p.cobertura?.compania?.nombre?.toLowerCase() || "";
    const estado = p.estado?.toLowerCase() || "";
    const fecha = p.fecha_pago || "";
    const dia = fecha.split("-")[2] || "";

    return (
      cliente.includes(filtros.cliente.toLowerCase()) &&
      compania.includes(filtros.compania.toLowerCase()) &&
      (filtros.estado ? estado === filtros.estado.toLowerCase() : true) &&
      (filtros.dia_pago ? dia === filtros.dia_pago.padStart(2, "0") : true) &&
      fecha.includes(`-${mesActual}-`)
    );
  });

  const indexInicio = (paginaActual - 1) * itemsPorPagina;
  const indexFin = indexInicio + itemsPorPagina;
  const pagosPaginados = pagosFiltrados.slice(indexInicio, indexFin);

  const totalPaginas = Math.ceil(pagosFiltrados.length / itemsPorPagina);

  return (
    <Container fluid className="mt-4">
      <h2 className="text-primary">Actualización de Pagos Generados</h2>
      <p className="text-muted">Visualiza y actualiza el estado de los pagos generados.</p>

      <Row className="mb-3">
        <Col md={3}>
          <Form.Control
            placeholder="Filtrar por cliente"
            name="cliente"
            value={filtros.cliente}
            onChange={handleFiltroChange}
          />
        </Col>
        <Col md={3}>
          <Form.Control
            placeholder="Filtrar por compañía"
            name="compania"
            value={filtros.compania}
            onChange={handleFiltroChange}
          />
        </Col>
        <Col md={2}>
            <Form.Select value={mesActual} onChange={(e) => setMesActual(e.target.value)}>
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

        <Col md={2}>
          <Form.Control
            placeholder="Día de pago (01-31)"
            name="dia_pago"
            value={filtros.dia_pago}
            onChange={handleFiltroChange}
            type="number"
            min="1"
            max="31"
          />
        </Col>
        <Col md={2}>
          <Form.Select name="estado" value={filtros.estado} onChange={handleFiltroChange}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="procesando">Procesando</option>
          </Form.Select>
        </Col>
      </Row>

      {alerta.show && (
        <Alert variant={alerta.variant} className="text-center">
          {alerta.mensaje}
        </Alert>
      )}

      {loading ? (
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      ) : (
        <div className="table-responsive">
          <Table striped bordered hover responsive className="shadow-sm w-100">
            <thead className="table-light text-center">
              <tr>
                <th>ID GF</th>
                <th>ID Póliza</th>
                <th>Cliente</th>
                <th>Pagador</th>
                <th>Fecha de Pago</th>
                <th>Compañía</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pagosPaginados.map((p) => (
                <tr key={p.id}>
                  <td>{p.grupo_familiar_id || "-"}</td>
                  <td>{p.cobertura?.codigo_poliza}</td>
                  <td>{p.cliente?.nombre_completo || "-"}</td>
                  <td>{p.cobertura?.pagador?.nombre_completo || "-"}</td>
                  <td>{p.fecha_pago || "-"}</td>
                  <td>{p.cobertura?.compania?.nombre || "-"}</td>
                  <td>${Number(p.monto).toFixed(2)}</td>
                  <td>
                    <Form.Select
                      value={p.estado}
                      onChange={(e) => handleEstadoChange(p.id, e.target.value)}
                      className={`text-white text-center fw-bold ${
                        p.estado === "pagado"
                          ? "bg-success"
                          : p.estado === "pendiente"
                          ? "bg-warning"
                          : "bg-secondary"
                      }`}
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

          {totalPaginas > 1 && (
            <Pagination className="justify-content-center">
              {[...Array(totalPaginas)].map((_, i) => (
                <Pagination.Item
                  key={i + 1}
                  active={i + 1 === paginaActual}
                  onClick={() => setPaginaActual(i + 1)}
                >
                  {i + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          )}
        </div>
      )}
    </Container>
  );
};

export default PagosActualizar;
