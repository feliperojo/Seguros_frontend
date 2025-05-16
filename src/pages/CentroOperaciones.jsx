import React, { useEffect, useState } from "react";
import { Tabs, Tab, Table, Button, Badge, Spinner } from "react-bootstrap";
import { FaEye } from "react-icons/fa";
import apiRequest from "../services/api";
import NuevaTareaModal from "../components/Tareas/NuevaTareaModal";
import ResponderTareaModal from "../components/Tareas/ResponderTareaModal";
import DetalleBitacoraModal from "../components/Tareas/DetalleBitacoraModal";

const CentroOperaciones = () => {
  const [key, setKey] = useState("bitacora");

  // Bitacora
  const [logsData, setLogsData] = useState({ data: [], total: 0, current_page: 1, per_page: 10 });
  const [currentPage, setCurrentPage] = useState(1);
  const [fechaInicioBitacora, setFechaInicioBitacora] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 5);  // restar 5 días
    return d.toISOString().split("T")[0];
  });
  const [fechaFinBitacora, setFechaFinBitacora] = useState(() => new Date().toISOString().split("T")[0]);
  const [fechaInicioBitacoraFiltro, setFechaInicioBitacoraFiltro] = useState(fechaInicioBitacora);
  const [fechaFinBitacoraFiltro, setFechaFinBitacoraFiltro] = useState(fechaFinBitacora);

  // Tareas
  const [tareasData, setTareasData] = useState({ data: [], total: 0, current_page: 1, per_page: 10 });
  const [currentPageTareas, setCurrentPageTareas] = useState(1);
  const [fechaInicioTareas, setFechaInicioTareas] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 5);  // restar 5 días
    return d.toISOString().split("T")[0];
  });
  const [fechaFinTareas, setFechaFinTareas] = useState(() => new Date().toISOString().split("T")[0]);
  const [fechaInicioTareasFiltro, setFechaInicioTareasFiltro] = useState(fechaInicioTareas);
  const [fechaFinTareasFiltro, setFechaFinTareasFiltro] = useState(fechaFinTareas);

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showResponderModal, setShowResponderModal] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [logSeleccionado, setLogSeleccionado] = useState(null);

  // Carga datos paginados para cada sección con filtros respectivos
  const cargarDatos = (pageBitacora = currentPage, pageTareas = currentPageTareas) => {
    setLoading(true);
    Promise.all([
      apiRequest(
        `bitacora_operativa?per_page=${logsData.per_page}&page=${pageBitacora}&fecha_inicio=${fechaInicioBitacoraFiltro}&fecha_fin=${fechaFinBitacoraFiltro}`,
        "GET"
      ),
      apiRequest(
        `tareas_operativas?per_page=${tareasData.per_page}&page=${pageTareas}&fecha_inicio=${fechaInicioTareasFiltro}&fecha_fin=${fechaFinTareasFiltro}`,
        "GET"
      )
    ])
      .then(([logs, tareas]) => {
        setLogsData(logs && logs.data ? logs : { data: [], total: 0, current_page: 1, per_page: 10 });
        setTareasData(tareas && tareas.data ? tareas : { data: [], total: 0, current_page: 1, per_page: 10 });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargarDatos(1, 1);
  }, [showModal]);

  // Reset filtros al cambiar pestaña
  useEffect(() => {
    if (key === "bitacora") {
      setCurrentPage(1);
      setFechaInicioBitacoraFiltro(fechaInicioBitacora);
      setFechaFinBitacoraFiltro(fechaFinBitacora);
    } else if (key === "tareas") {
      setCurrentPageTareas(1);
      setFechaInicioTareasFiltro(fechaInicioTareas);
      setFechaFinTareasFiltro(fechaFinTareas);
    }
  }, [key]);

  // Paginación bitácora
  const totalPages = Math.ceil(logsData.total / logsData.per_page);
  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      cargarDatos(pageNumber, currentPageTareas);
    }
  };

  // Paginación tareas
  const totalPagesTareas = Math.ceil(tareasData.total / tareasData.per_page);
  const handlePageChangeTareas = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPagesTareas) {
      setCurrentPageTareas(pageNumber);
      cargarDatos(currentPage, pageNumber);
    }
  };

  // Badge estado
  const statusBadge = (status) => {
    switch (status) {
      case "pending":
        return <Badge bg="warning">Pendiente</Badge>;
      case "in_progress":
        return <Badge bg="info">En progreso</Badge>;
      case "completed":
        return <Badge bg="success">Completada</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h4>📘 Centro de Operaciones</h4>
        <Button variant="primary" onClick={() => setShowModal(true)} style={{ whiteSpace: "nowrap" }}>
          📌 Nueva Tarea
        </Button>
      </div>

      {/* Filtros fecha independientes */}
      {key === "bitacora" && (
        <div className="d-flex align-items-center mb-3 gap-2" style={{ maxWidth: "500px" }}>
          <label htmlFor="fechaInicioBitacora" className="mb-0" style={{ fontSize: "0.85rem" }}>
            Fecha inicio:
          </label>
          <input
            type="date"
            id="fechaInicioBitacora"
            value={fechaInicioBitacoraFiltro}
            onChange={(e) => setFechaInicioBitacoraFiltro(e.target.value)}
            style={{ width: "130px", height: "28px" }}
          />
          <label htmlFor="fechaFinBitacora" className="mb-0" style={{ fontSize: "0.85rem" }}>
            Fecha fin:
          </label>
          <input
            type="date"
            id="fechaFinBitacora"
            value={fechaFinBitacoraFiltro}
            onChange={(e) => setFechaFinBitacoraFiltro(e.target.value)}
            style={{ width: "130px", height: "28px" }}
          />
          <Button size="sm" onClick={() => cargarDatos(1, currentPageTareas)}>
            Filtrar
          </Button>
        </div>
      )}

      {key === "tareas" && (
        <div className="d-flex align-items-center mb-3 gap-2" style={{ maxWidth: "500px" }}>
          <label htmlFor="fechaInicioTareas" className="mb-0" style={{ fontSize: "0.85rem" }}>
            Fecha inicio:
          </label>
          <input
            type="date"
            id="fechaInicioTareas"
            value={fechaInicioTareasFiltro}
            onChange={(e) => setFechaInicioTareasFiltro(e.target.value)}
            style={{ width: "130px", height: "28px" }}
          />
          <label htmlFor="fechaFinTareas" className="mb-0" style={{ fontSize: "0.85rem" }}>
            Fecha fin:
          </label>
          <input
            type="date"
            id="fechaFinTareas"
            value={fechaFinTareasFiltro}
            onChange={(e) => setFechaFinTareasFiltro(e.target.value)}
            style={{ width: "130px", height: "28px" }}
          />
          <Button size="sm" onClick={() => cargarDatos(currentPage, 1)}>
            Filtrar
          </Button>
        </div>
      )}

      <Tabs activeKey={key} onSelect={(k) => setKey(k)} className="mb-3">
        <Tab eventKey="bitacora" title="Bitácora de Acciones">
          {loading ? (
            <Spinner animation="border" />
          ) : (
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Cliente</th>
                  <th>Concepto</th>
                  <th>Nota</th>
                  <th>Asignado a</th>
                  <th>Estado</th>
                  <th>Respuesta</th>
                  <th>Ver</th>
                </tr>
              </thead>
              <tbody>
                {(logsData.data || []).map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.user?.name}</td>
                    <td>{log.cliente ? `${log.cliente.nombre_completo} (ID: ${log.cliente.id})` : "---"}</td>
                    <td>{log.concept?.name}</td>
                    <td>{log.note}</td>
                    <td>{log.task?.assigned_user?.name || "No asignado"}</td>
                    <td>{log.task?.status ? statusBadge(log.task.status) : <Badge bg="secondary">---</Badge>}</td>
                    <td>{log.task?.response_note || "---"}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="light"
                        onClick={() => {
                          setLogSeleccionado(log);
                          setShowDetalleModal(true);
                        }}
                      >
                        <FaEye />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Tab>
        <Tab eventKey="tareas" title="Mis Tareas">
          {loading ? (
            <Spinner animation="border" />
          ) : (
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Fecha Tarea</th>
                  <th>Cliente</th>
                  <th>Concepto</th>
                  <th>Estado</th>
                  <th>Tarea</th>
                  <th>Respuesta</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {(tareasData.data || []).map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.created_at).toLocaleString()}</td>
                    <td>
                        {t.log.cliente
                          ? `${t.log.cliente.nombre_completo} (ID: ${t.log.cliente.id})`
                          : `${t.log.entity_type} #${t.log.entity_id}`}
                      </td>
                    <td>{t.log.concept?.name}</td>
                    <td>{statusBadge(t.status)}</td>
                    <td>{t.log.note || "---"}</td>
                    <td>{t.response_note || "---"}</td>
                    <td>
                      {t.status !== "completed" && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setSelectedTarea(t);
                            setShowResponderModal(true);
                          }}
                        >
                          Responder
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Tab>
      </Tabs>

      {key === "bitacora" && (
        <div className="d-flex justify-content-center mt-3">
          <nav>
            <ul className="pagination">
              <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => handlePageChange(currentPage - 1)}>
                  «
                </button>
              </li>

              {[...Array(totalPages)].map((_, i) => (
                <li key={i + 1} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                  <button className="page-link" onClick={() => handlePageChange(i + 1)}>
                    {i + 1}
                  </button>
                </li>
              ))}

              <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                <button className="page-link" onClick={() => handlePageChange(currentPage + 1)}>
                  »
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {key === "tareas" && (
        <div className="d-flex justify-content-center mt-3">
          <nav>
            <ul className="pagination">
              <li className={`page-item ${currentPageTareas === 1 ? "disabled" : ""}`}>
                <button
                  className="page-link"
                  onClick={() => handlePageChangeTareas(currentPageTareas - 1)}
                >
                  «
                </button>
              </li>

              {[...Array(totalPagesTareas)].map((_, i) => (
                <li key={i + 1} className={`page-item ${currentPageTareas === i + 1 ? "active" : ""}`}>
                  <button className="page-link" onClick={() => handlePageChangeTareas(i + 1)}>
                    {i + 1}
                  </button>
                </li>
              ))}

              <li className={`page-item ${currentPageTareas === totalPagesTareas ? "disabled" : ""}`}>
                <button
                  className="page-link"
                  onClick={() => handlePageChangeTareas(currentPageTareas + 1)}
                >
                  »
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}

      <NuevaTareaModal show={showModal} onHide={() => setShowModal(false)} categoria="tarea_manual" />
      {selectedTarea && (
        <ResponderTareaModal
          show={showResponderModal}
          onHide={(updated) => {
            setShowResponderModal(false);
            setSelectedTarea(null);
            if (updated) window.location.reload();
          }}
          tarea={selectedTarea}
        />
      )}
      {logSeleccionado && (
        <DetalleBitacoraModal
          show={showDetalleModal}
          onHide={() => {
            setShowDetalleModal(false);
            setLogSeleccionado(null);
          }}
          log={logSeleccionado}
        />
      )}
    </>
  );
};

export default CentroOperaciones;
