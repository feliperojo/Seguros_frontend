/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { etiquetaMes } from "../utils/periodoCobros";
import { condicionCobro, TEXTO_PENDIENTE_COBRO } from "../utils/condicionCobro";

const textoActual = (pago, campo) => condicionCobro(pago, campo).texto;

const CorregirCobroModal = ({ show, pago, companias, guardando, error, onCancel, onGuardar }) => {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!pago) {
      setForm(null);
      return;
    }
    const snap = pago.cobertura_snapshot || {};
    setForm({
      compania_id: snap.compania_id ? String(snap.compania_id) : "",
      plan: snap.plan || "",
      codigo_poliza: snap.codigo_poliza || "",
      metal: snap.metal || "",
      red: snap.red || "",
      tipo_pago: snap.tipo_pago || "",
      pagador_id: snap.pagador_id ? String(snap.pagador_id) : "",
      pagador_nombre: snap.pagador_nombre || "",
      grupo_familiar_id: pago.grupo_familiar_id ? String(pago.grupo_familiar_id) : "",
      monto: pago.monto != null ? Number(pago.monto).toFixed(2) : "",
      motivo: "",
    });
  }, [pago]);

  if (!pago || !form) return null;

  const periodo = pago.anio_generado && pago.mes_generado
    ? `${etiquetaMes(pago.mes_generado)} ${pago.anio_generado}`
    : "Período no asignado";
  const importeBloqueado = pago.estado === "pagado" || pago.estado === "procesando";
  const opciones = Array.isArray(companias) ? [...companias] : [];
  const snap = pago.cobertura_snapshot || {};
  if (snap.compania_id && !opciones.some((c) => Number(c.id) === Number(snap.compania_id))) {
    opciones.push({
      id: snap.compania_id,
      nombre: snap.compania_nombre || `Compañía ${snap.compania_id}`,
    });
  }

  const cambiar = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const guardar = () => {
    const payload = { motivo: form.motivo.trim() };
    if (String(form.compania_id || "") !== String(snap.compania_id || "")) {
      payload.compania_id = form.compania_id ? Number(form.compania_id) : null;
    }
    if (form.plan !== (snap.plan || "")) payload.plan = form.plan;
    if (form.codigo_poliza !== (snap.codigo_poliza || "")) payload.codigo_poliza = form.codigo_poliza;
    if (form.metal !== (snap.metal || "")) payload.metal = form.metal;
    if (form.red !== (snap.red || "")) payload.red = form.red;
    if (form.tipo_pago !== (snap.tipo_pago || "")) payload.tipo_pago = form.tipo_pago;
    if (form.pagador_nombre !== (snap.pagador_nombre || "")) {
      payload.pagador_id = null;
      payload.pagador_nombre = form.pagador_nombre;
    }
    if (String(form.grupo_familiar_id || "") !== String(pago.grupo_familiar_id || "")) {
      payload.grupo_familiar_id = form.grupo_familiar_id ? Number(form.grupo_familiar_id) : null;
    }
    if (!importeBloqueado && Number(form.monto).toFixed(2) !== Number(pago.monto || 0).toFixed(2)) {
      payload.monto = Number(form.monto);
    }
    onGuardar(payload);
  };

  return (
    <Modal show={show} onHide={onCancel} centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Corregir datos del cobro</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error ? <Alert variant="warning">{error}</Alert> : null}
        <p>
          Período: <strong>{periodo}</strong>
          {pago.fecha_pago ? ` · fecha de pago ${pago.fecha_pago}` : ""}
        </p>
        <p className="small text-muted">
          Valores actuales: compañía {textoActual(pago, "compania_nombre")}, plan {textoActual(pago, "plan")},
          pagador {textoActual(pago, "pagador_nombre")}, importe ${Number(pago.monto || 0).toFixed(2)}.
          {textoActual(pago, "compania_nombre") === TEXTO_PENDIENTE_COBRO
            ? " Este cobro todavía no tiene copia histórica."
            : ""}
        </p>
        <Form.Group className="mb-2">
          <Form.Label>Compañía</Form.Label>
          <Form.Select value={form.compania_id} onChange={(e) => cambiar("compania_id", e.target.value)}>
            <option value="">Sin compañía confirmada</option>
            {opciones.map((compania) => (
              <option key={compania.id} value={compania.id}>
                {compania.nombre}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Plan</Form.Label>
          <Form.Control value={form.plan} onChange={(e) => cambiar("plan", e.target.value)} />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Código de póliza</Form.Label>
          <Form.Control value={form.codigo_poliza} onChange={(e) => cambiar("codigo_poliza", e.target.value)} />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Pagador</Form.Label>
          <Form.Control
            value={form.pagador_nombre}
            onChange={(e) => cambiar("pagador_nombre", e.target.value)}
            placeholder={TEXTO_PENDIENTE_COBRO}
          />
          <Form.Text>Si cambia el nombre, el cobro deja de apuntar al pagador anterior.</Form.Text>
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Tipo de pago</Form.Label>
          <Form.Control value={form.tipo_pago} onChange={(e) => cambiar("tipo_pago", e.target.value)} />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>ID de grupo familiar</Form.Label>
          <Form.Control
            value={form.grupo_familiar_id}
            onChange={(e) => cambiar("grupo_familiar_id", e.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Importe</Form.Label>
          <Form.Control
            type="number"
            min="0.01"
            step="0.01"
            value={form.monto}
            onChange={(e) => cambiar("monto", e.target.value)}
            disabled={importeBloqueado}
          />
          {importeBloqueado ? (
            <Form.Text>
              Este cobro está {pago.estado}. No hay un registro de abonos para cambiar el importe sin
              afectar el pago ya registrado, así que el importe queda bloqueado. El estado y el historial
              de pago se conservan.
            </Form.Text>
          ) : null}
        </Form.Group>
        <Form.Group>
          <Form.Label>Motivo de la corrección</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={form.motivo}
            onChange={(e) => cambiar("motivo", e.target.value)}
            required
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={guardar}
          disabled={guardando || form.motivo.trim().length < 5}
        >
          {guardando ? "Guardando…" : "Guardar corrección"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CorregirCobroModal;
