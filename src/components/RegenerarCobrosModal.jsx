import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import apiRequest from "../services/api";
import {
  CAMPOS_REVISION,
  MODALIDAD_COBERTURA_Y_MONTO,
  MODALIDAD_SOLO_COBERTURA,
  prepararConfirmacionRegeneracion,
  textoMontoRevision,
} from "../utils/regenerarCobros";

const texto = (valor) => {
  if (valor == null || String(valor).trim() === "") return "—";
  return String(valor);
};

const RegenerarCobrosModal = ({ show, pagoIds, periodo, onCancel, onGuardado }) => {
  const [incluidos, setIncluidos] = useState([]);
  const [preview, setPreview] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [modalidad, setModalidad] = useState(MODALIDAD_SOLO_COBERTURA);
  const [motivo, setMotivo] = useState("");
  const [confirmarDatos, setConfirmarDatos] = useState(false);
  const guardandoRef = useRef(false);
  const idsKey = (pagoIds || []).join(",");
  const incluidosKey = incluidos.join(",");

  useEffect(() => {
    if (!show) return;
    setIncluidos(pagoIds || []);
    setModalidad(MODALIDAD_SOLO_COBERTURA);
    setMotivo("");
    setConfirmarDatos(false);
    setError("");
    setPreview(null);
  }, [show, idsKey]);

  useEffect(() => {
    if (!show || incluidos.length === 0) {
      setPreview(null);
      setCargando(false);
      return;
    }
    let cancel = false;
    setCargando(true);
    setError("");
    apiRequest("cobertura/pagos/regenerar/vista-previa", "POST", { pago_ids: incluidos })
      .then((respuesta) => {
        if (cancel) return;
        setPreview(respuesta?.data?.items ? respuesta.data : respuesta?.data || respuesta);
      })
      .catch((err) => {
        if (!cancel) {
          setPreview(null);
          setError(err.message || "No se pudo preparar la revisión.");
        }
      })
      .finally(() => {
        if (!cancel) setCargando(false);
      });
    return () => {
      cancel = true;
    };
  }, [show, incluidosKey]);

  const items = preview?.items || [];
  const confirmacion = useMemo(
    () =>
      prepararConfirmacionRegeneracion({
        incluidos,
        preview,
        modalidad,
        motivo,
        confirmarDatosActuales: confirmarDatos,
      }),
    [incluidos, preview, modalidad, motivo, confirmarDatos]
  );

  const excluir = (pagoId) => {
    setIncluidos((actual) => actual.filter((id) => id !== pagoId));
  };

  const guardar = async () => {
    if (guardandoRef.current || !confirmacion.ok) {
      setError(confirmacion.errores.join(" "));
      return;
    }
    guardandoRef.current = true;
    setGuardando(true);
    setError("");
    try {
      const respuesta = await apiRequest("cobertura/pagos/regenerar", "POST", confirmacion.body);
      onGuardado?.(respuesta?.message || "Se regeneraron los cobros.");
    } catch (err) {
      const data = err.response?.data || {};
      const bloqueos = Array.isArray(data.bloqueos) ? data.bloqueos : [];
      const detalle = bloqueos
        .map((bloqueo) => `Cobro ${bloqueo.pago_id}: ${(bloqueo.motivos || []).join(" ")}`)
        .join(" ");
      setError([data.message || err.message || "No se pudo regenerar.", detalle].filter(Boolean).join(" "));
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  };

  return (
    <Modal show={show} onHide={onCancel} size="xl" centered backdrop={guardando ? "static" : true}>
      <Modal.Header closeButton={!guardando}>
        <Modal.Title>Regenerar cobros</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          {periodo ? `${periodo}. ` : ""}
          La revisión compara cada cobro con la propuesta del período. Cancelar no guarda nada.
        </p>
        {error ? <Alert variant="warning">{error}</Alert> : null}
        {cargando ? (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" role="status" />
            Preparando la comparación…
          </div>
        ) : null}
        {!cargando && incluidos.length === 0 ? (
          <Alert variant="info">No hay cobros incluidos.</Alert>
        ) : null}

        <Form.Group className="mb-3">
          <Form.Label>Modalidad</Form.Label>
          <Form.Check
            type="radio"
            name="modalidad-regenerar"
            id="modalidad-solo-cobertura"
            label="Actualizar solo datos de cobertura"
            checked={modalidad === MODALIDAD_SOLO_COBERTURA}
            onChange={() => setModalidad(MODALIDAD_SOLO_COBERTURA)}
            disabled={guardando}
          />
          <Form.Text className="d-block mb-2">
            Reconstruye la cobertura guardada y conserva el monto, el estado y la fecha de pago.
          </Form.Text>
          <Form.Check
            type="radio"
            name="modalidad-regenerar"
            id="modalidad-cobertura-monto"
            label="Actualizar datos y monto"
            checked={modalidad === MODALIDAD_COBERTURA_Y_MONTO}
            onChange={() => setModalidad(MODALIDAD_COBERTURA_Y_MONTO)}
            disabled={guardando}
          />
          <Form.Text className="d-block">
            Recalcula el monto con las reglas del período y conserva el estado y la fecha de pago.
          </Form.Text>
        </Form.Group>

        {items.map((item) => {
          const montos = textoMontoRevision(item, modalidad);
          const bloqueaImporte = modalidad === MODALIDAD_COBERTURA_Y_MONTO && item.importe_bloqueado;
          return (
            <section key={item.pago_id} className="border rounded p-3 mb-3">
              <div className="d-flex justify-content-between gap-2 flex-wrap">
                <strong>Cobro {item.pago_id}</strong>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => excluir(item.pago_id)}
                  disabled={guardando}
                >
                  Excluir
                </Button>
              </div>
              {item.origen_texto ? (
                <p className="mb-1 mt-2">
                  Origen: {item.origen_texto}
                  {item.usa_datos_actuales && item.es_anterior
                    ? " Estos datos salen de la cobertura actual, no de un historial de ese período."
                    : ""}
                </p>
              ) : null}
              {item.bloqueado ? (
                <Alert variant="warning" className="mt-2 mb-2">
                  {(item.bloqueos || []).join(" ")}
                </Alert>
              ) : null}
              {bloqueaImporte ? (
                <Alert variant="warning" className="mt-2 mb-2">
                  {item.motivo_importe}
                </Alert>
              ) : null}
              <div className="table-responsive">
                <table className="table table-sm mb-2">
                  <thead>
                    <tr>
                      <th>Dato</th>
                      <th>Existente</th>
                      <th>Propuesto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CAMPOS_REVISION.map(([clave, etiqueta]) => (
                      <tr key={clave}>
                        <td>{etiqueta}</td>
                        <td>{texto(item.existente?.[clave])}</td>
                        <td>{texto(item.propuesto?.[clave])}</td>
                      </tr>
                    ))}
                    {montos.map((fila) => (
                      <tr key={fila.etiqueta}>
                        <td>{fila.etiqueta}</td>
                        <td colSpan={2}>{fila.valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {preview?.requiere_confirmacion_datos_actuales ? (
          <Form.Check
            className="mb-3"
            checked={confirmarDatos}
            onChange={(e) => setConfirmarDatos(e.target.checked)}
            disabled={guardando}
            label="Confirmo que los datos tomados de la cobertura actual corresponden a este período anterior."
          />
        ) : null}

        <Form.Group className="mb-2">
          <Form.Label>Motivo</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={guardando}
          />
        </Form.Group>
        <p className="mb-0">
          <strong>{incluidos.length}</strong> cobro{incluidos.length === 1 ? "" : "s"} incluido
          {incluidos.length === 1 ? "" : "s"} en esta confirmación.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => void guardar()} disabled={guardando || cargando || !confirmacion.ok}>
          {guardando ? "Guardando…" : "Confirmar regeneración"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RegenerarCobrosModal;
