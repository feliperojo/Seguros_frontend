import React, { useEffect, useState } from "react";
import { Tabs, Tab, Table, Button, Badge, Spinner } from "react-bootstrap";
import {
  FaSearch, FaEdit, FaEye, FaTrashAlt, FaUserPlus,
  FaFilter, FaSortAmountDown, FaSortAmountUp, FaFileExport, FaTimes
} from "react-icons/fa";
import apiRequest from "../services/api"; // Asegúrate de tenerlo configurado
import NuevaTareaModal from "../components/Tareas/NuevaTareaModal"; // El modal que ya hicimos
import ResponderTareaModal from "../components/Tareas/ResponderTareaModal";
import DetalleBitacoraModal from "../components/Tareas/DetalleBitacoraModal";

const CentroOperaciones = () => {
  const [key, setKey] = useState("bitacora");
  const [logs, setLogs] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showResponderModal, setShowResponderModal] = useState(false);
  const [selectedTarea, setSelectedTarea] = useState(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);
  const [logSeleccionado, setLogSeleccionado] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Puedes ajustar este valor
  const [currentPageTareas, setCurrentPageTareas] = useState(1);
  const [itemsPerPageTareas] = useState(10);

  
  useEffect(() => {
    if (key === "bitacora") setCurrentPage(1);
    if (key === "tareas") setCurrentPageTareas(1);
  }, [key]);
  
  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiRequest("bitacora_operativa", "GET"),
      apiRequest("tareas_operativas", "GET")
    ])
    .then(([logsData, tareasData]) => {
      setLogs(Array.isArray(logsData) ? logsData : (logsData.data || []));
      setTareas(Array.isArray(tareasData) ? tareasData : (tareasData.data || []));
    })
    .finally(() => setLoading(false));
    
  }, [showModal]); // Volver a cargar cuando se cierra modal

  const statusBadge = (status) => {
    switch (status) {
      case "pending": return <Badge bg="warning">Pendiente</Badge>;
      case "in_progress": return <Badge bg="info">En progreso</Badge>;
      case "completed": return <Badge bg="success">Completada</Badge>;
      default: return <Badge bg="secondary">{status}</Badge>;
    }
  };
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = logs.slice(indexOfFirstItem, indexOfLastItem);
  
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  
  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const indexOfLastTarea = currentPageTareas * itemsPerPageTareas;
const indexOfFirstTarea = indexOfLastTarea - itemsPerPageTareas;
const currentTareas = tareas.slice(indexOfFirstTarea, indexOfLastTarea);

const totalPagesTareas = Math.ceil(tareas.length / itemsPerPageTareas);

const handlePageChangeTareas = (pageNumber) => {
  if (pageNumber >= 1 && pageNumber <= totalPagesTareas) {
    setCurrentPageTareas(pageNumber);
  }
};

  
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>📘 Centro de Operaciones</h4>
        <Button variant="primary" onClick={() => setShowModal(true)}>📌 Nueva Tarea</Button>
      </div>

      <Tabs activeKey={key} onSelect={(k) => setKey(k)} className="mb-3">
        <Tab eventKey="bitacora" title="Bitácora de Acciones">
          {loading ? <Spinner animation="border" /> : (
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
              {currentLogs.map((log) => (
               <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.user?.name}</td>
                    <td>
                          {log.cliente
                            ? `${log.cliente.nombre_completo} (ID: ${log.cliente.id})`
                            : "---"}
                        </td>

                    <td>{log.concept?.name}</td>
                    <td>{log.note}</td>
                    <td>{log.task?.assigned_user?.name || "No asignado"}</td>
                    <td>
                      {log.task?.status
                        ? statusBadge(log.task.status)
                        : <Badge bg="secondary">---</Badge>}
                    </td>
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
          {loading ? <Spinner animation="border" /> : (
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Entidad</th>
                  <th>Concepto</th>
                  <th>Estado</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
              {currentTareas.map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.created_at).toLocaleString()}</td>
                    <td>{t.log.entity_type} #{t.log.entity_id}</td>
                    <td>{t.log.concept?.name}</td>
                    <td>{statusBadge(t.status)}</td>
                    <td>{t.response_note || '---'}</td>
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
          <button className="page-link" onClick={() => handlePageChangeTareas(currentPageTareas - 1)}>
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
          <button className="page-link" onClick={() => handlePageChangeTareas(currentPageTareas + 1)}>
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
            if (updated) window.location.reload(); // o vuelve a hacer fetch de tareas
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
