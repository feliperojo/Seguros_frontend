import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  OverlayTrigger,
  Popover,
  Table,
  Spinner,
  Alert,
  Form,
  Container,
  Row,
  Col,
  Button,
} from "react-bootstrap";
import {
  FaSyncAlt,
  FaFilter,
  FaTable,
  FaFileInvoiceDollar,
  FaFileExcel,
} from "react-icons/fa";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import apiRequest from "../services/api";
import { renderClienteLink } from "./ListaClientes";
import { filasInformePagos } from "../utils/informePagosCobertura";
import { detalleSnapshotCobro } from "../utils/pagosGrupoFamiliarConsulta";
import { indicadorMorosidadPagosPorMes, pickEstadoFechaActualizacionPago } from "../utils/pagosMorosidad";
import { formatDateForDisplay } from "../utils/formatters";
import {
  crearLibroInformePagos,
  fechaDescargaLocal,
  nombreArchivoInformePagos,
} from "../utils/informePagosExcel";
import "../styles/GruposFamiliaresListado.css";
import "../styles/PagosInforme.css";

const MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const getEstadoCeldaClass = (estado) => {
  const key = String(estado ?? "").toLowerCase();
  if (key === "pagado") return "pagos-informe__estado--pagado";
  if (key === "procesando") return "pagos-informe__estado--procesando";
  if (key === "cancelado") return "pagos-informe__estado--cancelado";
  return "pagos-informe__estado--pendiente";
};

const renderSituacion = (pagosPorMes) => {
  const ind = indicadorMorosidadPagosPorMes(pagosPorMes);
  if (!ind || ind.nivel === "sin_datos" || ind.nivel === "sin_generacion") {
    return (
      <span className="text-muted small" title={ind?.titulo}>
        —
      </span>
    );
  }
  if (ind.nivel === "riesgo") {
    return (
      <span className={`pagos-informe__situacion pagos-informe__situacion--riesgo`} title={ind.titulo}>
        {ind.etiqueta}
      </span>
    );
  }
  if (ind.nivel === "mora") {
    return (
      <span className={`pagos-informe__situacion pagos-informe__situacion--mora`} title={ind.titulo}>
        {ind.etiqueta}
      </span>
    );
  }
  return (
    <span className={`pagos-informe__situacion pagos-informe__situacion--al-dia`} title={ind.titulo}>
      {ind.etiqueta}
    </span>
  );
};

