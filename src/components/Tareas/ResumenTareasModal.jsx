import React, { useEffect, useState } from "react";
import { Modal, Table, Badge } from "react-bootstrap";
import apiRequest from "../../services/api"; // ajusta según tu estructura

const ResumenTareasModal = ({ show, onHide, fecha, setFecha }) => {
  const [tareasPorUsuario, setTareasPorUsuario] = useState([]);
  const fechaObjetivo = fecha ? new Date(fecha) : new Date();

  // 🔁 Fetch de resumen al abrir modal o cambiar fecha
  useEffect(() => {
    const fetchResumen = async () => {
      if (!show || !fecha) return;

      const fechaFormato = fechaObjetivo.toISOString().slice(0, 10);

      try {
        const response = await apiRequest(`tareas_operativas/resumen-tareas?fecha=${fechaFormato}`, "GET");
        console.log("🔁 Respuesta resumen tareas:", response);
        setTareasPorUsuario(response || []);
      } catch (error) {
        console.error("Error al obtener resumen de tareas:", error);
        setTareasPorUsuario([]); // fallback vacío
      }
    };

    fetchResumen();
  }, [show, fecha]);

  // ✅ Asegura que si no hay fecha al abrir, se setea automáticamente
  useEffect(() => {
    if (!fecha && show) {
      setFecha(new Date());
    }
  }, [fecha, show, setFecha]);

  // 🔄 Opciones del selector
  const generarOpcionesDias = () => {
    const año = fechaObjetivo.getFullYear();
    const mes = fechaObjetivo.getMonth();
    const diasEnMes = new Date(año, mes + 1, 0).getDate();

    return Array.from({ length: diasEnMes }, (_, i) => {
      const dia = i + 1;
      const fechaCompleta = new Date(año, mes, dia);
      const formatted = fechaCompleta.toISOString().slice(0, 10);
      return (
        <option key={formatted} value={formatted}>
          {dia}
        </option>
      );
    });
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Resumen de Tareas - {fechaObjetivo.toLocaleDateString()}</Modal.Title>
        <div className="mb-3">
          <label className="form-label fw-bold">Seleccionar día:</label>
          <select
            className="form-select form-select-sm"
            value={fechaObjetivo.toISOString().slice(0, 10)}
            onChange={(e) => {
              const nuevaFecha = new Date(e.target.value);
              setFecha(nuevaFecha);
            }}
          >
            {generarOpcionesDias()}
          </select>
        </div>
      </Modal.Header>
      <Modal.Body>
        <Table bordered hover responsive>
          <thead>
            <tr>
              <th>Usuario</th>
              <th><Badge bg="warning">Pendientes</Badge></th>
              <th><Badge bg="info">En Progreso</Badge></th>
              <th><Badge bg="success">Completadas</Badge></th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {tareasPorUsuario.map((u) => (
              <tr key={u.usuario.id}>
                <td>{u.usuario.name}</td>
                <td><Badge bg="warning">{u.pending}</Badge></td>
                <td><Badge bg="info">{u.in_progress}</Badge></td>
                <td><Badge bg="success">{u.completed}</Badge></td>
                <td><strong>{u.total}</strong></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Modal.Body>
    </Modal>
  );
};

export default ResumenTareasModal;
