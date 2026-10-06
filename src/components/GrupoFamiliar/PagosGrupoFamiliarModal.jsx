import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Form, Modal, OverlayTrigger, Popover, Spinner, Table } from "react-bootstrap";
import apiRequest from "../../services/api";
import { fetchPagosGrupoFamiliar } from "../../services/coberturaPagosApi";
import {
  detalleSnapshotCobro,
  ESTADOS_COBRO_EDITABLES,
  filasPagosGrupo,
  mesesParaSituacion,
  prepararGuardadoCobro,
  prepararGuardadoProyeccion,
} from "../../utils/pagosGrupoFamiliarConsulta";
import {
  indicadorMorosidadPagosPorMes,
  PAGOS_INFORME_MONTH_ABBR,
} from "../../utils/pagosMorosidad";
import { formatDateForDisplay } from "../../utils/formatters";
import "../../styles/GfModal.css";
import "../../styles/PagosInforme.css";
import "../../styles/PagosGrupoFamiliarModal.css";

const MENSAJE_SIN_COBROS = "Sin cobros generados";

const getEstadoCeldaClass = (estado) => {
  const key = String(estado ?? "").toLowerCase();
  if (key === "pagado") return "pagos-informe__estado--pagado";
  if (key === "procesando") return "pagos-informe__estado--procesando";
  if (key === "cancelado") return "pagos-informe__estado--cancelado";
  return "pagos-informe__estado--pendiente";
};

const renderSituacion = (meses) => {
  const ind = indicadorMorosidadPagosPorMes(mesesParaSituacion(meses));
  if (!ind || ind.nivel === "sin_datos" || ind.nivel === "sin_generacion") {
    return (
      <span className="text-muted small" title={ind?.titulo}>
        —
      </span>
    );
  }
  return (
    <span className={`pagos-informe__situacion pagos-informe__situacion--${ind.nivel === "al_dia" ? "al-dia" : ind.nivel}`} title={ind.titulo}>
      {ind.etiqueta}
    </span>
  );
};

