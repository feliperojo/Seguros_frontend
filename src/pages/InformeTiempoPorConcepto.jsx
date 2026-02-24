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
import { FaChartBar, FaUsers, FaTasks, FaClock, FaChevronDown, FaChevronRight } from "react-icons/fa";
import apiRequest from "../services/api";
import { formatDurationFromMinutes } from "../utils/formatters";

const COMPLETED_STATES = new Set([
  "done", "completed", "complete", "finished", "resolved", "closed", "completada", "terminada",
]);

const toArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;
  return [];
};

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
  const [usuarioExpandido, setUsuarioExpandido] = useState(null); // userId para fila expandida

  // Mapa concept_id -> { parentName, subconceptName } para agregar
  const [conceptMap, setConceptMap] = useState({});

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

  // Construir mapa concepto_id -> { parentName, subconceptName } cargando todos los subconceptos
  const buildConceptMap = useCallback(async () => {
    const map = {};
    const padres = toArray(await apiRequest("operational_concepts?only_parents=true", "GET"));
    for (const padre of padres || []) {
      const hijos = toArray(await apiRequest(`operational_concepts/${padre.id}/subconcepts`, "GET"));
      const parentName = padre.name || "Sin concepto padre";
      for (const h of hijos || []) {
        map[String(h.id)] = { parentName, subconceptName: h.name || "Sin nombre" };
      }
      // El propio padre puede ser usado como "concepto" en alguna tarea
      if (padre.id) {
        map[String(padre.id)] = map[String(padre.id)] || { parentName, subconceptName: parentName };
      }
    }
    return map;
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

    try {
      const map = await buildConceptMap();
      setConceptMap(map);

      const params = new URLSearchParams();
      params.append("per_page", "1000");
      params.append("page", "1");
      params.append("include", "log,log.cliente,concept,assignedUser");
      if (fechaInicio) params.append("fecha_inicio", fechaInicio);
      if (fechaFin) params.append("fecha_fin", fechaFin);
      if (usuarioId) params.append("assigned_user_id", usuarioId);
      // Backend puede filtrar por estado; si no, se filtran solo completadas en front
      params.append("estado", "completed");

      const response = await apiRequest(`tareas_operativas?${params.toString()}`, "GET");
      let list = [];
      if (response?.data) {
        list = Array.isArray(response.data) ? response.data : response.data?.data || [];
      } else if (Array.isArray(response)) {
        list = response;
      }

      // Si el backend no filtra por estado, filtrar aquí
      list = list.filter((t) => {
        const st = String(t?.estado ?? t?.status ?? "").toLowerCase();
        return COMPLETED_STATES.has(st);
      });

      // Filtros en front: concepto padre y subconcepto
      if (conceptoPadreId) {
        list = list.filter((t) => {
          const cid = t?.log?.concept_id ?? t?.concept_id ?? t?.log?.concept?.id ?? t?.concept?.id;
          const info = map[String(cid)];
          if (!info) return false;
          const parentIdFromMap = conceptosPadres.find((p) => p.name === info.parentName)?.id;
          return String(parentIdFromMap) === String(conceptoPadreId);
        });
      }
      if (subconceptoId) {
        list = list.filter((t) => {
          const cid = t?.log?.concept_id ?? t?.concept_id ?? t?.log?.concept?.id ?? t?.concept?.id;
          return String(cid) === String(subconceptoId);
        });
      }

      const byConcept = {};
      const bySubconcept = {};
      const byUser = {};

      for (const t of list) {
        const start = t?.created_at ?? t?.scheduled_date ?? t?.fecha_inicio ?? t?.fecha;
        const end = t?.completed_at ?? t?.finished_at ?? t?.fecha_fin ?? t?.fecha_cierre ?? t?.closed_at;
        if (!start || !end) continue;
        const startMs = new Date(start).getTime();
        const endMs = new Date(end).getTime();
        if (endMs <= startMs) continue;
        const minutes = Math.floor((endMs - startMs) / (1000 * 60));

        const cid = t?.log?.concept_id ?? t?.concept_id ?? t?.log?.concept?.id ?? t?.concept?.id;
        const conceptInfo = map[String(cid)] || {
          parentName: t?.log?.concept?.name ?? t?.concept?.name ?? "Sin concepto",
          subconceptName: t?.log?.concept?.name ?? t?.concept?.name ?? "Sin concepto",
        };
        const parentName = conceptInfo.parentName;
        const subconceptName = conceptInfo.subconceptName;

        const userId = t?.assigned_user_id ?? t?.assignedUser?.id ?? t?.assign_to_user?.id ?? t?.assigned_to_user?.id;
        const userName = t?.assignedUser?.name ?? t?.assign_to_user?.name ?? t?.assigned_to_user?.name ?? "Sin asignar";
        const userKey = userId ?? "sin-asignar";

        if (!byConcept[parentName]) byConcept[parentName] = { minutos: 0, tareas: 0 };
        byConcept[parentName].minutos += minutes;
        byConcept[parentName].tareas += 1;

        if (!bySubconcept[subconceptName]) bySubconcept[subconceptName] = { minutos: 0, tareas: 0 };
        bySubconcept[subconceptName].minutos += minutes;
        bySubconcept[subconceptName].tareas += 1;

        if (!byUser[userKey]) byUser[userKey] = { userName, minutos: 0, tareas: 0, byConcept: {} };
        byUser[userKey].minutos += minutes;
        byUser[userKey].tareas += 1;
        if (!byUser[userKey].byConcept[parentName]) byUser[userKey].byConcept[parentName] = { minutos: 0, tareas: 0 };
        byUser[userKey].byConcept[parentName].minutos += minutes;
        byUser[userKey].byConcept[parentName].tareas += 1;
      }

      const totalTareas = list.filter((t) => {
        const start = t?.created_at ?? t?.scheduled_date ?? t?.fecha_inicio ?? t?.fecha;
        const end = t?.completed_at ?? t?.finished_at ?? t?.fecha_fin ?? t?.fecha_cierre;
        return start && end && new Date(end).getTime() > new Date(start).getTime();
      }).length;
      const totalMinutos = Object.values(bySubconcept).reduce((acc, v) => acc + v.minutos, 0);

      setPorConcepto(
        Object.entries(byConcept)
          .map(([nombre, v]) => ({ nombre, ...v }))
          .sort((a, b) => b.minutos - a.minutos)
      );
      setPorSubconcepto(
        Object.entries(bySubconcept)
          .map(([nombre, v]) => ({ nombre, ...v }))
          .sort((a, b) => b.minutos - a.minutos)
      );
      setPorUsuario(
        Object.entries(byUser)
          .map(([key, v]) => ({ userId: key, ...v }))
          .sort((a, b) => b.minutos - a.minutos)
      );
      setResumen({ totalTareas, totalMinutos });
    } catch (err) {
      console.error(err);
      setError("Error al generar el reporte. Ver consola o intente de nuevo.");
    } finally {
      setLoadingReporte(false);
    }
  }, [fechaInicio, fechaFin, conceptoPadreId, subconceptoId, usuarioId, conceptosPadres, buildConceptMap]);

  return (
    <Container className="py-4">
      <h3 className="mb-4">
        <FaChartBar className="me-2" />
        Tiempo invertido en tareas por concepto y rendimiento
      </h3>

      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Filtros</h5>
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
          <Card className="mb-4">
            <Card.Body className="py-3">
              <Row>
                <Col md={6}>
                  <strong>Total tareas (con duración):</strong> {resumen.totalTareas}
                </Col>
                <Col md={6}>
                  <strong>Tiempo total:</strong> {formatDurationFromMinutes(resumen.totalMinutos)}
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Tabs defaultActiveKey="por-concepto" className="mb-3">
            <Tab eventKey="por-concepto" title={<><FaTasks className="me-1" /> Por concepto</>}>
              <Card>
                <Card.Body>
                  <Table responsive bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>Concepto (padre)</th>
                        <th className="text-end">Tareas</th>
                        <th className="text-end">Tiempo total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porConcepto.length === 0 ? (
                        <tr><td colSpan={3} className="text-muted text-center">Sin datos</td></tr>
                      ) : (
                        porConcepto.map((row) => (
                          <tr key={row.nombre}>
                            <td>{row.nombre}</td>
                            <td className="text-end">{row.tareas}</td>
                            <td className="text-end">{formatDurationFromMinutes(row.minutos)}</td>
                          </tr>
                        ))
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
                        <th>Subconcepto</th>
                        <th className="text-end">Tareas</th>
                        <th className="text-end">Tiempo total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porSubconcepto.length === 0 ? (
                        <tr><td colSpan={3} className="text-muted text-center">Sin datos</td></tr>
                      ) : (
                        porSubconcepto.map((row) => (
                          <tr key={row.nombre}>
                            <td>{row.nombre}</td>
                            <td className="text-end">{row.tareas}</td>
                            <td className="text-end">{formatDurationFromMinutes(row.minutos)}</td>
                          </tr>
                        ))
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
                      </tr>
                    </thead>
                    <tbody>
                      {porUsuario.length === 0 ? (
                        <tr><td colSpan={4} className="text-muted text-center">Sin datos</td></tr>
                      ) : (
                        porUsuario.map((row) => {
                          const expandido = usuarioExpandido === row.userId;
                          const tieneDesglose = row.byConcept && Object.keys(row.byConcept).length > 0;
                          return (
                            <React.Fragment key={row.userId}>
                              <tr>
                                <td className="align-middle">
                                  {tieneDesglose ? (
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
                              </tr>
                              {expandido && tieneDesglose && (
                                <tr>
                                  <td colSpan={4} className="bg-light p-3">
                                    <div className="small">
                                      <strong>Desglose por concepto</strong>
                                      <Table size="sm" bordered className="mt-2 mb-0">
                                        <thead>
                                          <tr>
                                            <th>Concepto</th>
                                            <th className="text-end">Tareas</th>
                                            <th className="text-end">Tiempo</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {Object.entries(row.byConcept)
                                            .sort((a, b) => b[1].minutos - a[1].minutos)
                                            .map(([nombre, v]) => (
                                              <tr key={nombre}>
                                                <td>{nombre}</td>
                                                <td className="text-end">{v.tareas}</td>
                                                <td className="text-end">{formatDurationFromMinutes(v.minutos)}</td>
                                              </tr>
                                            ))}
                                        </tbody>
                                      </Table>
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
    </Container>
  );
}
