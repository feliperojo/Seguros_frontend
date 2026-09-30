/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Form, Modal, Table } from "react-bootstrap";
import apiRequest from "../../services/api";

const ETIQUETAS = {
  pendiente_confirmacion: "Pendiente de confirmación",
  confirmado: "Confirmado",
  fallido: "Fallido",
  anulado: "Anulado",
  generando: "Generando",
  captura_automatica: "Captura automática",
  revision_habitual: "Revisión habitual",
  reconstruccion: "Reconstrucción histórica",
  correccion: "Corrección",
  foto: "Foto del corte",
  foto_con_observaciones: "Foto con observaciones",
  reconstruida: "Reconstruida",
  insuficiente: "Evidencia insuficiente",
  fallida: "Captura fallida",
};

const CRITERIOS = [
  {
    value: "solo_evidencia_previa",
    label: "Solo evidencia previa al corte",
    ayuda: "No usa el estado actual si la cobertura cambió después del 31 de diciembre.",
  },
  {
    value: "estado_previo_a_renovacion",
    label: "Estado previo a consolidar la renovación",
    ayuda: "Usa el snapshot de la renovación. No es una foto certificada del 31 de diciembre y no trata el cierre técnico como retiro.",
  },
  {
    value: "fecha_efectiva",
    label: "Fechas efectivas aunque se registraron después",
    ayuda: "Aplica la fecha de la baja o del alta aunque se haya grabado en enero. Queda marcado como reconstrucción, no como foto.",
  },
];

function texto(valor) {
  return ETIQUETAS[valor] || valor || "—";
}

function dia(valor) {
  if (!valor) return "—";
  return String(valor).slice(0, 10);
}

function mensajeError(error, respaldo) {
  const textoError = String(error?.message || "");
  if (/SQLSTATE|Undefined table|does not exist/i.test(textoError)) {
    return "No se pudo consultar los cierres fiscales. Falta aplicar la migración en esta base de datos.";
  }
  return textoError || respaldo;
}

function Indicador({ titulo, valor, nota }) {
  return (
    <div className="border rounded p-2 h-100">
      <div className="text-muted small">{titulo}</div>
      <div className="fs-5 fw-semibold">{valor}</div>
      {nota ? <div className="small text-muted mt-1">{nota}</div> : null}
    </div>
  );
}

