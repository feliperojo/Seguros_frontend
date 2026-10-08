/* eslint-disable react/prop-types */
import { Alert, Button, Form, Modal } from "react-bootstrap";
import {
  ESTADOS_INFORME_PAGO,
  normalizarEstadoPago,
  prepararActualizacionEstadoInforme,
} from "../utils/informePagosEstado";

const etiquetaEstado = (estado) => {
  const clave = normalizarEstadoPago(estado);
  return ESTADOS_INFORME_PAGO.find((item) => item.value === clave)?.label || (estado ? String(estado) : "—");
};

const ActualizarEstadoPagoInformeModal = ({
  seleccion,
  estadoSeleccionado,
  guardando,
  error,
  onCambiarEstado,
  onCancel,
  onGuardar,
}) => {
  const actual = normalizarEstadoPago(seleccion?.estadoActual);
  const opciones = ESTADOS_INFORME_PAGO.some((item) => item.value === actual) || !actual
    ? ESTADOS_INFORME_PAGO
    : [{ value: actual, label: etiquetaEstado(actual), bloqueado: true }, ...ESTADOS_INFORME_PAGO];
  const preparado = prepararActualizacionEstadoInforme({
    pagoId: seleccion?.pagoId,
    estadoActual: seleccion?.estadoActual,
    estadoNuevo: estadoSeleccionado,
  });
  const puedeGuardar = Boolean(seleccion) && preparado.enviar && !guardando;

  return (
    <Modal
      show={Boolean(seleccion)}
      onHide={onCancel}
      centered
      scrollable
      className="pagos-informe-estado-modal"
      aria-labelledby="actualizar-estado-pago-titulo"
      backdrop={guardando ? "static" : true}
      keyboard={!guardando}
    >
      <Modal.Header closeButton={!guardando}>
        <Modal.Title id="actualizar-estado-pago-titulo" as="h2" className="h5 mb-0">
          Actualizar estado del pago
        </Modal.Title>
      </Modal.Header>
      {seleccion ? (
        <>
          <Modal.Body>
            {error ? <Alert variant="danger">{error}</Alert> : null}
            <dl className="pagos-informe-estado-modal__identidad">
              <div className="pagos-informe-estado-modal__dato">
                <dt>Cobro</dt>
                <dd>{seleccion.pagoId}</dd>
              </div>
              <div className="pagos-informe-estado-modal__dato">
                <dt>Cliente</dt>
                <dd>{seleccion.cliente || "—"}</dd>
              </div>
              <div className="pagos-informe-estado-modal__dato">
                <dt>Cobertura</dt>
                <dd>{seleccion.cobertura || "—"}</dd>
              </div>
              <div className="pagos-informe-estado-modal__dato">
                <dt>Grupo</dt>
                <dd>{seleccion.grupo ?? "—"}</dd>
              </div>
              <div className="pagos-informe-estado-modal__dato">
                <dt>Mes / año</dt>
                <dd>{seleccion.periodo || "—"}</dd>
              </div>
              <div className="pagos-informe-estado-modal__dato">
                <dt>Monto</dt>
                <dd>{seleccion.monto || "—"}</dd>
              </div>
              <div className="pagos-informe-estado-modal__dato">
                <dt>Estado actual</dt>
                <dd>{etiquetaEstado(seleccion.estadoActual)}</dd>
              </div>
            </dl>
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                if (puedeGuardar) onGuardar();
              }}
            >
              <Form.Group className="mb-0">
                <Form.Label htmlFor="estado-pago-informe">Nuevo estado</Form.Label>
                <Form.Select
                  id="estado-pago-informe"
                  value={estadoSeleccionado}
                  onChange={(event) => onCambiarEstado(event.target.value)}
                  disabled={guardando}
                  autoFocus
                  aria-describedby="estado-pago-informe-ayuda"
                >
                  {estadoSeleccionado === "" ? (
                    <option value="" disabled>
                      Selecciona un estado
                    </option>
                  ) : null}
                  {opciones.map((opcion) => (
                    <option key={opcion.value} value={opcion.value} disabled={Boolean(opcion.bloqueado)}>
                      {opcion.label}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text id="estado-pago-informe-ayuda">
                  El cambio se envía solo al guardar.
                </Form.Text>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="outline-secondary" onClick={onCancel} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={onGuardar} disabled={!puedeGuardar}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </Modal.Footer>
        </>
      ) : null}
    </Modal>
  );
};

export default ActualizarEstadoPagoInformeModal;
