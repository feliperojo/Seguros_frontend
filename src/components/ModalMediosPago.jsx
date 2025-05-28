import React, { useState, useEffect } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import MediosPagoTablas from "./MediosPagoTablas"; // Ajusta la ruta si es necesario
import apiRequest from "../services/api";


const ModalMediosPago = ({ show, onHide, clienteId }) => {
  const [loading, setLoading] = useState(false);
  const [medios, setMedios] = useState([]);

  useEffect(() => {
    if (show && clienteId) {
      setLoading(true);
      apiRequest(`mediopago/cliente/${clienteId}`, "GET")
        .then(setMedios)
        .catch(() => setMedios([]))
        .finally(() => setLoading(false));
    }
  }, [show, clienteId]);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Medios de Pago</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center"><Spinner animation="border" /></div>
        ) : (
          <MediosPagoTablas mediosPago={medios} showActions={false} />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
};
export default ModalMediosPago;