const popoverDetalle = (titulo, nota, campos) => (
  <Popover>
    <Popover.Header as="h3">{titulo}</Popover.Header>
    <Popover.Body>
      {nota ? <p className="mb-2">{nota}</p> : null}
      {campos.length > 0 ? (
        <dl className="pagos-grupo-modal__snapshot mb-0">
          {campos.map((campo) => (
            <div key={campo.etiqueta}>
              <dt>{campo.etiqueta}</dt>
              <dd>{campo.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Popover.Body>
  </Popover>
);

const MontoConDetalle = ({ etiqueta, overlay, children }) => (
  <OverlayTrigger
    trigger={["hover", "focus", "click"]}
    rootClose
    placement="auto"
    container={typeof document !== "undefined" ? document.body : undefined}
    overlay={overlay}
  >
    <button type="button" className="pagos-grupo-modal__monto-btn" aria-label={etiqueta}>
      {children}
    </button>
  </OverlayTrigger>
);

const EditarCobroDialogo = ({ cobro, guardando, error, onCancel, onGuardar }) => {
  const [estado, setEstado] = useState(cobro?.estado || "pendiente");
  const [monto, setMonto] = useState(cobro?.monto != null ? Number(cobro.monto).toFixed(2) : "");
  const [motivo, setMotivo] = useState("");
  const esProyeccion = Boolean(cobro?.proyeccion);
  const opciones = ESTADOS_COBRO_EDITABLES.includes(cobro?.estado)
    ? ESTADOS_COBRO_EDITABLES
    : [cobro?.estado, ...ESTADOS_COBRO_EDITABLES].filter(Boolean);

  useEffect(() => {
    if (!cobro) return;
    setEstado(cobro.estado || "pendiente");
    setMonto(cobro.monto != null ? Number(cobro.monto).toFixed(2) : "");
    setMotivo("");
  }, [cobro]);

  if (!cobro) return null;

  return (
    <Modal show onHide={onCancel} centered style={{ zIndex: 1080 }} backdropClassName="pagos-grupo-modal__editar-backdrop">
      <Modal.Header closeButton>
        <Modal.Title>
          {esProyeccion ? `Editar ${cobro.etiqueta || "mes"}` : `Editar cobro ${cobro.id}`}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error ? <Alert variant="warning">{error}</Alert> : null}
        <Form.Group className="mb-3">
          <Form.Label>Estado</Form.Label>
          <Form.Select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            aria-label={`Estado del cobro ${cobro.id}`}
          >
            {opciones.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Monto</Form.Label>
          <Form.Control
            type="number"
            min="0.01"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            disabled={guardando}
            aria-label={esProyeccion ? `Monto de ${cobro.etiqueta || "este mes"}` : `Monto del cobro ${cobro.id}`}
          />
          <Form.Text>
            {esProyeccion
              ? "Este mes todavía no tiene cobro. Al guardar se registra solo este mes, con el importe indicado."
              : "Puede corregir el importe en cualquier estado. El motivo es necesario si cambia el importe."}
          </Form.Text>
        </Form.Group>
        <Form.Group>
          <Form.Label>Motivo de la corrección</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={guardando}
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={guardando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => onGuardar({ estado, monto, motivo })} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

const PagosGrupoFamiliarModal = ({ show, onHide, grupoFamiliarId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [consulta, setConsulta] = useState(null);
  const [anioTexto, setAnioTexto] = useState("");
  const [anioConsulta, setAnioConsulta] = useState(null);
  const [cobroEdicion, setCobroEdicion] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState("");
  const guardandoRef = useRef(false);

  useEffect(() => {
    if (show) return;
    setLoading(false);
    setError("");
    setConsulta(null);
    setAnioTexto("");
    setAnioConsulta(null);
    setCobroEdicion(null);
    setGuardandoEdicion(false);
    setErrorEdicion("");
    guardandoRef.current = false;
  }, [show]);

  useEffect(() => {
    if (!show || !grupoFamiliarId) return undefined;

    let cancel = false;
    const cargar = async () => {
      setLoading(true);
      setError("");
      setConsulta(null);
      try {
        const data = await fetchPagosGrupoFamiliar(
          grupoFamiliarId,
          anioConsulta ?? undefined
        );
        if (cancel) return;
        setConsulta(data);
        if (anioConsulta == null && data?.anio != null) {
          setAnioTexto(String(data.anio));
        }
      } catch (err) {
        if (cancel) return;
        setConsulta(null);
        setError(err?.message || "No se pudieron consultar los pagos del grupo.");
      } finally {
        if (!cancel) setLoading(false);
      }
    };

    cargar();
    return () => {
      cancel = true;
    };
  }, [show, grupoFamiliarId, anioConsulta]);

  const filas = useMemo(
    () => filasPagosGrupo(consulta?.coberturas),
    [consulta]
  );
  const tieneCobros = Boolean(consulta?.tiene_cobros);

  const cerrarEdicion = () => {
    if (guardandoRef.current) return;
    setCobroEdicion(null);
    setErrorEdicion("");
  };

  const guardarEdicion = async ({ estado, monto, motivo }) => {
    if (!cobroEdicion || guardandoRef.current) return;
    const preparado = cobroEdicion.proyeccion
      ? prepararGuardadoProyeccion({
          grupoFamiliarId,
          coberturaId: cobroEdicion.coberturaId,
          anio: cobroEdicion.anio,
          mes: cobroEdicion.mes,
          estado,
          monto,
          motivo,
        })
      : prepararGuardadoCobro({
          cobro: cobroEdicion,
          estado,
          monto,
          motivo,
        });
    if (!preparado.ok) {
      setErrorEdicion(preparado.errores.join(" "));
      return;
    }
    if (preparado.acciones.length === 0) {
      cerrarEdicion();
      return;
    }

    guardandoRef.current = true;
    setGuardandoEdicion(true);
    setErrorEdicion("");
    try {
      for (const accion of preparado.acciones) {
        await apiRequest(accion.path, accion.method, accion.body);
      }
      const data = await fetchPagosGrupoFamiliar(
        grupoFamiliarId,
        anioConsulta ?? undefined
      );
      setConsulta(data);
      setCobroEdicion(null);
    } catch (err) {
      setErrorEdicion(err?.message || "No se pudo guardar el cobro.");
      try {
        const data = await fetchPagosGrupoFamiliar(
          grupoFamiliarId,
          anioConsulta ?? undefined
        );
        setConsulta(data);
      } catch {
        /* conserva la consulta anterior si la recarga también falla */
      }
    } finally {
      guardandoRef.current = false;
      setGuardandoEdicion(false);
    }
  };

  if (!show) return null;

  const cambiarAnio = (value) => {
    setAnioTexto(value);
    if (!/^\d{4}$/.test(value)) return;
    const anio = Number(value);
    if (anio >= 1900 && anio <= 2100) setAnioConsulta(anio);
  };

  return (
    <div
      className="modal fade show gf-modal"
      style={{ display: "block" }}
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pagos-grupo-titulo"
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable gf-modal pagos-grupo-modal"
        role="document"
      >
        <div className="modal-content gf-modal__content">
          <div className="modal-header gf-modal__header">
            <h5 className="modal-title gf-modal__title" id="pagos-grupo-titulo">
              Pagos del grupo familiar
            </h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar"
              onClick={onHide}
            />
          </div>

          <div className="modal-body gf-modal__body pagos-informe">
            <div className="pagos-grupo-modal__toolbar">
              <p className="mb-0 text-muted small">
                Cobros generados del grupo. Los meses sin cobro generado se muestran con —.
              </p>
              <Form.Group className="pagos-grupo-modal__anio mb-0">
                <Form.Label className="gf-detalle__label mb-1">Año</Form.Label>
                <Form.Control
                  type="number"
                  min="1900"
                  max="2100"
                  value={anioTexto}
                  onChange={(e) => cambiarAnio(e.target.value)}
                  aria-label="Año de los pagos"
                />
              </Form.Group>
            </div>

            {loading && (
              <div className="pagos-informe__loading" role="status">
                <Spinner animation="border" />
                <div>Cargando pagos…</div>
              </div>
            )}

            {!loading && error && (
              <Alert variant="danger" className="pagos-informe__alert mb-0">
                {error}
              </Alert>
            )}

            {!loading && !error && consulta && !tieneCobros && (
              <div className="pagos-grupo-modal__aviso" role="status">
                {MENSAJE_SIN_COBROS}
              </div>
            )}

            {!loading && !error && consulta && filas.length > 0 && (
              <>
                <div className="pagos-informe__leyenda" aria-hidden="true">
                  <span className="pagos-informe__leyenda-item">
                    <span className="pagos-informe__leyenda-dot pagos-informe__leyenda-dot--pendiente" />
                    Pendiente
                  </span>
                  <span className="pagos-informe__leyenda-item">
                    <span className="pagos-informe__leyenda-dot pagos-informe__leyenda-dot--procesando" />
                    Procesando
                  </span>
                  <span className="pagos-informe__leyenda-item">
                    <span className="pagos-informe__leyenda-dot pagos-informe__leyenda-dot--pagado" />
                    Pagado
                  </span>

                </div>

                <div className="pagos-informe__table-scroll">
                  <Table hover className="pagos-grupo-modal__table mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Miembro</th>
                        <th>Cobertura</th>
                        <th>Compañía</th>
                        <th>Fecha de activación</th>
                        <th
                          className="text-nowrap"
                          title="Mora: 1–2 meses con cobro distinto de pagado. Riesgo: 3 o más. Solo se consideran cobros generados."
                        >
                          Situación
                        </th>
                        {PAGOS_INFORME_MONTH_ABBR.map((mes) => (
                          <th key={mes} className="pagos-informe__col-mes-header">
                            {mes}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((fila) => (
                        <tr key={fila.id}>
                          <td>{fila.miembro}</td>
                          <td>
                            <div className="pagos-grupo-modal__cobertura">{fila.cobertura}</div>
                            {fila.codigo ? (
                              <div className="pagos-grupo-modal__codigo">{fila.codigo}</div>
                            ) : null}
                          </td>
                          <td>{fila.compania || "—"}</td>
                          <td>
                            {fila.fechaActivacion
                              ? formatDateForDisplay(fila.fechaActivacion)
                              : "—"}
                          </td>
                          <td className="text-center">{renderSituacion(fila.meses)}</td>
                          {fila.meses.map((celda, idx) => (
                            <td key={idx} className="pagos-informe__col-mes">
                              {celda?.tipo === "cobro" ? (
                                <div className="pagos-grupo-modal__cobros">
                                  {celda.cobros.map((cobro) => {
                                    const detalle = detalleSnapshotCobro(cobro);
                                    return (
                                      <div key={cobro.id} className="pagos-informe__celda">
                                        <span className={`pagos-informe__estado ${getEstadoCeldaClass(cobro.estado)}`}>
                                          {cobro.estado}
                                        </span>
                                        <MontoConDetalle
                                          etiqueta={`Snapshot del cobro ${cobro.id}, monto ${Number(cobro.monto).toFixed(2)}`}
                                          overlay={popoverDetalle(detalle.titulo, detalle.nota, detalle.campos)}
                                        >
                                          <span className="pagos-informe__monto">
                                            ${Number(cobro.monto).toFixed(2)}
                                          </span>
                                        </MontoConDetalle>
                                        <button
                                          type="button"
                                          className="pagos-grupo-modal__editar"
                                          onClick={() => {
                                            setErrorEdicion("");
                                            setCobroEdicion(cobro);
                                          }}
                                        >
                                          Editar
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="pagos-informe__celda-vacia">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {cobroEdicion ? (
        <EditarCobroDialogo
          cobro={cobroEdicion}
          guardando={guardandoEdicion}
          error={errorEdicion}
          onCancel={cerrarEdicion}
          onGuardar={guardarEdicion}
        />
      ) : null}
    </div>
  );
};

export default PagosGrupoFamiliarModal;
