/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Form, Modal, Table } from "react-bootstrap";

const valorBorrador = (borradores, item, campo) => {
  const propio = borradores[item.cobertura_id];
  if (propio && Object.prototype.hasOwnProperty.call(propio, campo)) {
    return propio[campo];
  }
  return item.propuesto?.[campo] ?? "";
};

const VistaPreviaCobrosModal = ({
  show,
  vista,
  companias,
  error,
  generando,
  onCancel,
  onActualizar,
  onConfirmar,
}) => {
  const [borradores, setBorradores] = useState({});
  const [confirmoPeriodo, setConfirmoPeriodo] = useState(false);

  useEffect(() => {
    setBorradores({});
    setConfirmoPeriodo(false);
  }, [vista?.huella]);

  const items = Array.isArray(vista?.items) ? vista.items : [];
  const hayInconsistencias = items.some((item) => !item.elegible);
  const requiereConfirmacion = Boolean(vista?.requiere_confirmacion_periodo);
  const puedeGenerar = Boolean(vista) && !hayInconsistencias && (!requiereConfirmacion || confirmoPeriodo);

  const actualizar = (coberturaId, campo, valor) => {
    setBorradores((prev) => ({
      ...prev,
      [coberturaId]: {
        ...(prev[coberturaId] || {}),
        [campo]: valor,
      },
    }));
  };

  const confirmar = () => {
    const ajustes = items
      .filter((item) => item.elegible && !item.ya_existe)
      .map((item) => {
        const ajuste = { cobertura_id: item.cobertura_id };
        const companiaId = Number(valorBorrador(borradores, item, "compania_id"));
        const plan = String(valorBorrador(borradores, item, "plan") ?? "");
        const codigo = String(valorBorrador(borradores, item, "codigo_poliza") ?? "");
        const monto = valorBorrador(borradores, item, "monto");
        const pagadorModo = valorBorrador(borradores, item, "pagador_modo");
        let cambio = false;

        if (companiaId && companiaId !== Number(item.propuesto?.compania_id)) {
          ajuste.compania_id = companiaId;
          cambio = true;
        }
        if (plan !== String(item.propuesto?.plan ?? "")) {
          ajuste.plan = plan;
          cambio = true;
        }
        if (codigo !== String(item.propuesto?.codigo_poliza ?? "")) {
          ajuste.codigo_poliza = codigo;
          cambio = true;
        }
        if (Number(monto).toFixed(2) !== Number(item.propuesto?.monto || 0).toFixed(2)) {
          ajuste.monto = Number(monto);
          cambio = true;
        }
        if (pagadorModo === "otro") {
          ajuste.pagador_id = null;
          ajuste.pagador_nombre = String(valorBorrador(borradores, item, "pagador_nombre") ?? "");
          cambio = true;
        } else if (pagadorModo && Number(pagadorModo) !== Number(item.propuesto?.pagador_id)) {
          ajuste.pagador_id = Number(pagadorModo);
          cambio = true;
        }

        return cambio ? ajuste : null;
      })
      .filter(Boolean);

    onConfirmar({
      ajustes,
      confirmarDatosPeriodo: confirmoPeriodo,
    });
  };

  return (
    <Modal show={show} onHide={onCancel} size="xl" scrollable centered>
      <Modal.Header closeButton>
        <Modal.Title>Revisar cobros de {vista?.periodo || "el período"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error ? <Alert variant="warning">{error}</Alert> : null}
        <p>
          Estos datos se guardan solo en los cobros nuevos al confirmar. Cancelar no modifica la
          cobertura, el grupo familiar ni otros períodos.
        </p>
        {vista?.es_anterior ? (
          <p>
            El período seleccionado es anterior al mes en curso. Los cobros que ya existen se
            conservan.
          </p>
        ) : null}
        {hayInconsistencias ? (
          <Alert variant="danger">
            Hay coberturas que no se pueden generar. No se creará ningún cobro hasta corregirlas en
            la cobertura.
          </Alert>
        ) : null}
        <div className="table-responsive">
          <Table bordered hover size="sm" className="align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Cliente / cobertura</th>
                <th>Compañía</th>
                <th>Plan</th>
                <th>Pagador</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const editable = item.elegible && !item.ya_existe;
                const opcionesCompania = Array.isArray(companias) ? [...companias] : [];
                if (
                  item.propuesto?.compania_id &&
                  !opcionesCompania.some((c) => Number(c.id) === Number(item.propuesto.compania_id))
                ) {
                  opcionesCompania.push({
                    id: item.propuesto.compania_id,
                    nombre: item.propuesto.compania_nombre || `Compañía ${item.propuesto.compania_id}`,
                  });
                }
                const opcionesPagador = Array.isArray(item.opciones_pagador) ? item.opciones_pagador : [];
                const pagadorModo =
                  valorBorrador(borradores, item, "pagador_modo") ||
                  (item.propuesto?.pagador_id ? String(item.propuesto.pagador_id) : "otro");
                const desdeActual = Array.isArray(item.campos_desde_cobertura_actual)
                  ? item.campos_desde_cobertura_actual
                  : [];

                return (
                  <tr key={item.cobertura_id}>
                    <td>
                      <div className="fw-semibold">{item.cliente_nombre || "Sin cliente"}</div>
                      <div className="text-muted small">
                        Cobertura {item.cobertura_id}
                        {item.codigo_poliza ? ` · ${item.codigo_poliza}` : ""}
                      </div>
                      <Badge bg={item.origen === "historial_plan" ? "info" : "secondary"} className="mt-1">
                        {item.origen_texto}
                      </Badge>
                      {item.ya_existe ? (
                        <div className="small mt-1">Ya existe. Este cobro se conservará.</div>
                      ) : null}
                      {!item.elegible ? (
                        <div className="small text-danger mt-1">{(item.motivos || []).join(" ")}</div>
                      ) : null}
                      {item.propuesto?.composicion ? (
                        <div className="small text-muted mt-1">
                          Parentesco: {item.propuesto.composicion.parentesco || "—"}.{" "}
                          {item.propuesto.composicion.nota}
                          {desdeActual.includes("parentesco") ? " Datos tomados de la cobertura actual." : ""}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {editable ? (
                        <Form.Select
                          value={valorBorrador(borradores, item, "compania_id") || ""}
                          onChange={(e) => actualizar(item.cobertura_id, "compania_id", e.target.value)}
                          aria-label={`Compañía del cobro ${item.cobertura_id}`}
                        >
                          <option value="">Seleccionar</option>
                          {opcionesCompania.map((compania) => (
                            <option key={compania.id} value={compania.id}>
                              {compania.nombre}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        item.propuesto?.compania_nombre || "—"
                      )}
                      {desdeActual.includes("compania_nombre") ? (
                        <div className="small text-muted">Datos tomados de la cobertura actual</div>
                      ) : null}
                    </td>
                    <td>
                      {editable ? (
                        <Form.Control
                          value={valorBorrador(borradores, item, "plan") || ""}
                          onChange={(e) => actualizar(item.cobertura_id, "plan", e.target.value)}
                          aria-label={`Plan del cobro ${item.cobertura_id}`}
                        />
                      ) : (
                        item.propuesto?.plan || "—"
                      )}
                      {editable ? (
                        <Form.Control
                          className="mt-1"
                          value={valorBorrador(borradores, item, "codigo_poliza") || ""}
                          onChange={(e) => actualizar(item.cobertura_id, "codigo_poliza", e.target.value)}
                          aria-label={`Código de póliza del cobro ${item.cobertura_id}`}
                          placeholder="Código de póliza"
                        />
                      ) : null}
                    </td>
                    <td>
                      {editable ? (
                        <>
                          <Form.Select
                            value={pagadorModo}
                            onChange={(e) => actualizar(item.cobertura_id, "pagador_modo", e.target.value)}
                            aria-label={`Pagador del cobro ${item.cobertura_id}`}
                          >
                            {opcionesPagador.map((opcion) => (
                              <option key={opcion.id} value={opcion.id}>
                                {opcion.nombre}
                              </option>
                            ))}
                            <option value="otro">Otro nombre, solo en este cobro</option>
                          </Form.Select>
                          {pagadorModo === "otro" ? (
                            <Form.Control
                              className="mt-1"
                              value={valorBorrador(borradores, item, "pagador_nombre") || ""}
                              onChange={(e) =>
                                actualizar(item.cobertura_id, "pagador_nombre", e.target.value)
                              }
                              aria-label={`Nombre del pagador del cobro ${item.cobertura_id}`}
                            />
                          ) : null}
                        </>
                      ) : (
                        item.propuesto?.pagador_nombre || "—"
                      )}
                      {desdeActual.includes("pagador_nombre") ? (
                        <div className="small text-muted">Datos tomados de la cobertura actual</div>
                      ) : null}
                    </td>
                    <td style={{ minWidth: 110 }}>
                      {editable ? (
                        <Form.Control
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={valorBorrador(borradores, item, "monto")}
                          onChange={(e) => actualizar(item.cobertura_id, "monto", e.target.value)}
                          aria-label={`Importe del cobro ${item.cobertura_id}`}
                        />
                      ) : (
                        `$${Number(item.propuesto?.monto || 0).toFixed(2)}`
                      )}
                      <div className="small text-muted">{item.propuesto?.detalle_calculo}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        {requiereConfirmacion ? (
          <Form.Check
            className="mt-3"
            checked={confirmoPeriodo}
            onChange={(e) => setConfirmoPeriodo(e.target.checked)}
            label={`Confirmo que los datos revisados corresponden a ${vista?.periodo}. Los que no salen de un historial de plan con vigencia se tomaron de la cobertura actual y no están históricamente confirmados.`}
          />
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={generando}>
          Cancelar
        </Button>
        <Button variant="outline-primary" onClick={onActualizar} disabled={generando}>
          Actualizar vista previa
        </Button>
        <Button className="pagos-mensuales__btn-primary" onClick={confirmar} disabled={!puedeGenerar || generando}>
          {generando ? "Generando…" : "Generar cobros"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default VistaPreviaCobrosModal;
