/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import {
  coberturasPorCorregir,
  resumenConfirmacionCobros,
} from "../utils/revisionGeneracionCobros";

const texto = (valor) => {
  const limpio = String(valor ?? "").trim();
  return limpio || "";
};

const VistaPreviaCobrosModal = ({
  show,
  vista,
  detallePorCobertura = {},
  error,
  alcance,
  generando,
  validando,
  onCancel,
  onActualizar,
  onConfirmar,
}) => {
  const [confirmoPeriodo, setConfirmoPeriodo] = useState(false);
  const problemas = coberturasPorCorregir(vista);
  const resumen = resumenConfirmacionCobros(vista);
  const hayProblemas = problemas.length > 0;
  const consultaFallida = Boolean(error);
  const puedeGenerar =
    Boolean(vista) &&
    !hayProblemas &&
    !consultaFallida &&
    !validando &&
    !generando &&
    (!resumen.requiereConfirmacion || confirmoPeriodo);

  useEffect(() => {
    setConfirmoPeriodo(false);
  }, [vista?.huella]);

  const identificar = (item) => {
    const extra = detallePorCobertura[item.cobertura_id] || {};
    const cliente = texto(item.cliente_nombre) || texto(extra.cliente_nombre);
    const grupo = item.grupo_familiar_id || extra.grupo_familiar_id;
    const producto = texto(item.cobertura_tipo) || texto(extra.producto);
    const poliza = texto(item.codigo_poliza) || texto(extra.codigo_poliza);
    return { cliente, grupo, producto, poliza };
  };

  return (
    <Modal show={show} onHide={onCancel} size={hayProblemas ? "lg" : "md"} scrollable centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {hayProblemas
            ? "Coberturas por corregir"
            : consultaFallida
              ? "No se pudo validar"
              : "Confirmar generación de cobros"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error ? <Alert variant="warning">{error}</Alert> : null}
        {alcance ? <p className="mb-3">{alcance}</p> : null}
        {hayProblemas ? (
          <>
            <p className="mb-1">
              Período: <strong>{resumen.periodo || "el período seleccionado"}</strong>
            </p>
            <p>
              Hay {problemas.length}{" "}
              {problemas.length === 1 ? "cobertura que requiere" : "coberturas que requieren"}{" "}
              corrección antes de generar los cobros.
            </p>
            <ul className="list-unstyled mb-0">
              {problemas.map((item) => {
                const identidad = identificar(item);
                const motivos = Array.isArray(item.motivos) ? item.motivos.filter(Boolean) : [];
                return (
                  <li key={item.cobertura_id} className="border rounded p-2 mb-2">
                    <div className="fw-semibold">{identidad.cliente || "Sin cliente"}</div>
                    <div className="small text-muted">
                      Grupo familiar {identidad.grupo || "—"} · Cobertura {item.cobertura_id}
                      {identidad.producto ? ` · ${identidad.producto}` : ""}
                      {identidad.poliza ? ` · Póliza ${identidad.poliza}` : ""}
                    </div>
                    <ul className="mb-2 mt-2 ps-3">
                      {motivos.length > 0 ? (
                        motivos.map((motivo) => <li key={motivo}>{motivo}</li>)
                      ) : (
                        <li>El servicio no devolvió un motivo para esta cobertura.</li>
                      )}
                    </ul>
                    {identidad.grupo ? (
                      <Link
                        to={`/grupo_familiar/${identidad.grupo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ir a corregir
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        ) : consultaFallida ? null : (
          <>
            <p className="mb-1">
              Período: <strong>{resumen.periodo || "el período seleccionado"}</strong>
            </p>
            <p className="mb-1">Se generarán {resumen.nuevos} cobros nuevos.</p>
            <p className="mb-0">
              {resumen.existentes} cobros que ya existen se conservarán.
            </p>
            {resumen.requiereConfirmacion ? (
              <Form.Check
                className="mt-3"
                checked={confirmoPeriodo}
                onChange={(event) => setConfirmoPeriodo(event.target.checked)}
                label="Este período es anterior al mes en curso y parte de los datos salen de la cobertura actual, porque no hay un historial de plan que cubra el mes. Confirmo que corresponden a este período."
              />
            ) : null}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {hayProblemas ? (
          <>
            <Button variant="outline-secondary" onClick={onCancel} disabled={generando || validando}>
              Aceptar
            </Button>
            <Button variant="outline-primary" onClick={onActualizar} disabled={generando || validando}>
              {validando ? "Validando…" : "Volver a validar"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline-secondary" onClick={onCancel} disabled={generando || validando}>
              Cancelar
            </Button>
            {consultaFallida ? (
              <Button variant="outline-primary" onClick={onActualizar} disabled={generando || validando}>
                {validando ? "Validando…" : "Volver a validar"}
              </Button>
            ) : (
              <Button
                className="pagos-mensuales__btn-primary"
                onClick={() => onConfirmar({ confirmarDatosPeriodo: confirmoPeriodo })}
                disabled={!puedeGenerar}
              >
                {generando ? "Generando…" : "Generar cobros"}
              </Button>
            )}
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default VistaPreviaCobrosModal;
