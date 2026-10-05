import { useEffect, useMemo, useState } from "react";
import { Alert, Form, Spinner, Table } from "react-bootstrap";
import { fetchPagosGrupoFamiliar } from "../../services/coberturaPagosApi";
import { condicionCobro, TEXTO_PENDIENTE_COBRO } from "../../utils/condicionCobro";
import {
  indicadorMorosidadPagosPorMes,
  PAGOS_INFORME_MONTH_ABBR,
  pickEstadoFechaActualizacionPago,
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
  const porMes = (meses || []).map((celda) =>
    celda?.tipo === "cobro" ? { estado: celda.estado, monto: celda.monto } : null
  );
  const ind = indicadorMorosidadPagosPorMes(porMes);
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

const asegurarFila = (filas, key, base) => {
  if (!filas.has(key)) {
    filas.set(key, {
      id: key,
      miembro: base.miembro || "—",
      cobertura: base.cobertura || "—",
      codigo: base.codigo || "",
      compania: base.compania || "—",
      companiaPendiente: Boolean(base.companiaPendiente),
      plan: base.plan || "",
      planPendiente: Boolean(base.planPendiente),
      meses: Array(12).fill(null),
    });
  }
  return filas.get(key);
};

/**
 * Misma clave del informe anual: cobertura + compañía + plan + código del cobro.
 * Los meses sin cobro usan la compañía, el plan y el código que propone el módulo.
 */
export function filasPagosGrupo(coberturas) {
  const filas = new Map();

  (coberturas || []).forEach((cob) => {
    const meses = Array.isArray(cob?.meses) ? cob.meses : [];

    meses.forEach((mes) => {
      const idx = parseInt(mes?.mes, 10) - 1;
      const pago = mes?.cobro;
      if (!pago || idx < 0 || idx > 11) return;

      const compania = condicionCobro(pago, "compania_nombre");
      const plan = condicionCobro(pago, "plan");
      const codigo = condicionCobro(pago, "codigo_poliza");
      const key = [cob.cobertura_id, compania.texto, plan.texto, codigo.texto].join("|");
      const fila = asegurarFila(filas, key, {
        miembro: cob.miembro,
        cobertura: cob.cobertura,
        codigo: codigo.pendiente ? "" : codigo.texto,
        compania: compania.texto,
        companiaPendiente: compania.pendiente,
        plan: plan.pendiente ? "" : plan.texto,
        planPendiente: plan.pendiente,
      });

      fila.meses[idx] = {
        tipo: "cobro",
        estado: pago.estado,
        monto: pago.monto,
        estadoActualizadoEn: pickEstadoFechaActualizacionPago(pago),
      };
    });

    meses.forEach((mes) => {
      const idx = parseInt(mes?.mes, 10) - 1;
      const proy = mes?.proyectado;
      if (mes?.cobro || !proy || idx < 0 || idx > 11) return;

      const companiaTexto = proy.compania_nombre || cob.compania || TEXTO_PENDIENTE_COBRO;
      const planTexto = proy.plan || cob.plan || TEXTO_PENDIENTE_COBRO;
      const codigoTexto = proy.codigo_poliza || cob.codigo_poliza || TEXTO_PENDIENTE_COBRO;
      const key = [cob.cobertura_id, companiaTexto, planTexto, codigoTexto].join("|");
      const fila = asegurarFila(filas, key, {
        miembro: cob.miembro,
        cobertura: cob.cobertura,
        codigo: codigoTexto === TEXTO_PENDIENTE_COBRO ? "" : codigoTexto,
        compania: companiaTexto,
        companiaPendiente: companiaTexto === TEXTO_PENDIENTE_COBRO,
        plan: planTexto === TEXTO_PENDIENTE_COBRO ? "" : planTexto,
        planPendiente: planTexto === TEXTO_PENDIENTE_COBRO,
      });

      if (!fila.meses[idx]) {
        fila.meses[idx] = {
          tipo: "proyectado",
          monto: proy.monto,
          origen: proy.origen,
        };
      }
    });
  });

  return [...filas.values()];
}

const PagosGrupoFamiliarModal = ({ show, onHide, grupoFamiliarId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [consulta, setConsulta] = useState(null);
  const [anioTexto, setAnioTexto] = useState("");
  const [anioConsulta, setAnioConsulta] = useState(null);

  useEffect(() => {
    if (show) return;
    setLoading(false);
    setError("");
    setConsulta(null);
    setAnioTexto("");
    setAnioConsulta(null);
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
                Coberturas elegibles del grupo. El monto proyectado no es un cobro generado.
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
                  <span className="pagos-informe__leyenda-item">
                    <span className="pagos-informe__leyenda-dot pagos-grupo-modal__leyenda-dot--proyectado" />
                    Proyectado
                  </span>
                </div>

                <div className="pagos-informe__table-scroll">
                  <Table hover className="pagos-grupo-modal__table mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Miembro</th>
                        <th>Cobertura</th>
                        <th>Compañía</th>
                        <th>Plan</th>
                        <th
                          className="text-nowrap"
                          title="Mora: 1–2 meses con cobro distinto de pagado. Riesgo: 3 o más. Los montos proyectados no cuentan."
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
                          <td className={fila.companiaPendiente ? "text-muted" : undefined}>
                            {fila.compania || "—"}
                          </td>
                          <td className={fila.planPendiente ? "text-muted" : undefined}>
                            {fila.plan || "—"}
                          </td>
                          <td className="text-center">{renderSituacion(fila.meses)}</td>
                          {fila.meses.map((celda, idx) => (
                            <td key={idx} className="pagos-informe__col-mes">
                              {celda?.tipo === "cobro" ? (
                                <div className="pagos-informe__celda">
                                  <span className={`pagos-informe__estado ${getEstadoCeldaClass(celda.estado)}`}>
                                    {celda.estado}
                                  </span>
                                  <span className="pagos-informe__monto">
                                    ${Number(celda.monto).toFixed(2)}
                                  </span>
                                  {celda.estadoActualizadoEn ? (
                                    <span
                                      className="pagos-informe__fecha-estado"
                                      title="Última actualización del estado"
                                    >
                                      {formatDateForDisplay(celda.estadoActualizadoEn)}
                                    </span>
                                  ) : null}
                                </div>
                              ) : celda?.tipo === "proyectado" ? (
                                <div
                                  className="pagos-grupo-modal__proyectado"
                                  title="Monto proyectado por el módulo de pagos. No es un cobro generado."
                                >
                                  <span className="pagos-grupo-modal__proyectado-etiqueta">Proyectado</span>
                                  <span className="pagos-informe__monto">
                                    ${Number(celda.monto).toFixed(2)}
                                  </span>
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
    </div>
  );
};

export default PagosGrupoFamiliarModal;