export default function CierresFiscalesPanel({ anioInicial }) {
  const [lista, setLista] = useState([]);
  const [meta, setMeta] = useState({
    habilitado: false,
    puede_gestionar: false,
    anio_ventana: null,
    fecha_corte: null,
    hay_consolidacion: false,
  });
  const [anio, setAnio] = useState(anioInicial || new Date().getFullYear() - 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [clasificacion, setClasificacion] = useState("");
  const [motivo, setMotivo] = useState("");
  const [criterio, setCriterio] = useState("solo_evidencia_previa");
  const [accion, setAccion] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest(`/cierres-fiscales?anio=${anio}`, "GET");
      setLista(Array.isArray(response?.data) ? response.data : []);
      setMeta({
        habilitado: !!response?.habilitado,
        puede_gestionar: !!response?.puede_gestionar,
        anio_ventana: response?.anio_ventana ?? null,
        fecha_corte: response?.fecha_corte || `${anio}-12-31`,
        hay_consolidacion: !!response?.hay_consolidacion,
      });
    } catch (requestError) {
      setError(mensajeError(requestError, "No se pudo cargar el historial de cierres."));
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const delAnio = useMemo(
    () => lista.filter((cierre) => Number(cierre.anio) === Number(anio)),
    [lista, anio]
  );
  const confirmados = useMemo(
    () => lista.filter((cierre) => cierre.estado === "confirmado"),
    [lista]
  );
  const actual = useMemo(
    () => delAnio.find((cierre) => cierre.es_vigente) || delAnio.find((cierre) => cierre.estado === "pendiente_confirmacion") || null,
    [delAnio]
  );

  const abrir = async (id, filtro = "") => {
    setError("");
    setClasificacion(filtro);
    const query = filtro ? `?clasificacion=${encodeURIComponent(filtro)}&per_page=100` : "?per_page=100";
    try {
      const response = await apiRequest(`/cierres-fiscales/${id}${query}`, "GET");
      setDetalle(response);
    } catch (requestError) {
      setError(requestError?.message || "No se pudo abrir el informe.");
    }
  };

  const ejecutar = async (ruta, body) => {
    setAccion(ruta);
    setError("");
    try {
      await apiRequest(ruta, "POST", body);
      setMotivo("");
      await cargar();
      if (detalle?.data?.id && ruta.includes(String(detalle.data.id))) {
        await abrir(detalle.data.id, clasificacion);
      }
    } catch (requestError) {
      setError(requestError?.message || "No se pudo completar la acción.");
    } finally {
      setAccion("");
    }
  };

  const revisar = async () => {
    setAccion("revisar");
    setError("");
    try {
      const response = await apiRequest(`/cierres-fiscales/${anio}/revisar`, "POST");
      await cargar();
      if (response?.data?.id) {
        await abrir(response.data.id);
      }
    } catch (requestError) {
      setError(mensajeError(requestError, "No se pudo revisar el cierre."));
    } finally {
      setAccion("");
    }
  };

  const indicadores = detalle?.indicadores;
  const cierre = detalle?.data;
  const filas = detalle?.detalle?.data || [];
  const puede = meta.habilitado && meta.puede_gestionar;

  return (
    <div className="gf-listado__body">
      <div className="gf-listado__section">
        <p className="text-muted">
          El corte es el 31 de diciembre, inclusive, en America/Bogota. Los números salen del
          detalle guardado. Salud MS en Sí, No, Medicare y Medicaid se muestra aparte y no se
          suma como si todo fueran coberturas activas.
        </p>

        {!meta.habilitado && (
          <Alert variant="secondary">
            La función está deshabilitada. Los cierres guardados se conservan y la consolidación
            no exige un cierre confirmado. El interruptor está en la configuración del sistema
            (`cierres_fiscales_habilitado`) y arranca apagado.
          </Alert>
        )}
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="d-flex flex-wrap gap-3 align-items-end mb-3">
          <Form.Group>
            <Form.Label className="small mb-1">Año fiscal</Form.Label>
            <Form.Control
              type="number"
              min={2000}
              max={2100}
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
            />
          </Form.Group>
          <div>
            <div className="small text-muted mb-1">Fecha de corte</div>
            <div>{dia(meta.fecha_corte)} · America/Bogota</div>
          </div>
          <div>
            <div className="small text-muted mb-1">Estado del cierre</div>
            <div>{actual ? texto(actual.estado) : "Sin revisar"}</div>
          </div>
          {puede && (
            <Button size="sm" onClick={revisar} disabled={!!accion || meta.hay_consolidacion}>
              Revisar cierre {anio}
            </Button>
          )}
          {actual && (
            <Button size="sm" variant="outline-primary" onClick={() => abrir(actual.id)}>
              Ver informe
            </Button>
          )}
        </div>

        {meta.hay_consolidacion && (
          <Alert variant="warning">
            Ya hay renovaciones consolidadas o confirmadas de {anio} hacia {Number(anio) + 1}.
            El cierre habitual no puede generarse. Use la reconstrucción histórica.
          </Alert>
        )}

        {actual && (
          <p className="small text-muted">
            Corte {dia(actual.fecha_corte)}. Captura {actual.generado_en ? new Date(actual.generado_en).toLocaleString() : "—"}.
            Confirmación {actual.confirmado_en ? new Date(actual.confirmado_en).toLocaleString() : "pendiente"}.
          </p>
        )}

        {puede && (
          <details className="border rounded p-3 mb-3">
            <summary className="fw-semibold">Reconstrucción histórica</summary>
            <p className="small text-muted mt-2">
              Procedimiento excepcional, solo para usuarios autorizados. No forma parte del cierre habitual.
            </p>
            <Form.Group className="mb-2">
              <Form.Select value={criterio} onChange={(e) => setCriterio(e.target.value)}>
                {CRITERIOS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Form.Select>
              <Form.Text>{CRITERIOS.find((item) => item.value === criterio)?.ayuda}</Form.Text>
            </Form.Group>
            <Form.Control
              as="textarea"
              rows={2}
              placeholder="Motivo (obligatorio, mínimo 10 caracteres)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <div className="d-flex flex-wrap gap-2 mt-2">
              <Button
                size="sm"
                variant="outline-primary"
                disabled={motivo.trim().length < 10 || !!accion}
                onClick={() =>
                  ejecutar(`/cierres-fiscales/${anio}/reconstruir`, { motivo, criterio })
                }
              >
                Reconstruir {anio}
              </Button>
              {cierre?.estado === "confirmado" && (
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={motivo.trim().length < 10 || !!accion}
                  onClick={() =>
                    ejecutar(`/cierres-fiscales/${cierre.id}/corregir`, { motivo, criterio })
                  }
                >
                  Corregir la versión confirmada
                </Button>
              )}
            </div>
          </details>
        )}

        <h6 className="mt-3">Historial de cierres confirmados</h6>
        {loading ? (
          <p>Cargando historial…</p>
        ) : confirmados.length === 0 ? (
          <p className="text-muted">No hay cierres confirmados.</p>
        ) : (
          <Table hover responsive className="gf-listado__table">
            <thead>
              <tr>
                <th>Año</th>
                <th>Versión</th>
                <th>Estado</th>
                <th>Origen</th>
                <th>Integridad</th>
                <th>Generado</th>
                <th>Confirmado por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {confirmados.map((item) => (
                <tr key={item.id}>
                  <td>{item.anio}</td>
                  <td>
                    {item.version}
                    {item.es_vigente ? <Badge bg="success" className="ms-2">Vigente</Badge> : null}
                  </td>
                  <td>{texto(item.estado)}</td>
                  <td>{texto(item.origen)}</td>
                  <td>{texto(item.integridad)}</td>
                  <td>{item.generado_en ? new Date(item.generado_en).toLocaleString() : "—"}</td>
                  <td>{item.confirmado_por || "—"}</td>
                  <td>
                    <Button size="sm" variant="outline-primary" onClick={() => abrir(item.id)}>
                      Ver informe
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <Modal show={!!detalle} onHide={() => setDetalle(null)} size="xl" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>
            Cierre {cierre?.anio} · versión {cierre?.version}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cierre && (
            <>
              <p className="mb-2">
                Fecha de corte: {dia(cierre.fecha_corte)} ({cierre.zona_horaria}), inclusive.
                Fecha de captura: {cierre.generado_en ? new Date(cierre.generado_en).toLocaleString() : "—"}.
                Fecha de confirmación: {cierre.confirmado_en ? new Date(cierre.confirmado_en).toLocaleString() : "pendiente"}.
              </p>
              <p className="mb-2">
                Estado: {texto(cierre.estado)}. Origen: {texto(cierre.origen)}. Integridad: {texto(cierre.integridad)}.
                Reglas {cierre.version_reglas}.
                {cierre.origen === "reconstruccion" || cierre.origen === "correccion"
                  ? ` Criterio: ${cierre.criterio}.`
                  : ""}
              </p>
              {cierre.motivo && <Alert variant="light">Motivo: {cierre.motivo}</Alert>}
              {cierre.error && <Alert variant="danger">{cierre.error}</Alert>}
              {(cierre.limitaciones || []).length > 0 && (
                <Alert variant="warning">
                  <div className="fw-semibold">Limitaciones de integridad</div>
                  <ul className="mb-0">
                    {cierre.limitaciones.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              {cierre.confirmacion_bloqueada && (
                <Alert variant="warning">{cierre.mensaje_confirmacion}</Alert>
              )}
              {puede && cierre.estado === "pendiente_confirmacion" && (
                <div className="d-flex gap-2 mb-3">
                  {!cierre.confirmacion_bloqueada && (
                    <Button
                      size="sm"
                      onClick={() => ejecutar(`/cierres-fiscales/${cierre.id}/confirmar`)}
                      disabled={!!accion}
                    >
                      Confirmar cierre
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline-danger"
                    disabled={motivo.trim().length < 10 || !!accion}
                    onClick={() => ejecutar(`/cierres-fiscales/${cierre.id}/anular`, { motivo })}
                  >
                    Anular esta captura
                  </Button>
                </div>
              )}
            </>
          )}

          {indicadores && (
            <>
              <div className="row g-2 mb-3">
                <div className="col-6 col-md-3">
                  <Indicador titulo="Grupos registrados" valor={indicadores.grupos_registrados} />
                </div>
                <div className="col-6 col-md-3">
                  <Indicador
                    titulo="Grupos con cobertura activa"
                    valor={indicadores.grupos_con_cobertura_activa}
                  />
                </div>
                <div className="col-6 col-md-3">
                  <Indicador titulo="Clientes registrados" valor={indicadores.clientes_registrados} />
                </div>
                <div className="col-6 col-md-3">
                  <Indicador
                    titulo="Clientes con cobertura activa"
                    valor={indicadores.clientes_con_cobertura_activa}
                  />
                </div>
              </div>
              <div className="row g-2 mb-3">
                <div className="col-12 col-md-4">
                  <Indicador
                    titulo="Coberturas activas al cierre"
                    valor={indicadores.coberturas_activas ?? 0}
                    nota={indicadores.coberturas_activas_nota}
                  />
                </div>
              </div>
              <h6>Estado de coberturas MS</h6>
              <p className="small text-muted">{indicadores.salud_ms?.nota}</p>
              <div className="row g-2 mb-3">
                {["si", "no", "medicare", "medicaid"].map((clave) => (
                  <div className="col-6 col-md-3" key={clave}>
                    <Indicador titulo={clave === "si" ? "Sí" : clave} valor={indicadores.salud_ms?.[clave] ?? 0} />
                  </div>
                ))}
              </div>
              <p>
                Total del estado MS: <strong>{indicadores.salud_ms?.total_estado ?? 0}</strong>.
                Este total no significa que todas estén activas.
              </p>
              <div className="row g-2 mb-3">
                <div className="col-6 col-md-3"><Indicador titulo="Dental MS" valor={indicadores.dental_ms} /></div>
                <div className="col-6 col-md-3"><Indicador titulo="Cotizaciones" valor={indicadores.cotizaciones} /></div>
                <div className="col-6 col-md-3"><Indicador titulo="Canceladas" valor={indicadores.canceladas?.total} /></div>
                <div className="col-6 col-md-3"><Indicador titulo="Retiradas operativas" valor={indicadores.retiradas?.total} /></div>
                <div className="col-6 col-md-3"><Indicador titulo="Anuladas" valor={indicadores.anuladas} /></div>
                <div className="col-6 col-md-3"><Indicador titulo="Bajas con fecha futura" valor={indicadores.bajas_futuras} /></div>
                <div className="col-6 col-md-3"><Indicador titulo="Sin evidencia" valor={indicadores.sin_evidencia} nota="Fuera de los totales" /></div>
                <div className="col-6 col-md-3">
                  <Indicador
                    titulo="Cierres técnicos posteriores"
                    valor={indicadores.cierres_tecnicos_posteriores}
                    nota="No son retiros operativos"
                  />
                </div>
              </div>
              <p className="small">
                Movimientos del año (fecha efectiva, aparte del estado al cierre): altas{" "}
                {indicadores.movimientos_del_anio?.altas ?? 0}, cancelaciones{" "}
                {indicadores.movimientos_del_anio?.cancelaciones ?? 0}, retiros{" "}
                {indicadores.movimientos_del_anio?.retiros_operativos ?? 0}, anulaciones{" "}
                {indicadores.movimientos_del_anio?.anulaciones ?? 0}.
              </p>
              <p className="small text-muted">{indicadores.suma_precio?.nota}</p>
              <details className="mb-3">
                <summary>Diferencia con el KPI operativo del dashboard</summary>
                <ul>
                  {(indicadores.notas_diferencia_kpi || []).map((nota) => (
                    <li key={nota}>{nota}</li>
                  ))}
                </ul>
              </details>
            </>
          )}

          <Form.Select
            className="mb-2"
            value={clasificacion}
            onChange={(e) => abrir(cierre.id, e.target.value)}
          >
            <option value="">Todo el detalle guardado</option>
            <option value="salud_ms_si">Salud MS Sí</option>
            <option value="salud_ms_no">Salud MS No</option>
            <option value="salud_ms_medicare">Medicare</option>
            <option value="salud_ms_medicaid">Medicaid</option>
            <option value="dental_ms">Dental MS</option>
            <option value="cotizacion">Cotizaciones</option>
            <option value="cancelada">Canceladas</option>
            <option value="retirada">Retiradas</option>
            <option value="anulada">Anuladas</option>
            <option value="baja_futura">Bajas futuras al corte</option>
            <option value="sin_evidencia">Sin evidencia</option>
          </Form.Select>
          <Table size="sm" responsive>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nombre</th>
                <th>Clasificación</th>
                <th>Fuente</th>
                <th>Activación</th>
                <th>Cancelación</th>
                <th>Retiro</th>
                <th>En indicador</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.id}>
                  <td>{fila.tipo_fila}</td>
                  <td>
                    {fila.nombre || "—"}
                    <div className="text-muted small">
                      {fila.cobertura_tipo || fila.estado_cliente || fila.grupo_estado_codigo || ""}
                    </div>
                  </td>
                  <td>{fila.clasificacion}</td>
                  <td>{fila.fuente}</td>
                  <td>{dia(fila.fecha_activacion)}</td>
                  <td>{dia(fila.fecha_cancelacion)}</td>
                  <td>{dia(fila.fecha_retiro)}</td>
                  <td>{fila.incluida_en_indicador ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {filas.some((fila) => fila.nota) && (
            <ul className="small text-muted">
              {filas.filter((fila) => fila.nota).map((fila) => (
                <li key={`nota-${fila.id}`}>{fila.nombre || fila.cobertura_id || fila.id}: {fila.nota}</li>
              ))}
            </ul>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
