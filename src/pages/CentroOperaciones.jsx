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


  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiRequest("bitacora_operativa", "GET"),      // Debes implementar este endpoint
      apiRequest("tareas_operativas", "GET")
    ])
      .then(([logsData, tareasData]) => {
        setLogs(logsData);
        setTareas(tareasData);
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
                {logs.map((log) => (
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
                {tareas.map((t) => (
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
