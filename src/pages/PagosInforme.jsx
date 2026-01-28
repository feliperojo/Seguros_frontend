import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Table, Spinner, Alert, Form, Container, Row, Col, Pagination } from "react-bootstrap";
import apiRequest from "../services/api";
import { renderClienteLink } from "./ListaClientes";

const MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

const PagosInforme = () => {
  const [loading, setLoading] = useState(false);
  const [pagos, setPagos] = useState([]);
  const [alerta, setAlerta] = useState({ show: false, variant: "", mensaje: "" });
  const [filtros, setFiltros] = useState({ cliente: "", compania: "", estado: "", anio: new Date().getFullYear() });
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

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

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const pagosAgrupados = pagos
    .filter((p) => {
      const cliente = p.cliente?.nombre_completo?.toLowerCase() || "";
      const compania = p.cobertura?.compania?.nombre?.toLowerCase() || "";
      const estado = p.estado?.toLowerCase() || "";
      const anioPago = p.fecha_pago?.split("-")[0] || "";

      return (
        cliente.includes(filtros.cliente.toLowerCase()) &&
        compania.includes(filtros.compania.toLowerCase()) &&
        (filtros.estado ? estado === filtros.estado.toLowerCase() : true) &&
        anioPago === String(filtros.anio)
      );
    })
    .reduce((acc, pago) => {
      const key = `${pago.cobertura?.codigo_poliza}`;
      if (!acc[key]) {
        acc[key] = {
          id: pago.id,
          codigo_poliza: pago.cobertura?.codigo_poliza,
          cliente: pago.cliente?.nombre_completo,
          cliente_id: pago.cliente?.id || pago.cliente_id,
          grupo_familiar_id: pago.cobertura?.grupo_familiar_id || pago.grupo_familiar_id,
          pagador: pago.cobertura?.pagador?.nombre_completo,
          compania: pago.cobertura?.compania?.nombre,
          pagos: Array(12).fill(null)
        };
      }

      const mesIndex = parseInt(pago.fecha_pago.split("-")[1], 10) - 1;
      acc[key].pagos[mesIndex] = {
        estado: pago.estado,
        monto: pago.monto
      };

      return acc;
    }, {});

  const rows = Object.values(pagosAgrupados);
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const currentRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <Container fluid className="mt-4">
      <h2 className="text-primary">Informe de Pagos por Año</h2>
      <p className="text-muted">Revisa el estado mensual de pagos agrupados por póliza.</p>

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
          <Form.Select name="estado" value={filtros.estado} onChange={handleFiltroChange}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="cancelado">Cancelado</option>
          </Form.Select>
        </Col>
        <Col md={2}>
          <Form.Control
            type="number"
            name="anio"
            value={filtros.anio}
            onChange={handleFiltroChange}
            min="2000"
            max="2100"
          />
        </Col>
      </Row>

      {alerta.show && (
        <Alert variant={alerta.variant} className="text-center">
          {alerta.mensaje}
        </Alert>
      )}

      {loading ? (
        <div className="text-center"><Spinner animation="border" /></div>
      ) : (
        <>
          <div className="table-responsive">
            <Table striped bordered hover responsive className="shadow-sm w-100 text-center align-middle">
              <thead className="table-light">
                <tr>
                  <th>ID GF</th>
                  <th>ID Póliza</th>
                  <th>Cliente</th>
                  <th>Pagador</th>
                  <th>Compañía</th>
                  {MONTHS.map((m, idx) => (
                    <th key={idx}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentRows.map((fila) => (
                  <tr key={fila.id}>
                    <td>
                      {fila.grupo_familiar_id ? (
                        <Link
                          to={`/grupo_familiar/${fila.grupo_familiar_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-decoration-none fw-semibold"
                          title={`Ver grupo familiar #${fila.grupo_familiar_id}`}
                        >
                          {fila.grupo_familiar_id}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>{fila.codigo_poliza}</td>
                    <td>
                      {renderClienteLink(
                        fila.cliente_id,
                        fila.cliente || "-"
                      )}
                    </td>
                    <td>{fila.pagador || "-"}</td>
                    <td>{fila.compania || "-"}</td>
                    {fila.pagos.map((pago, idx) => (
                      <td key={idx}>
                        {pago ? (
                          <>
                            <span className={`badge text-bg-${pago.estado === "pagado"
                              ? "success"
                              : pago.estado === "pendiente"
                              ? "warning"
                              : pago.estado === "cancelado"
                              ? "danger"
                              : "secondary"
                            }`}>
                              {pago.estado}
                            </span>
                            <br />
                            <small className="text-muted">${Number(pago.monto).toFixed(2)}</small>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="d-flex justify-content-center mt-3">
            <Pagination>
              <Pagination.Prev onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} />
              {[...Array(totalPages)].map((_, i) => (
                <Pagination.Item
                  key={i + 1}
                  active={i + 1 === currentPage}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </Pagination.Item>
              ))}
              <Pagination.Next onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} />
            </Pagination>
          </div>
        </>
      )}
    </Container>
  );
};

export default PagosInforme;
