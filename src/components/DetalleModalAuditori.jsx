import React from "react";
import { Modal, Table, Button } from "react-bootstrap";

const DetalleModalAuditori = ({ show, onHide, anterior = {}, nuevo = {} }) => {
  const cambios = Object.keys(anterior).filter(
    (key) => JSON.stringify(anterior[key]) !== JSON.stringify(nuevo[key])
  );

  const renderValor = (valor) => {
    if (Array.isArray(valor)) {
      return (
        <ul className="mb-0">
          {valor.map((item, i) => (
            <li key={i}>
              {typeof item === "object" ? (
                <div className="mb-2">
                  {Object.entries(item).map(([k, v]) => (
                    <div key={k}>
                      <strong>{k}:</strong> {String(v)}
                    </div>
                  ))}
                </div>
              ) : (
                String(item)
              )}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof valor === "object" && valor !== null) {
      return (
        <div>
          {Object.entries(valor).map(([k, v]) => (
            <div key={k}>
              <strong>{k}:</strong> {String(v)}
            </div>
          ))}
        </div>
      );
    }

    return String(valor ?? "null");
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Cambios detectados</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {cambios.length > 0 ? (
          <Table bordered hover responsive>
            <thead>
              <tr>
                <th>Campo</th>
                <th>Antes</th>
                <th>Después</th>
              </tr>
            </thead>
            <tbody>
              {cambios.map((key) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{renderValor(anterior[key])}</td>
                  <td>{renderValor(nuevo[key])}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p>No se detectaron cambios.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DetalleModalAuditori;
