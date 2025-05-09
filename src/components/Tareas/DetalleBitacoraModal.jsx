// src/components/Tareas/DetalleBitacoraModal.jsx
import React from "react";
import { Modal, Button, Table } from "react-bootstrap";

const DetalleBitacoraModal = ({ show, onHide, log }) => {
  if (!log) return null;
console.log(log)
  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>📋 Detalles del Registro</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Table bordered>
          <tbody>
            <tr><th>Fecha</th><td>{new Date(log.created_at).toLocaleString()}</td></tr>
            <tr><th>Usuario</th><td>{log.user?.name}</td></tr>
            <tr><th>Acción</th><td>{log.action_type}</td></tr>
            <tr><th>Cliente</th><td>{log.cliente?.nombre_completo}</td></tr>
            <tr><th>Grupo familiar</th><td>{log.grupo_familiar_id || "---"}</td></tr>
            <tr><th>Entidad</th><td>{log.entity_type} </td></tr>
            <tr><th>Concepto</th><td>{log.concept?.name}</td></tr>
            <tr><th>Nota</th><td>{log.note}</td></tr>
            <tr><th>Asignado a</th><td>{log.task?.assigned_user?.name || "No asignado"}</td></tr>
            <tr><th>Estado de Tarea</th><td>{log.task?.status || "---"}</td></tr>
            <tr><th>Respuesta</th><td>{log.task?.response_note || "---"}</td></tr>
            <tr><th>Fecha de respuesta</th><td>{log.task?.completed_at ? new Date(log.task.completed_at).toLocaleString() : "---"}</td>
            </tr>
          </tbody>
        </Table>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DetalleBitacoraModal;
