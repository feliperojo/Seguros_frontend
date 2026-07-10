import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Form, Nav, Spinner, Table } from "react-bootstrap";
import { FaArchive, FaColumns, FaHistory, FaPlus } from "react-icons/fa";
import KanbanBoard from "../../components/Recursos/KanbanBoard";
import { useAuth } from "../../context/AuthContext";
import {
  tableroPersonalService,
  TABLERO_COLUMNAS,
} from "../../services/tableroPersonalService";
import { formatValidationErrors } from "../../utils/tableroEstados";
import "../../styles/Recursos.css";

const MiTableroPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [error, setError] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const [vista, setVista] = useState("activo");
  const [archivando, setArchivando] = useState(false);
  const kanbanRef = useRef(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = verTodos && user?.id ? {} : {};
      const lista = await tableroPersonalService.list(params);
      setItems(lista);
    } catch (e) {
      const is404 = e?.response?.status === 404;
      setError(
        is404
          ? "El tablero personal aún no está en el servidor. Endpoints esperados: recursos/tablero."
          : e?.message || "No se pudo cargar el tablero"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [verTodos, user?.id]);

  const cargarHistorial = useCallback(async () => {
    setLoadingHistorial(true);
    try {
      const { items: lista } = await tableroPersonalService.historial({ per_page: 50 });
      setHistorial(lista);
    } catch (e) {
      if (e?.response?.status !== 404) {
        setError(e?.message || "No se pudo cargar el historial");
      }
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (vista === "historial") {
      cargarHistorial();
    }
  }, [vista, cargarHistorial]);

  const stats = useMemo(() => {
    const counts = TABLERO_COLUMNAS.reduce((acc, col) => {
      acc[col.id] = 0;
      return acc;
    }, {});
    items.forEach((item) => {
      if (counts[item.estado] != null) counts[item.estado] += 1;
    });
    return counts;
  }, [items]);

  const onCreate = async (payload) => {
    await tableroPersonalService.create(payload);
    cargar();
  };

  const onUpdate = async (id, payload) => {
    await tableroPersonalService.update(id, payload);
    cargar();
  };

  const onMove = async (id, estado, orden = null) => {
    try {
      await tableroPersonalService.move(id, estado, orden);
      await cargar();
    } catch (e) {
      const validation = formatValidationErrors(e?.response?.errors);
      setError(
        validation
          ? `Validación del servidor: ${validation}`
          : e?.message || "No se pudo mover la actividad"
      );
      throw e;
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta actividad del tablero?")) return;
    await tableroPersonalService.remove(id);
    cargar();
  };

  const archivarCompletados = async () => {
    const n = stats.completado ?? 0;
    if (n === 0) {
      alert("No hay actividades completadas para archivar.");
      return;
    }
    if (
      !window.confirm(
        `¿Archivar ${n} actividad${n === 1 ? "" : "es"} completada${n === 1 ? "" : "s"}? Pasarán al historial.`
      )
    ) {
      return;
    }
    setArchivando(true);
    try {
      await tableroPersonalService.archivarCompletados();
      await cargar();
      if (vista === "historial") await cargarHistorial();
    } catch (e) {
      alert(e?.message || "No se pudo archivar");
    } finally {
      setArchivando(false);
    }
  };

  const formatFecha = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="recursos-page">
      <div className="recursos-page-header">
        <div>
          <h2 className="mb-1 d-flex align-items-center gap-2">
            <FaColumns className="text-primary" style={{ fontSize: "1.1rem" }} />
            Tablero de seguimiento
          </h2>
          <p className="text-muted mb-0">
            Gestión personal de compromisos y temas derivados de actas de reunión.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="warning" dismissible onClose={() => setError(null)} className="py-2">
          {error}
        </Alert>
      )}

      <div className="tablero-toolbar">
        <Nav variant="pills" className="tablero-view-tabs">
          <Nav.Item>
            <Nav.Link active={vista === "activo"} onClick={() => setVista("activo")}>
              Tablero activo
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link active={vista === "historial"} onClick={() => setVista("historial")}>
              <FaHistory className="me-1" /> Historial
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <div className="tablero-toolbar-actions">
          {vista === "activo" && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => kanbanRef.current?.openNew?.()}
              >
                <FaPlus className="me-1" /> Nueva actividad
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={archivando || (stats.completado ?? 0) === 0}
                onClick={archivarCompletados}
              >
                {archivando ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  <>
                    <FaArchive className="me-1" /> Archivar completados
                  </>
                )}
              </Button>
            </>
          )}
          <Form.Check
            type="switch"
            id="ver-todos-tablero"
            className="mb-0 ms-2 small"
            label="Ver equipo"
            checked={verTodos}
            onChange={(e) => setVerTodos(e.target.checked)}
            title="Requiere permiso recursos.tablero.view_all"
          />
        </div>
      </div>

      {vista === "activo" && (
        <>
          <div className="tablero-stats">
            {TABLERO_COLUMNAS.map((col) => (
              <span
                key={col.id}
                className="tablero-stat-chip"
                style={{ "--stat-color": col.color }}
              >
                <span className="stat-dot" />
                {col.label}: <strong>{stats[col.id] ?? 0}</strong>
              </span>
            ))}
          </div>

          <KanbanBoard
            ref={kanbanRef}
            items={items}
            loading={loading}
            onCreate={onCreate}
            onUpdate={onUpdate}
            onMove={onMove}
            onDelete={onDelete}
            hideToolbar
          />

          {!loading && !error && items.length === 0 && (
            <Alert variant="light" className="mt-3 border text-center">
              <p className="mb-2 text-muted">
                No hay actividades en el tablero. Registra compromisos surgidos en actas o
                seguimientos propios.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => kanbanRef.current?.openNew?.()}
              >
                <FaPlus className="me-1" /> Nueva actividad
              </Button>
            </Alert>
          )}
        </>
      )}

      {vista === "historial" && (
        <div className="bg-white border rounded p-0 overflow-hidden">
          {loadingHistorial ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="secondary" />
            </div>
          ) : historial.length === 0 ? (
            <Alert variant="light" className="m-3 border-0">
              No hay actividades archivadas. Las completadas se archivan manualmente o tras 14 días.
            </Alert>
          ) : (
            <Table responsive hover className="tablero-historial-table mb-0">
              <thead>
                <tr>
                  <th>Actividad</th>
                  <th>Detalle</th>
                  <th>Acta</th>
                  <th>Archivado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((row) => (
                  <tr key={row.id}>
                    <td className="fw-medium">{row.titulo}</td>
                    <td className="text-muted">{row.descripcion || "—"}</td>
                    <td>{row.acta_id ? `#${row.acta_id}` : "—"}</td>
                    <td className="text-muted">{formatFecha(row.archivado_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
};

export default MiTableroPage;