const PagosInforme = () => {
  const [loading, setLoading] = useState(false);
  const [exportando, setExportando] = useState(false);
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
      const response = await apiRequest("cobertura/pagos/listado?informe_anual=1", "GET");
      const raw = response?.data != null ? response.data : response;
      setPagos(Array.isArray(raw) ? raw : []);
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

  const rows = filasInformePagos(pagos, filtros);

  const descargarExcel = () => {
    if (loading || exportando || rows.length === 0) return;
    setExportando(true);
    try {
      const fechaDescarga = fechaDescargaLocal();
      const libro = crearLibroInformePagos({ filas: rows, filtros, fechaDescarga });
      const buffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, nombreArchivoInformePagos(filtros.anio, fechaDescarga));
    } catch (err) {
      console.error("Error al exportar el informe de pagos:", err);
      mostrarAlerta("No se pudo descargar el Excel del informe de pagos.", "danger");
    } finally {
      setExportando(false);
    }
  };
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const currentRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const indexInicio = rows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const indexFin = Math.min(currentPage * rowsPerPage, rows.length);

  return (
    <Container fluid className="gf-listado-container py-3 pagos-informe">
      <Helmet>
        <title>Vantun / Informe de pagos</title>
      </Helmet>

      <div className="gf-listado">
        <div className="gf-listado__header gf-listado__header--split">
          <div className="gf-listado__header-main">
            <div className="gf-listado__header-icon" aria-hidden="true">
              <FaFileInvoiceDollar />
            </div>
            <div>
              <h1 className="gf-listado__title">Informe de Pagos por Año</h1>
              <p className="gf-listado__subtitle">
                Una fila por cobertura del año fiscal. Consulta los datos históricos pasando el mouse sobre cada monto.
              </p>
            </div>
          </div>
          <div className="gf-listado__header-actions">
            <span className="gf-listado__chip">
              {loading
                ? "Cargando…"
                : `${rows.length} póliza${rows.length !== 1 ? "s" : ""} · ${filtros.anio}`}
            </span>
            <Button
              type="button"
              size="sm"
              className="gf-listado__btn-ghost"
              onClick={descargarExcel}
              disabled={loading || exportando || rows.length === 0}
            >
              <FaFileExcel className="me-1" />
              Descargar Excel
            </Button>
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
                  placeholder="Compañía o plan de la cobertura"
                  name="compania"
                  value={filtros.compania}
                  onChange={handleFiltroChange}
                />
              </Col>
              <Col xs={12} sm={6} lg={3}>
                <div className="gf-listado__label">Estado</div>
                <Form.Select name="estado" value={filtros.estado} onChange={handleFiltroChange}>
                  <option value="">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                  <option value="cancelado">Cancelado</option>
                </Form.Select>
              </Col>
              <Col xs={12} sm={6} lg={3}>
                <div className="gf-listado__label">Año</div>
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
          </div>

          {alerta.show && (
            <Alert variant={alerta.variant} className="pagos-informe__alert text-center">
              {alerta.mensaje}
            </Alert>
          )}

          <div className="gf-listado__section gf-listado__section--table">
            <div className="gf-listado__section-title">
              <FaTable aria-hidden="true" />
              Calendario anual por póliza
            </div>

            <div className="pagos-informe__leyenda" aria-hidden="true">
              <span className="pagos-informe__leyenda-item">
                <span className="pagos-informe__leyenda-dot pagos-informe__leyenda-dot--pendiente" />
                Pendiente
              </span>
              <span className="pagos-informe__leyenda-item">
                <span className="pagos-informe__leyenda-dot pagos-informe__leyenda-dot--procesando" />
                Procesando
              </span>
              <span className="pagos-informe__leyenda-item">
                <span className="pagos-informe__leyenda-dot pagos-informe__leyenda-dot--pagado" />
                Pagado
              </span>
              <span className="pagos-informe__leyenda-item">
                <span className="pagos-informe__leyenda-dot pagos-informe__leyenda-dot--riesgo" />
                Riesgo / mora
              </span>
            </div>

            {!loading && rows.length > 0 && (
              <div className="gf-listado__summary">
                Mostrando <strong>{indexInicio}–{indexFin}</strong> de{" "}
                <strong>{rows.length}</strong> pólizas
              </div>
            )}

            {loading ? (
              <div className="pagos-informe__loading">
                <Spinner animation="border" role="status" />
                <div>Cargando informe…</div>
              </div>
            ) : rows.length === 0 ? (
              <div className="gf-listado__empty">
                No hay pagos que coincidan con los filtros seleccionados.
              </div>
            ) : (
              <>
                <div className="gf-listado__table-wrap pagos-informe__table-scroll">
                  <Table hover className="gf-listado__table mb-0 align-middle">
                    <thead>
                      <tr>
                        <th className="pagos-informe__col-fija">ID GF</th>
                        <th>ID Póliza</th>
                        <th>Cliente</th>
                        <th>Pagador</th>
                        <th>Compañía</th>
                        <th
                          title="Mora: 1–2 meses con generación distinta de pagado. Riesgo: 3 o más. Solo meses con pago generado en el año filtrado."
                          className="text-nowrap"
                        >
                          Situación
                        </th>
                        {MONTHS.map((m, idx) => (
                          <th key={idx} className="pagos-informe__col-mes-header">
                            {m}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentRows.map((fila) => (
                        <tr key={fila.id}>
                          <td className="pagos-informe__col-fija">
                            {fila.grupo_familiar_id ? (
                              <Link
                                to={`/grupo_familiar/${fila.grupo_familiar_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`Ver grupo familiar #${fila.grupo_familiar_id}`}
                              >
                                {fila.grupo_familiar_id}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={fila.codigoPendiente ? "text-muted" : undefined}>{fila.codigo_poliza || "—"}</td>
                          <td>
                            {renderClienteLink(
                              fila.cliente_id,
                              fila.cliente || "—"
                            )}
                          </td>
                          <td className={fila.pagadorPendiente ? "text-muted" : undefined}>{fila.pagador || "—"}</td>
                          <td className={fila.companiaPendiente ? "text-muted" : undefined}>
                            {fila.compania || "—"}
                            {fila.plan ? <div className="small">{fila.plan}</div> : null}
                          </td>
                          <td className="text-center">{renderSituacion(fila.pagos)}</td>
                          {fila.pagos.map((pago, idx) => (
                            <td key={idx} className="pagos-informe__col-mes">
                              {pago ? (
                                <div>
                                  {pago.cobros.map((cobro) => {
                                    const detalle = detalleSnapshotCobro(cobro);
                                    const fecha = pickEstadoFechaActualizacionPago(cobro);
                                    return (
                                      <div key={cobro.id} className="pagos-informe__celda">
                                        <span className={`pagos-informe__estado ${getEstadoCeldaClass(cobro.estado)}`}>{cobro.estado}</span>
                                        <OverlayTrigger trigger={["hover", "focus"]} placement="auto" overlay={
                                          <Popover id={`snapshot-cobro-${cobro.id}`}>
                                            <Popover.Header as="h3">{detalle.titulo}</Popover.Header>
                                            <Popover.Body>
                                              {detalle.nota ? <p>{detalle.nota}</p> : null}
                                              {detalle.campos.map(campo => <div key={campo.etiqueta}><strong>{campo.etiqueta}:</strong> {campo.valor}</div>)}
                                            </Popover.Body>
                                          </Popover>
                                        }>
                                          <span tabIndex={0} className="pagos-informe__monto" aria-label={`Detalle del cobro ${cobro.id}`}>
                                            ${Number(cobro.monto).toFixed(2)}
                                          </span>
                                        </OverlayTrigger>
                                        {fecha ? <span className="pagos-informe__fecha-estado" title="Última actualización del estado">{formatDateForDisplay(fecha)}</span> : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="pagos-informe__celda-vacia">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="pagos-informe__pagination">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="gf-listado__btn-icon"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    >
                      Anterior
                    </Button>
                    <span className="pagos-informe__page-indicator">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="gf-listado__btn-icon"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
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
    </Container>
  );
};

export default PagosInforme;
