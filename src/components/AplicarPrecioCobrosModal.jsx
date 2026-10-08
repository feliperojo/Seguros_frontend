/* eslint-disable react/prop-types */
import { useEffect, useId, useRef, useState } from "react";
import { Alert, Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import { formatMoney2 } from "../services/ingresos";
import { aplicarPrecioACobros, fetchRevisionAplicarPrecio } from "../services/coberturaPagosApi";
import { etiquetaMes } from "../utils/periodoCobros";
import {
  cobrosGenerados,
  filaElegible,
  idsPendientesElegibles,
  mensajeSinPagos,
  motivoValido,
  preciosDifieren,
  resumenSeleccion,
  MENSAJE_PRECIO_SIN_GUARDAR,
} from "../utils/aplicarPrecioCobros";

const textoImporte = (valor) => (valor == null || valor === "" ? "—" : `$${formatMoney2(valor)}`);

const AplicarPrecioCobrosModal = ({ solicitud, onCerrar }) => {
  const tituloId = useId();
  const secuencia = useRef(0);
  const enviando = useRef(false);
  const [carga, setCarga] = useState("idle");
  const [errorCarga, setErrorCarga] = useState("");
  const [revision, setRevision] = useState(null);
  const [mesDesde, setMesDesde] = useState("");
  const [seleccion, setSeleccion] = useState([]);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState("");
  const [resultado, setResultado] = useState("");
  const [errorRecarga, setErrorRecarga] = useState("");

  const cargar = async (actual, silenciosa = false) => {
    if (!solicitud) return null;
    if (!silenciosa) {
      setCarga("loading");
      setErrorCarga("");
      setRevision(null);
    }
    try {
      const data = await fetchRevisionAplicarPrecio({
        coberturaId: solicitud.coberturaId,
        grupoFamiliarId: solicitud.grupoFamiliarId,
        anio: solicitud.anio,
      });
      if (secuencia.current !== actual) return null;
      setRevision(data);
      setCarga(data?.filas?.length ? "ready" : "empty");
      setErrorCarga("");
      const meses = Array.isArray(data?.meses_desde) ? data.meses_desde : [];
      setMesDesde((prev) => (prev && meses.includes(prev) ? prev : meses[0] || ""));
      setSeleccion([]);
      return data;
    } catch (error) {
      if (secuencia.current !== actual) return null;
      if (!silenciosa) {
        setRevision(null);
        setCarga("error");
      }
      setErrorCarga(error?.message || "No se pudo cargar la revisión de cobros.");
      return null;
    }
  };

  useEffect(() => {
    const actual = secuencia.current + 1;
    secuencia.current = actual;
    setMesDesde("");
    setSeleccion([]);
    setMotivo("");
    setGuardando(false);
    setErrorGuardado("");
    setResultado("");
    setErrorRecarga("");
    setErrorCarga("");
    enviando.current = false;
    if (!solicitud) {
      setRevision(null);
      setCarga("idle");
      return undefined;
    }
    cargar(actual);
    return () => {
      secuencia.current += 1;
    };
    // cargar lee la solicitud de este render. El precio digitado no debe reabrir la revisión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitud?.token, solicitud?.coberturaId, solicitud?.grupoFamiliarId, solicitud?.anio]);

  if (!solicitud) return null;

  const filas = Array.isArray(revision?.filas) ? revision.filas : [];
  const cobros = cobrosGenerados(filas);
  const meses = Array.isArray(revision?.meses_desde) ? revision.meses_desde : [];
  const avisoSinPagos = revision
    ? mensajeSinPagos({ filas, meses, anio: revision.anio, mesDesde })
    : "";
  const sinPagosEnAlcance = avisoSinPagos !== "";
  const cobrosVisibles = cobros.filter((fila) => String(fila.mes || "") >= String(mesDesde || ""));
  const precioDistinto = revision
    ? preciosDifieren(solicitud.precioDigitado, revision.precio)
    : false;
  const resumen = resumenSeleccion(filas, seleccion);
  const puedeAplicar = Boolean(
    revision?.precio_aplicable
    && !precioDistinto
    && resumen.cantidad > 0
    && motivoValido(motivo)
    && !guardando
    && carga !== "loading"
  );

  const alternar = (fila) => {
    if (!filaElegible(fila, mesDesde) || guardando) return;
    setSeleccion((prev) => (
      prev.includes(fila.pago_id)
        ? prev.filter((id) => id !== fila.pago_id)
        : [...prev, fila.pago_id]
    ));
  };

  const cambiarMes = (mes) => {
    setMesDesde(mes);
    setSeleccion((prev) => prev.filter((id) => {
      const fila = filas.find((item) => item.pago_id === id);
      return filaElegible(fila, mes);
    }));
  };

  const aplicar = async () => {
    if (!puedeAplicar || enviando.current) return;
    enviando.current = true;
    setGuardando(true);
    setErrorGuardado("");
    setResultado("");
    setErrorRecarga("");
    const actual = secuencia.current;
    try {
      const respuesta = await aplicarPrecioACobros({
        cobertura_id: solicitud.coberturaId,
        grupo_familiar_id: solicitud.grupoFamiliarId,
        anio: revision.anio,
        mes_desde: mesDesde,
        pago_ids: seleccion,
        motivo: motivo.trim(),
        huella: revision.huella,
      });
      if (secuencia.current !== actual) return;
      setResultado(respuesta?.message || "Se aplicó el precio guardado.");
      setSeleccion([]);
      setMotivo("");
      try {
        const recarga = await cargar(actual, true);
        if (secuencia.current !== actual) return;
        if (!recarga) {
          setErrorRecarga("El precio se guardó, pero no se pudo recargar la revisión.");
        }
      } catch (error) {
        if (secuencia.current === actual) {
          setErrorRecarga(error?.message || "El precio se guardó, pero no se pudo recargar la revisión.");
        }
      }
    } catch (error) {
      if (secuencia.current !== actual) return;
      const mensaje = error?.message || "No se pudo aplicar el precio.";
      setErrorGuardado(mensaje);
      if (error?.response?.code === "REVISION_DESACTUALIZADA") {
        const recarga = await cargar(actual, true);
        if (!recarga && secuencia.current === actual) {
          setErrorRecarga("No se pudo actualizar la revisión.");
        }
      }
    } finally {
      if (secuencia.current === actual) {
        enviando.current = false;
        setGuardando(false);
      }
    }
  };

  const cerrar = () => {
    if (guardando) return;
    secuencia.current += 1;
    onCerrar?.();
  };

  return (
    <Modal
      show
      onHide={cerrar}
      centered
      scrollable
      size="lg"
      aria-labelledby={tituloId}
      backdrop={guardando ? "static" : true}
      keyboard={!guardando}
    >
      <Modal.Header closeButton={!guardando}>
        <Modal.Title id={tituloId}>Aplicar precio a cobros</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          <strong>{solicitud.persona || "Sin persona"}</strong>
          {" · "}
          {solicitud.cobertura || "Cobertura"} #{solicitud.coberturaId}
          {" · grupo "}
          {solicitud.grupoFamiliarId ?? "—"}
        </p>
        {carga === "loading" ? (
          <div className="d-flex align-items-center gap-2" role="status">
            <Spinner size="sm" animation="border" />
            Cargando cobros…
          </div>
        ) : null}
        {carga === "error" ? <Alert variant="danger">{errorCarga}</Alert> : null}
        {revision ? (
          <>
            <p className="mb-2">
              Año fiscal <strong>{revision.anio}</strong>
              {" · precio guardado "}
              <strong>{revision.precio == null ? "Sin precio" : textoImporte(revision.precio)}</strong>
            </p>
            {precioDistinto ? <Alert variant="warning">{MENSAJE_PRECIO_SIN_GUARDAR}</Alert> : null}
            {!revision.precio_aplicable && revision.motivo_precio ? (
              <Alert variant="warning">{revision.motivo_precio}</Alert>
            ) : null}
            {resultado ? <Alert variant="success">{resultado}</Alert> : null}
            {errorRecarga ? <Alert variant="warning">{errorRecarga}</Alert> : null}
            {errorGuardado ? <Alert variant="danger">{errorGuardado}</Alert> : null}
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                aplicar();
              }}
            >
              {cobros.length > 0 ? (
                <Form.Group className="mb-3" controlId={`${tituloId}-desde`}>
                  <Form.Label>Aplicar desde</Form.Label>
                  <Form.Select
                    value={mesDesde}
                    onChange={(event) => cambiarMes(event.target.value)}
                    disabled={guardando || meses.length === 0}
                  >
                    {meses.map((mes) => (
                      <option key={mes} value={mes}>
                        {etiquetaMes(mes)} {revision.anio}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              ) : null}
              {avisoSinPagos ? <Alert variant="secondary">{avisoSinPagos}</Alert> : null}
              {!sinPagosEnAlcance && cobrosVisibles.length > 0 ? (
                <div className="table-responsive mb-3">
                  <Table size="sm" bordered hover responsive>
                    <thead>
                      <tr>
                        <th scope="col">Seleccionar</th>
                        <th scope="col">Mes/período</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Importe actual</th>
                        <th scope="col">Nuevo importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cobrosVisibles.map((fila) => {
                        const elegible = filaElegible(fila, mesDesde);
                        return (
                          <tr key={fila.pago_id}>
                            <td>
                              <Form.Check
                                type="checkbox"
                                id={`${tituloId}-cobro-${fila.pago_id}`}
                                checked={seleccion.includes(fila.pago_id)}
                                disabled={!elegible || guardando || precioDistinto}
                                onChange={() => alternar(fila)}
                                aria-label={`Seleccionar cobro ${fila.pago_id}`}
                              />
                            </td>
                            <td>
                              {etiquetaMes(fila.mes) || "Período no válido"}
                              {fila.periodo ? ` · ${fila.periodo}` : ""}
                              {` · cobro ${fila.pago_id}`}
                            </td>
                            <td>{fila.estado || "—"}</td>
                            <td>{textoImporte(fila.monto)}</td>
                            <td>
                              {textoImporte(fila.nuevo_importe)}
                              {!elegible && fila.motivo ? (
                                <div className="small text-muted">{fila.motivo}</div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              ) : null}
              {!sinPagosEnAlcance ? (
                <>
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <Button
                      type="button"
                      variant="outline-secondary"
                      size="sm"
                      disabled={guardando || precioDistinto}
                      onClick={() => setSeleccion(idsPendientesElegibles(filas, mesDesde))}
                    >
                      Seleccionar pendientes elegibles
                    </Button>
                  </div>
                  <p className="mb-2">
                    <strong>{resumen.cantidad}</strong>
                    {resumen.cantidad === 1 ? " cobro seleccionado." : " cobros seleccionados."}
                  </p>
                  {resumen.cantidad > 0 ? (
                    <ul className="small">
                      {resumen.cambios.map((cambio) => (
                        <li key={cambio.pagoId}>
                          Cobro {cambio.pagoId}, {etiquetaMes(cambio.mes)}: {textoImporte(cambio.monto)} → {textoImporte(cambio.nuevo)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Form.Group className="mb-2" controlId={`${tituloId}-motivo`}>
                    <Form.Label>Motivo del ajuste</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={motivo}
                      onChange={(event) => setMotivo(event.target.value)}
                      required
                      minLength={5}
                      maxLength={500}
                      disabled={guardando}
                    />
                    <Form.Text>Mínimo 5 caracteres y máximo 500.</Form.Text>
                  </Form.Group>
                </>
              ) : null}
              <div className="d-flex justify-content-end gap-2">
                <Button type="button" variant="outline-secondary" onClick={cerrar} disabled={guardando}>
                  {sinPagosEnAlcance ? "Cerrar" : "Cancelar"}
                </Button>
                {!sinPagosEnAlcance ? (
                  <Button type="submit" variant="primary" disabled={!puedeAplicar}>
                    {guardando ? "Aplicando…" : "Aplicar"}
                  </Button>
                ) : null}
              </div>
            </Form>
          </>
        ) : null}
      </Modal.Body>
    </Modal>
  );
};

export default AplicarPrecioCobrosModal;
