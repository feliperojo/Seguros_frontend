import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import apiRequest from "../services/api";
import {
  MODALIDAD_SOLO_COBERTURA,
  prepararConfirmacionRegeneracion,
} from "../utils/regenerarCobros";

const RegenerarCobrosModal = ({ show, pagoIds, periodo, onCancel, onGuardado }) => {
  const [incluidos, setIncluidos] = useState([]);
  const [preview, setPreview] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const guardandoRef = useRef(false);
  const idsKey = (pagoIds || []).join(",");
  const incluidosKey = incluidos.join(",");

  useEffect(() => {
    if (!show) return;
    setIncluidos(pagoIds || []);
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

  const confirmacion = useMemo(
    () =>
      prepararConfirmacionRegeneracion({
        incluidos,
        preview,
        modalidad: MODALIDAD_SOLO_COBERTURA,
        motivo: "Regeneración de datos de cobertura confirmada desde Generación de pagos.",
        confirmarDatosActuales: Boolean(preview?.requiere_confirmacion_datos_actuales),
      }),
    [incluidos, preview]
  );

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
    <Modal show={show} onHide={onCancel} size="lg" centered backdrop={guardando ? "static" : true}>
      <Modal.Header closeButton={!guardando}>
        <Modal.Title>Regenerar cobros</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          {periodo ? `${periodo}. ` : ""}
          Se actualizarán los datos de cobertura de {incluidos.length} cobro{incluidos.length === 1 ? "" : "s"}. El monto, el estado y la fecha de pago se conservarán.
        </p>
        {error ? <Alert variant="warning">{error}</Alert> : null}
        {cargando ? (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" role="status" />
            Preparando la regeneración…
          </div>
        ) : null}
        {!cargando && incluidos.length === 0 ? (
          <Alert variant="info">No hay cobros incluidos.</Alert>
        ) : null}

        {preview?.requiere_confirmacion_datos_actuales ? (
          <Alert variant="info">
            Al aceptar, confirmas que los datos de la cobertura actual corresponden al período anterior seleccionado.
          </Alert>
        ) : null}
        {!cargando && preview && !confirmacion.ok ? (
          <Alert variant="warning">{confirmacion.errores.join(" ")}</Alert>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => void guardar()} disabled={guardando || cargando || !confirmacion.ok}>
          {guardando ? "Guardando…" : "Aceptar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RegenerarCobrosModal;
