import React, { useState, useEffect, useCallback } from "react";
import {
  Container,
  Form,
  Button,
  Row,
  Col,
  Spinner,
  Alert,
  Table,
  Card,
  Tab,
  Tabs,
} from "react-bootstrap";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { FaChartBar, FaUsers, FaTasks, FaClock, FaChevronDown, FaChevronRight, FaChartPie, FaStopwatch } from "react-icons/fa";
import apiRequest from "../services/api";
import { formatDurationFromMinutes } from "../utils/formatters";
import VerTareaModal from "../components/Tareas/VerTareaModal";

const COLORS = ["#0d6efd", "#198754", "#fd7e14", "#6f42c1", "#20c997", "#e83e8c", "#ffc107", "#6c757d"];

const toArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;
  return [];
};

/** Quita etiquetas HTML y devuelve solo texto plano */
const limpiarHtml = (html) => {
  if (!html) return "";
  try {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = String(html);
    return (tmp.textContent || tmp.innerText || "").trim();
  } catch {
    return String(html).replace(/<[^>]*>/g, "").trim();
  }
};

/** Tabla de detalle reutilizable (por concepto, por subconcepto, rendimiento por usuario) */
function TablaDetalleTareas({ detalle = [], tipo, onVerTarea }) {
  const lista = Array.isArray(detalle) ? detalle : [];
  return (
    <Table size="sm" bordered className="mt-2 mb-0">
      <thead>
        <tr>
          <th>ID tarea</th>
          {tipo === "rendimiento" ? <th>Cliente</th> : <th>Usuario asignado</th>}
          <th>Comentario inicial</th>
          <th className="text-end">Tiempo</th>
        </tr>
      </thead>
      <tbody>
        {lista.map((d, idx) => (
          <tr key={idx}>
            <td>
              {d.tareaId ? (
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 text-primary text-decoration-none"
                  onClick={() => onVerTarea(d.tareaId)}
                >
                  {d.tareaId}
                </Button>
              ) : (
                "—"
              )}
            </td>
            <td>
              {tipo === "rendimiento" ? (
                d.clienteId ? (
                  <a
                    href={`/clientes/${d.clienteId}/ficha`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-decoration-none"
                  >
                    {d.clienteNombre || d.clienteId}
                  </a>
                ) : (
                  d.clienteNombre || "—"
                )
              ) : (
                d.userName || "—"
              )}
            </td>
            <td style={{ maxWidth: 400 }} className="text-break">
              {limpiarHtml(d.comentarioInicial) || "—"}
            </td>
            <td className="text-end">{formatDurationFromMinutes(d.minutos ?? 0)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default function InformeTiempoPorConcepto() {
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [conceptoPadreId, setConceptoPadreId] = useState("");
  const [subconceptoId, setSubconceptoId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");

  const [conceptosPadres, setConceptosPadres] = useState([]);
  const [subconceptos, setSubconceptos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [loadingConceptos, setLoadingConceptos] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [error, setError] = useState("");
  const [ejecutado, setEjecutado] = useState(false);

  // Resultados: solo se llenan al pulsar "Ver resultado"
  const [porConcepto, setPorConcepto] = useState([]);
  const [porSubconcepto, setPorSubconcepto] = useState([]);
  const [porUsuario, setPorUsuario] = useState([]);
  const [resumen, setResumen] = useState({ totalTareas: 0, totalMinutos: 0 });
  const [usuarioExpandido, setUsuarioExpandido] = useState(null);
  const [conceptoExpandido, setConceptoExpandido] = useState(null);
  const [subconceptoExpandido, setSubconceptoExpandido] = useState(null);

  const [taskIdModal, setTaskIdModal] = useState(null);
  const [showModalTarea, setShowModalTarea] = useState(false);

  // Cargar conceptos padres al montar
  useEffect(() => {
    let cancelled = false;
    setLoadingConceptos(true);
    apiRequest("operational_concepts?only_parents=true", "GET")
      .then((res) => {
        if (cancelled) return;
        const list = toArray(res);
        setConceptosPadres(list || []);
      })
      .catch((err) => {
        if (!cancelled) setError("Error al cargar conceptos.");
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoadingConceptos(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Cargar subconceptos cuando cambia el concepto padre (para filtro)
  useEffect(() => {
    if (!conceptoPadreId) {
      setSubconceptos([]);
      setSubconceptoId("");
      return;
    }
    let cancelled = false;
    apiRequest(`operational_concepts/${conceptoPadreId}/subconcepts`, "GET")
      .then((res) => {
        if (cancelled) return;
        const list = toArray(res);
        setSubconceptos(list || []);
        setSubconceptoId("");
      })
      .catch(() => {
        if (!cancelled) setSubconceptos([]);
      });
    return () => { cancelled = true; };
  }, [conceptoPadreId]);

  // Cargar usuarios al montar
  useEffect(() => {
    let cancelled = false;
    setLoadingUsuarios(true);
    const load = async () => {
      try {
        let response = await apiRequest("usuarios-operativos", "GET").catch(() => null);
        if (!response || !Array.isArray(response)) {
          response = await apiRequest("users?per_page=1000", "GET");
        }
        if (cancelled) return;
        const data = toArray(response);
        const list = (data || []).map((u) => ({
          id: u.id,
          name: u.name || u.nombre || u.username || u.email || `Usuario ${u.id}`,
        })).filter((u) => u.id);
        setUsuarios(list);
      } catch (e) {
        if (!cancelled) setError("Error al cargar usuarios.");
      } finally {
        if (!cancelled) setLoadingUsuarios(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const ejecutarReporte = useCallback(async () => {
    setError("");
    setLoadingReporte(true);
    setEjecutado(true);
    setPorConcepto([]);
    setPorSubconcepto([]);
    setPorUsuario([]);
    setResumen({ totalTareas: 0, totalMinutos: 0 });
    setUsuarioExpandido(null);
    setConceptoExpandido(null);
    setSubconceptoExpandido(null);

    try {
      const params = new URLSearchParams();
      params.append("estado", "completed"); // Solo tareas terminadas (el backend puede aceptar "completed" o "terminado")
      if (fechaInicio) params.append("fecha_inicio", fechaInicio);
      if (fechaFin) params.append("fecha_fin", fechaFin);
      if (conceptoPadreId) params.append("concepto_padre_id", conceptoPadreId);
      if (subconceptoId) params.append("subconcepto_id", subconceptoId);
      if (usuarioId) params.append("usuario_id", usuarioId);

      const data = await apiRequest(`reportes/tiempo-tareas?${params.toString()}`, "GET");

      const resumenData = data?.resumen ?? {};
      setResumen({
        totalTareas: resumenData.total_tareas ?? 0,
        totalMinutos: resumenData.total_minutos ?? 0,
      });

      const mapConcepto = (arr) =>
        (arr || []).map((c) => ({
          nombre: c.nombre ?? "Sin nombre",
          tareas: c.tareas ?? 0,
          minutos: c.minutos ?? 0,
          detalle: (c.detalle || []).map((d) => ({
            tareaId: d.tarea_id ?? d.id_tarea ?? d.id ?? "",
            userName: d.usuario_nombre ?? "—",
            clienteId: d.cliente_id ?? d.cliente?.id ?? "",
            clienteNombre: d.cliente_nombre ?? d.cliente?.nombre_completo ?? d.cliente?.nombre ?? "",
            comentarioInicial: d.comentario_inicial ?? "",
            minutos: d.minutos ?? 0,
          })),
        }));

      setPorConcepto(
        mapConcepto(data?.por_concepto).sort((a, b) => (b.minutos || 0) - (a.minutos || 0))
      );
      setPorSubconcepto(
        mapConcepto(data?.por_subconcepto).sort((a, b) => (b.minutos || 0) - (a.minutos || 0))
      );

      const porUsuarioRaw = data?.por_usuario ?? [];
      setPorUsuario(
        porUsuarioRaw
          .map((u, i) => ({
            userId: u.usuario_id ?? u.id ?? `u-${i}`,
            userName: u.usuario_nombre ?? u.nombre ?? "Sin asignar",
            tareas: u.tareas ?? 0,
            minutos: u.minutos ?? 0,
            detalle: (u.detalle || []).map((d) => ({
              tareaId: d.tarea_id ?? d.id_tarea ?? d.id ?? "",
              clienteId: d.cliente_id ?? d.cliente?.id ?? "",
              clienteNombre: d.cliente_nombre ?? d.cliente?.nombre_completo ?? d.cliente?.nombre ?? d.nombre_cliente ?? "",
              comentarioInicial: d.comentario_inicial ?? "",
              minutos: d.minutos ?? 0,
            })),
            byConcept: {},
          }))
          .sort((a, b) => (b.minutos || 0) - (a.minutos || 0))
      );
    } catch (err) {
      console.error("[InformeTiempoPorConcepto]", err);
      const msg = err?.response?.data?.message ?? err?.message ?? "Error inesperado";
      setError(`Error al generar el reporte: ${msg}. Revisa la consola (F12) para más detalle.`);
    } finally {
      setLoadingReporte(false);
    }
  }, [fechaInicio, fechaFin, conceptoPadreId, subconceptoId, usuarioId]);

  const abrirModalTarea = useCallback((taskId) => {
    if (!taskId) return;
    setTaskIdModal(taskId);
    setShowModalTarea(true);
  }, []);

  return (
    <Container className="py-4">
      <h3 className="mb-4">
        <FaChartBar className="me-2" />
        Tiempo invertido en tareas por concepto y rendimiento
      </h3>

      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Filtros</h5>
          <small className="text-muted fw-normal">Este reporte solo incluye tareas en estado terminado (completadas), no pendientes ni en progreso.</small>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger" onClose={() => setError("")} dismissible>{error}</Alert>}
          <Row>
            <Col md={6} lg={2} className="mb-3">
              <Form.Label>Fecha inicio</Form.Label>
              <Form.Control
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </Col>
            <Col md={6} lg={2} className="mb-3">
              <Form.Label>Fecha fin</Form.Label>
              <Form.Control
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </Col>
            <Col md={6} lg={2} className="mb-3">
              <Form.Label>Concepto (padre)</Form.Label>
              <Form.Select
                value={conceptoPadreId}
                onChange={(e) => setConceptoPadreId(e.target.value)}
                disabled={loadingConceptos}
              >
                <option value="">Todos</option>
                {(conceptosPadres || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={6} lg={2} className="mb-3">
              <Form.Label>Subconcepto</Form.Label>
              <Form.Select
                value={subconceptoId}
                onChange={(e) => setSubconceptoId(e.target.value)}
                disabled={!conceptoPadreId}
              >
                <option value="">Todos</option>
                {(subconceptos || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={6} lg={2} className="mb-3">
              <Form.Label>Usuario</Form.Label>
              <Form.Select
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value)}
                disabled={loadingUsuarios}
              >
                <option value="">Todos</option>
                {(usuarios || []).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={12} lg={2} className="mb-3 d-flex align-items-end">
              <Button
                variant="primary"
                onClick={ejecutarReporte}
                disabled={loadingReporte}
                className="w-100"
              >
                {loadingReporte ? <Spinner animation="border" size="sm" className="me-2" /> : <FaClock className="me-2" />}
                Ver resultado
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {!ejecutado && !loadingReporte && (
        <Card>
          <Card.Body className="text-center text-muted py-5">
            <FaChartBar size={48} className="mb-3" />
            <p className="mb-0">Configure los filtros y pulse <strong>Ver resultado</strong> para generar el reporte.</p>
          </Card.Body>
        </Card>
      )}

      {ejecutado && !loadingReporte && (
        <>
          {/* KPIs y métricas para análisis */}
          {(() => {
            const totalMin = resumen.totalMinutos || 0;
            const totalTareas = resumen.totalTareas || 0;
            const promedioMin = totalTareas > 0 ? Math.round(totalMin / totalTareas) : 0;
            const topConcepto = porConcepto[0];
            const topUsuario = porUsuario[0];
            const datosGraficoConcepto = porConcepto.slice(0, 10).map((r) => ({ name: r.nombre?.length > 25 ? r.nombre.slice(0, 22) + "…" : r.nombre, minutos: r.minutos || 0, tiempo: formatDurationFromMinutes(r.minutos || 0) }));
            const datosGraficoUsuario = porUsuario.slice(0, 10).map((r) => ({ name: r.userName || "Sin asignar", minutos: r.minutos || 0, tiempo: formatDurationFromMinutes(r.minutos || 0) }));
            const datosTorta = porConcepto.slice(0, 8).map((r) => ({ name: r.nombre?.length > 20 ? r.nombre.slice(0, 17) + "…" : r.nombre, value: r.minutos || 0 }));
            return (
              <>
                <Row className="mb-4 g-3">
                  <Col xs={12} md={6} lg>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Body className="d-flex align-items-center gap-3">
                        <div className="rounded-3 bg-primary bg-opacity-10 p-3">
                          <FaTasks className="text-primary" size={24} />
                        </div>
                        <div>
                          <div className="text-muted small">Total tareas</div>
                          <div className="fs-4 fw-bold">{totalTareas}</div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={12} md={6} lg>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Body className="d-flex align-items-center gap-3">
                        <div className="rounded-3 bg-success bg-opacity-10 p-3">
                          <FaClock className="text-success" size={24} />
                        </div>
                        <div>
                          <div className="text-muted small">Tiempo total</div>
                          <div className="fs-4 fw-bold">{formatDurationFromMinutes(totalMin)}</div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={12} md={6} lg>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Body className="d-flex align-items-center gap-3">
                        <div className="rounded-3 bg-info bg-opacity-10 p-3">
                          <FaStopwatch className="text-info" size={24} />
                        </div>
                        <div>
                          <div className="text-muted small">Promedio por tarea</div>
                          <div className="fs-4 fw-bold">{formatDurationFromMinutes(promedioMin)}</div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={12} md={6} lg>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Body className="d-flex align-items-center gap-3">
                        <div className="rounded-3 bg-warning bg-opacity-10 p-3">
                          <FaChartBar className="text-warning" size={24} />
                        </div>
                        <div>
                          <div className="text-muted small">Concepto con más tiempo</div>
                          <div className="fw-semibold text-truncate" title={topConcepto?.nombre}>{topConcepto ? (topConcepto.nombre?.length > 28 ? topConcepto.nombre.slice(0, 25) + "…" : topConcepto.nombre) : "—"}</div>
                          <div className="small text-muted">{topConcepto ? formatDurationFromMinutes(topConcepto.minutos) : ""}</div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col xs={12} md={6} lg>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Body className="d-flex align-items-center gap-3">
                        <div className="rounded-3 bg-secondary bg-opacity-10 p-3">
                          <FaUsers className="text-secondary" size={24} />
                        </div>
                        <div>
                          <div className="text-muted small">Usuario con más tiempo</div>
                          <div className="fw-semibold text-truncate">{topUsuario?.userName ?? "—"}</div>
                          <div className="small text-muted">{topUsuario ? formatDurationFromMinutes(topUsuario.minutos) : ""}</div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Gráficos para análisis visual */}
                <Row className="mb-4 g-4">
                  <Col lg={6}>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Header className="bg-white border-bottom">
                        <FaChartBar className="me-2 text-primary" />
                        Tiempo por concepto (top 10)
                      </Card.Header>
                      <Card.Body>
                        {datosGraficoConcepto.length > 0 ? (
                          <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={datosGraficoConcepto} layout="vertical" margin={{ left: 8, right: 20, top: 8, bottom: 8 }}>
                              <XAxis type="number" tickFormatter={(v) => (v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`)} />
                              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                              <Tooltip formatter={(v) => [formatDurationFromMinutes(v), "Minutos"]} labelFormatter={(l) => l} />
                              <Bar dataKey="minutos" fill="#0d6efd" radius={[0, 4, 4, 0]} name="Tiempo" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center py-5 text-muted small">Sin datos para graficar</div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col lg={6}>
                    <Card className="border-0 shadow-sm h-100">
                      <Card.Header className="bg-white border-bottom">
                        <FaChartPie className="me-2 text-primary" />
                        Distribución del tiempo por concepto
                      </Card.Header>
                      <Card.Body>
                        {datosTorta.length > 0 && totalMin > 0 ? (
                          <ResponsiveContainer width="100%" height={320}>
                            <PieChart>
                              <Pie
                                data={datosTorta}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {datosTorta.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v, n, p) => [formatDurationFromMinutes(v), `${(p.payload?.value / totalMin * 100).toFixed(1)}% del total`]} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center py-5 text-muted small">Sin datos para graficar</div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
                <Row className="mb-4">
                  <Col xs={12}>
                    <Card className="border-0 shadow-sm">
                      <Card.Header className="bg-white border-bottom">
                        <FaUsers className="me-2 text-primary" />
                        Tiempo por usuario (top 10) — comparativa de rendimiento
                      </Card.Header>
                      <Card.Body>
                        {datosGraficoUsuario.length > 0 ? (
                          <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={datosGraficoUsuario} margin={{ top: 8, right: 20, left: 8, bottom: 60 }}>
                              <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} tick={{ fontSize: 12 }} />
                              <YAxis tickFormatter={(v) => (v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`)} />
                              <Tooltip formatter={(v) => [formatDurationFromMinutes(v), "Tiempo"]} />
                              <Bar dataKey="minutos" fill="#198754" radius={[4, 4, 0, 0]} name="Tiempo" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center py-5 text-muted small">Sin datos para graficar</div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </>
            );
          })()}

          <Tabs defaultActiveKey="por-concepto" className="mb-3">
            <Tab eventKey="por-concepto" title={<><FaTasks className="me-1" /> Por concepto</>}>
              <Card>
                <Card.Body>
                  <Table responsive bordered hover size="sm">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>Concepto (padre)</th>
                        <th>Usuarios asignados</th>
                        <th className="text-end">Tareas</th>
                        <th className="text-end">Tiempo total</th>
                        <th className="text-end">% del total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porConcepto.length === 0 ? (
                        <tr><td colSpan={6} className="text-muted text-center">Sin datos</td></tr>
                      ) : (
                        porConcepto.map((row) => {
                          const expandido = conceptoExpandido === row.nombre;
                          const detalle = row.detalle || [];
                          const usuariosUnicos = [...new Set(detalle.map((d) => d.userName))].filter(Boolean);
                          const tieneDetalle = detalle.length > 0;
                          const totalMin = resumen.totalMinutos || 0;
                          const pct = totalMin > 0 ? ((row.minutos || 0) / totalMin * 100).toFixed(1) : "0";
                          return (
                            <React.Fragment key={row.nombre}>
                              <tr>
                                <td className="align-middle">
                                  {tieneDetalle ? (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="p-0 text-dark"
                                      onClick={() => setConceptoExpandido(expandido ? null : row.nombre)}
                                      aria-expanded={expandido}
                                    >
                                      {expandido ? <FaChevronDown /> : <FaChevronRight />}
                                    </Button>
                                  ) : null}
                                </td>
                                <td>{row.nombre}</td>
                                <td>{usuariosUnicos.length ? usuariosUnicos.join(", ") : "—"}</td>
                                <td className="text-end">{row.tareas}</td>
                                <td className="text-end">{formatDurationFromMinutes(row.minutos)}</td>
                                <td className="text-end">{pct}%</td>
                              </tr>
                              {expandido && tieneDetalle && (
                                <tr>
                                  <td colSpan={6} className="bg-light p-3">
                                    <div className="small">
                                      <strong>Detalle por tarea (usuario y comentario inicial)</strong>
                                      <TablaDetalleTareas detalle={detalle} tipo="concepto" onVerTarea={abrirModalTarea} />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>
            <Tab eventKey="por-subconcepto" title={<><FaTasks className="me-1" /> Por subconcepto</>}>
              <Card>
                <Card.Body>
                  <Table responsive bordered hover size="sm">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>Subconcepto</th>
                        <th>Usuarios asignados</th>
                        <th className="text-end">Tareas</th>
                        <th className="text-end">Tiempo total</th>
                        <th className="text-end">% del total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porSubconcepto.length === 0 ? (
                        <tr><td colSpan={6} className="text-muted text-center">Sin datos</td></tr>
                      ) : (
                        porSubconcepto.map((row) => {
                          const expandido = subconceptoExpandido === row.nombre;
                          const detalle = row.detalle || [];
                          const usuariosUnicos = [...new Set(detalle.map((d) => d.userName))].filter(Boolean);
                          const tieneDetalle = detalle.length > 0;
                          const totalMinSub = resumen.totalMinutos || 0;
                          const pctSub = totalMinSub > 0 ? ((row.minutos || 0) / totalMinSub * 100).toFixed(1) : "0";
                          return (
                            <React.Fragment key={row.nombre}>
                              <tr>
                                <td className="align-middle">
                                  {tieneDetalle ? (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="p-0 text-dark"
                                      onClick={() => setSubconceptoExpandido(expandido ? null : row.nombre)}
                                      aria-expanded={expandido}
                                    >
                                      {expandido ? <FaChevronDown /> : <FaChevronRight />}
                                    </Button>
                                  ) : null}
                                </td>
                                <td>{row.nombre}</td>
                                <td>{usuariosUnicos.length ? usuariosUnicos.join(", ") : "—"}</td>
                                <td className="text-end">{row.tareas}</td>
                                <td className="text-end">{formatDurationFromMinutes(row.minutos)}</td>
                                <td className="text-end">{pctSub}%</td>
                              </tr>
                              {expandido && tieneDetalle && (
                                <tr>
                                  <td colSpan={6} className="bg-light p-3">
                                    <div className="small">
                                      <strong>Detalle por tarea (usuario y comentario inicial)</strong>
                                      <TablaDetalleTareas detalle={detalle} tipo="concepto" onVerTarea={abrirModalTarea} />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>
            <Tab eventKey="rendimiento" title={<><FaUsers className="me-1" /> Rendimiento por usuario</>}>
              <Card>
                <Card.Body>
                  <Table responsive bordered hover size="sm">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>Usuario</th>
                        <th className="text-end">Tareas</th>
                        <th className="text-end">Tiempo total</th>
                        <th className="text-end">% del total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porUsuario.length === 0 ? (
                        <tr><td colSpan={5} className="text-muted text-center">Sin datos</td></tr>
                      ) : (
                        porUsuario.map((row) => {
                          const expandido = usuarioExpandido === row.userId;
                          const detalle = row.detalle || [];
                          const tieneDetalle = detalle.length > 0;
                          const totalMinUsu = resumen.totalMinutos || 0;
                          const pctUsu = totalMinUsu > 0 ? ((row.minutos || 0) / totalMinUsu * 100).toFixed(1) : "0";
                          return (
                            <React.Fragment key={row.userId}>
                              <tr>
                                <td className="align-middle">
                                  {tieneDetalle ? (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="p-0 text-dark"
                                      onClick={() => setUsuarioExpandido(expandido ? null : row.userId)}
                                      aria-expanded={expandido}
                                    >
                                      {expandido ? <FaChevronDown /> : <FaChevronRight />}
                                    </Button>
                                  ) : null}
                                </td>
                                <td>{row.userName}</td>
                                <td className="text-end">{row.tareas}</td>
                                <td className="text-end">{formatDurationFromMinutes(row.minutos)}</td>
                                <td className="text-end">{pctUsu}%</td>
                              </tr>
                              {expandido && tieneDetalle && (
                                <tr>
                                  <td colSpan={5} className="bg-light p-3">
                                    <div className="small">
                                      <strong>Detalle por tarea (cliente y comentario inicial)</strong>
                                      <TablaDetalleTareas detalle={detalle} tipo="rendimiento" onVerTarea={abrirModalTarea} />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </>
      )}

      <VerTareaModal
        show={showModalTarea}
        onHide={() => {
          setShowModalTarea(false);
          setTaskIdModal(null);
        }}
        taskId={taskIdModal}
      />
    </Container>
  );
}
