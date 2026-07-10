import React from "react";
import { Modal, Table, Badge } from "react-bootstrap";

const DetalleModalAuditori = ({ show, onHide, historial = [] }) => {
  const renderValor = (valor) => {
    if (Array.isArray(valor)) {
      return (
        <ul className="mb-0 ps-3">
          {valor.map((item, i) => (
            <li key={i}>
              {typeof item === "object" ? (
                Object.entries(item).map(([k, v]) => (
                  <div key={k}>
                    <strong>{k}:</strong> {String(v)}
                  </div>
                ))
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
        <div className="small">
          {Object.entries(valor).map(([k, v]) => (
            <div key={k}>
              <strong>{k}:</strong> {String(v)}
            </div>
          ))}
        </div>
      );
    }

    return valor === null || valor === "" ? (
      <Badge bg="secondary">Sin datos</Badge>
    ) : (
      <span className="text-dark">{String(valor)}</span>
    );
  };

  const renderCambios = (anterior, nuevo) => {
    const claves = Object.keys({ ...anterior, ...nuevo });
    return claves
      .filter(key => JSON.stringify(anterior[key]) !== JSON.stringify(nuevo[key]))
      .map(key => (
        <tr key={key}>
          <td className="fw-semibold text-capitalize">{key.replace(/_/g, " ")}</td>
          <td>{renderValor(anterior[key])}</td>
          <td>{renderValor(nuevo[key])}</td>
        </tr>
      ));
  };

  // Tomamos el nombre del cliente del primer registro del historial
  const nombreCliente = historial[0]?.nombre_cliente || historial[0]?.cliente?.nombre_completo || "Desconocido";

  return (
    <Modal show={show} onHide={onHide} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          Historial de Cambios — <span className="text-primary">{nombreCliente}</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {historial.length > 0 ? (
          historial.map((item, index) => (
            <div key={item.id || index} className="mb-4 border-bottom pb-3">
              <h6 className="text-muted">
                <strong>Fecha:</strong> {new Date(item.created_at).toLocaleString()} | <strong>Usuario:</strong> {item.usuario} | <strong>Acción:</strong>{" "}
                <Badge
                  bg={
                    item.accion === "delete"
                      ? "danger"
                      : item.accion === "update"
                      ? "warning"
                      : "info"
                  }
                >
                  {item.accion?.toUpperCase()}
                </Badge>
              </h6>
              <Table bordered responsive size="sm">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "30%" }}>Campo</th>
                    <th style={{ width: "35%" }}>Valor Anterior</th>
                    <th style={{ width: "35%" }}>Valor Nuevo</th>
                  </tr>
                </thead>
                <tbody>
                  {renderCambios(item.estado_anterior || {}, item.estado_nuevo || {})}
                </tbody>
              </Table>
            </div>
          ))
        ) : (
          <p className="text-muted">No se encontraron cambios históricos.</p>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default DetalleModalAuditori;
