/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Form, Modal } from "react-bootstrap";
import {
  FaCalendarAlt,
  FaExclamationTriangle,
  FaFileInvoiceDollar,
  FaProjectDiagram,
  FaUsers,
} from "react-icons/fa";
import apiRequest from "../../services/api";
import { labelEstadoGrupoParaDisplay } from "../../constants/estadosGrupoFamiliar";
import "../../styles/Dashboard.css";

const ETIQUETAS = {
  pendiente_confirmacion: "Pendiente de confirmación",
  confirmado: "Confirmado",
  fallido: "Fallido",
  anulado: "Anulado",
  generando: "Generando",
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
    ayuda: "Usa el snapshot de la renovación. No es una foto certificada del 31 de diciembre.",
  },
  {
    value: "fecha_efectiva",
    label: "Fechas efectivas aunque se registraron después",
    ayuda: "Aplica la fecha de la baja o del alta aunque se haya grabado después. No es una foto del corte.",
  },
];

const ESTADOS_LINEA = {
  salud_ms_si: "Sí",
  salud_ms_no: "No",
  salud_ms_medicare: "Medicare",
  salud_ms_medicaid: "Medicaid",
  dental_ms: "Dental MS",
  vision: "Vision",
  plan_dental: "Plan Dental",
  descuentos: "Plan de Descuentos",
  cotizacion: "Cotización",
  cancelada: "Cancelada",
  retirada: "Retirada",
};

function texto(valor) {
  return ETIQUETAS[valor] || valor || "—";
}

function mensajeError(error, respaldo) {
  const textoError = String(error?.message || "");
  if (/SQLSTATE|Undefined table|does not exist/i.test(textoError)) {
    return "No se pudo consultar los cierres fiscales. Falta aplicar la migración en esta base de datos.";
  }
  return textoError || respaldo;
}

function momento(valor) {
  if (!valor) return "Pendiente";
  return new Date(valor).toLocaleString("es-CO", { timeZone: "America/Bogota" });
}

function Tile({ label, value, icon, tone = "primary", onClick }) {
  return (
    <div
      className={`dashboard-kpi-tile dashboard-kpi-tile--${tone}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span className="dashboard-kpi-tile__icon" aria-hidden="true">{icon}</span>
      <span className="dashboard-kpi-tile__label">{label}</span>
      <span className="dashboard-kpi-tile__value">{value}</span>
    </div>
  );
}

function Linea({ label, valor, color, descripcion, abierta, onToggle }) {
  return (
    <button
      type="button"
      className="dashboard-kpi-detalle-item dashboard-kpi-detalle-item--btn"
      style={{ borderLeftColor: color || "#1a3964" }}
      onClick={onToggle}
      aria-expanded={abierta}
    >
      <div className="dashboard-kpi-detalle-item__info">
        <div>
          <span className="dashboard-kpi-detalle-item__label">{label}</span>
          {descripcion ? <span className="dashboard-kpi-detalle-item__desc">{descripcion}</span> : null}
        </div>
      </div>
      <span className="dashboard-kpi-detalle-item__value">{valor}</span>
    </button>
  );
}

function ListaGuardada({ filas, cargando }) {
  if (cargando) return <p className="small text-muted mb-0">Cargando la copia guardada…</p>;
  if (!filas.length) return <p className="small text-muted mb-0">No hay filas de este indicador en la copia.</p>;

  return (
    <ul className="list-unstyled small mb-0 mt-2">
      {filas.map((fila) => (
        <li key={fila.id} className="d-flex justify-content-between gap-2 py-1 border-bottom">
          <span>{fila.nombre || "Sin nombre"}</span>
          <span className="text-muted text-end">
            {ESTADOS_LINEA[fila.clasificacion]
              || fila.estado_cobertura
              || fila.estado_cliente
              || labelEstadoGrupoParaDisplay(fila.grupo_estado_codigo)}
            {fila.cobertura_tipo ? ` · ${fila.cobertura_tipo}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function CierresFiscalesPanel({ anioInicial }) {
  const [lista, setLista] = useState([]);
  const [meta, setMeta] = useState({
    habilitado: false,
    puede_gestionar: false,
    fecha_corte: null,
    hay_consolidacion: false,
    aviso_fecha_simulada: "",
  });
  const [anio, setAnio] = useState(anioInicial || new Date().getFullYear() - 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [criterio, setCriterio] = useState("solo_evidencia_previa");
  const [accion, setAccion] = useState("");
  const [tarjeta, setTarjeta] = useState(null);
  const [lineaAbierta, setLineaAbierta] = useState(null);
  const [filasLinea, setFilasLinea] = useState([]);
  const [cargandoLinea, setCargandoLinea] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest(`/cierres-fiscales?anio=${anio}`, "GET");
      setLista(Array.isArray(response?.data) ? response.data : []);
      setMeta({
        habilitado: !!response?.habilitado,
        puede_gestionar: !!response?.puede_gestionar,
        fecha_corte: response?.fecha_corte || `${anio}-12-31`,
        hay_consolidacion: !!response?.hay_consolidacion,
        aviso_fecha_simulada: response?.aviso_fecha_simulada || "",
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

  const abrir = async (id) => {
    setError("");
    try {
      const response = await apiRequest(`/cierres-fiscales/${id}?per_page=1`, "GET");
      setDetalle(response);
    } catch (requestError) {
      setError(mensajeError(requestError, "No se pudo abrir el cierre."));
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
        await abrir(detalle.data.id);
      }
    } catch (requestError) {
      setError(mensajeError(requestError, "No se pudo completar la acción."));
    } finally {
      setAccion("");
    }
  };

  const revisar = async () => {
    setAccion("revisar");
    setError("");
    try {
      if (actual?.id) {
        await abrir(actual.id);
        return;
      }
      const response = await apiRequest(`/cierres-fiscales/${anio}/revisar`, "POST");
      await cargar();
      if (response?.data?.id) await abrir(response.data.id);
    } catch (requestError) {
      setError(mensajeError(requestError, "No se pudo revisar el cierre."));
    } finally {
      setAccion("");
    }
  };

  const abrirLinea = async (clave, filtro) => {
    if (lineaAbierta === clave) {
      setLineaAbierta(null);
      return;
    }
    setLineaAbierta(clave);
    setCargandoLinea(true);
    setFilasLinea([]);
    const params = new URLSearchParams({ per_page: "100", tipo: filtro.tipo });
    if (filtro.clasificacion) params.set("clasificacion", filtro.clasificacion);
    if (filtro.producto) params.set("producto", filtro.producto);
    if (filtro.estado_cliente) params.set("estado_cliente", filtro.estado_cliente);
    if (Object.prototype.hasOwnProperty.call(filtro, "estado_grupo")) params.set("estado_grupo", filtro.estado_grupo || "");
    try {
      const response = await apiRequest(`/cierres-fiscales/${cierre.id}?${params}`, "GET");
      setFilasLinea(response?.detalle?.data || []);
    } catch (requestError) {
      setError(mensajeError(requestError, "No se pudo abrir el desglose."));
      setFilasLinea([]);
    } finally {
      setCargandoLinea(false);
    }
  };

  const indicadores = detalle?.indicadores;
  const panel = indicadores?.panel;
  const cierre = detalle?.data;
  const puede = meta.habilitado && meta.puede_gestionar;
  const esCopia = cierre?.estado === "confirmado";
  const corteVisible = `31 de diciembre de ${anio}`;

  const abrirTarjeta = (tipo) => {
    setLineaAbierta(null);
    setFilasLinea([]);
    setTarjeta(tipo);
  };

  return (
    <div className="gf-listado__body">
      <div className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div className="dashboard-panel__header-main">
            <div>
              <h2 className="dashboard-panel__title">Panel al cierre de {anio}</h2>
              <p className="dashboard-panel__subtitle">
                Estos indicadores se guardaron con corte al {corteVisible}. Las operaciones posteriores no modifican esta copia.
              </p>
            </div>
          </div>
        </div>
        <div className="dashboard-panel__body">
          {meta.aviso_fecha_simulada && <Alert variant="warning">{meta.aviso_fecha_simulada}</Alert>}
          {!meta.habilitado && (
            <Alert variant="secondary">
              La función está deshabilitada. Los cierres guardados se conservan y la consolidación no exige un cierre confirmado.
            </Alert>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
          {meta.hay_consolidacion && !actual && (
            <Alert variant="warning">
              Ya hay renovaciones consolidadas o confirmadas de {anio} hacia {Number(anio) + 1}. El cierre habitual no puede generarse. Use la reconstrucción histórica.
            </Alert>
          )}

          <div className="d-flex flex-wrap gap-3 align-items-end mb-3">
            <Form.Group>
              <Form.Label className="small mb-1">Año</Form.Label>
              <Form.Control
                type="number"
                min={2000}
                max={2100}
                value={anio}
                onChange={(event) => {
                  setDetalle(null);
                  setTarjeta(null);
                  setAnio(Number(event.target.value));
                }}
              />
            </Form.Group>
            <div>
              <div className="small text-muted mb-1">Fecha de corte</div>
              <div>{corteVisible}</div>
            </div>
            <div>
              <div className="small text-muted mb-1">Estado</div>
              <div>
                {cierre ? texto(cierre.estado) : actual ? texto(actual.estado) : "Sin revisar"}
                {(cierre || actual)?.es_dato_prueba ? (
                  <Badge bg="warning" text="dark" className="ms-2">Dato de prueba</Badge>
                ) : null}
              </div>
            </div>
            <div>
              <div className="small text-muted mb-1">Confirmación</div>
              <div>
                {cierre?.confirmado_en || actual?.confirmado_en
                  ? `${momento(cierre?.confirmado_en || actual?.confirmado_en)}${(cierre?.confirmado_por || actual?.confirmado_por) ? ` · ${cierre?.confirmado_por || actual?.confirmado_por}` : ""}`
                  : "Pendiente"}
              </div>
            </div>
            {puede && (
              <Button size="sm" onClick={revisar} disabled={!!accion || (meta.hay_consolidacion && !actual)}>
                Revisar indicadores del cierre
              </Button>
            )}
          </div>

          {esCopia && (
            <Alert variant="info">
              Estás consultando la copia guardada del cierre de {anio}, no los indicadores actuales del Panel Principal.
            </Alert>
          )}

          {(cierre?.limitaciones || []).length > 0 && (
            <Alert variant="warning">
              <div className="fw-semibold">Observaciones de esta copia</div>
              <ul className="mb-0">
                {cierre.limitaciones.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </Alert>
          )}
          {cierre?.confirmacion_bloqueada && <Alert variant="warning">{cierre.mensaje_confirmacion}</Alert>}

          {panel && (
            <div className="dashboard-panel__section dashboard-panel__section--kpis">
              <p className="dashboard-kpi-group-label">Resumen general</p>
              <div className="dashboard-kpi-grid dashboard-kpi-grid--5">
                <Tile label="Total Clientes" value={panel.total_clientes} icon={<FaUsers />} onClick={() => abrirTarjeta("clientes")} />
                <Tile label="Grupos Familiares" value={panel.total_grupos_familiares} icon={<FaProjectDiagram />} onClick={() => abrirTarjeta("grupos")} />
                <Tile label="Estado de Coberturas MS" value={panel.estado_coberturas_ms} icon={<FaFileInvoiceDollar />} onClick={() => abrirTarjeta("coberturas")} />
                <Tile label="Cotizaciones" value={panel.cotizaciones} icon={<FaFileInvoiceDollar />} tone="warning" onClick={() => abrirTarjeta("cotizacion")} />
                <Tile label="Otras coberturas" value={panel.otros_productos?.total ?? 0} icon={<FaFileInvoiceDollar />} tone="success" onClick={() => abrirTarjeta("otros")} />
              </div>
              <p className="dashboard-kpi-group-label dashboard-kpi-group-label--alert">Cancelaciones y retiros</p>
              <div className="dashboard-kpi-grid dashboard-kpi-grid--2">
                <Tile label="Coberturas Canceladas" value={panel.polizas_canceladas} icon={<FaCalendarAlt />} tone="danger" onClick={() => abrirTarjeta("canceladas")} />
                <Tile label="Coberturas Retiradas" value={panel.polizas_retiradas} icon={<FaExclamationTriangle />} tone="danger" onClick={() => abrirTarjeta("retiradas")} />
              </div>
              <p className="small text-muted mt-3 mb-0">
                Grupos familiares es el total de grupos que existían al corte, no solo los que tenían cobertura activa.
                Estado de coberturas MS reúne Sí, No, Medicare, Medicaid y Dental MS; no significa que todas estuvieran activas.
              </p>
              {puede && cierre?.estado === "pendiente_confirmacion" && !cierre.confirmacion_bloqueada && (
                <Button className="mt-3" size="sm" disabled={!!accion} onClick={() => ejecutar(`/cierres-fiscales/${cierre.id}/confirmar`)}>
                  Confirmar y guardar cierre
                </Button>
              )}
            </div>
          )}

          {loading ? <p>Cargando historial…</p> : null}

          <h6 className="mt-3">Historial anual</h6>
          {confirmados.length === 0 ? (
            <p className="text-muted">No hay cierres confirmados.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Año</th>
                    <th>Estado</th>
                    <th>Confirmado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {confirmados.map((item) => (
                    <tr key={item.id}>
                      <td>{item.anio}</td>
                      <td>
                        {texto(item.estado)}
                        {item.es_dato_prueba ? <Badge bg="warning" text="dark" className="ms-2">Dato de prueba</Badge> : null}
                      </td>
                      <td>{item.confirmado_por || "—"} · {momento(item.confirmado_en)}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => {
                            setTarjeta(null);
                            setAnio(Number(item.anio));
                            abrir(item.id);
                          }}
                        >
                          Ver {item.anio}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {puede && (
            <details className="border rounded p-3 mt-3">
              <summary className="fw-semibold">Reconstrucción histórica y observaciones</summary>
              <p className="small text-muted mt-2">
                Sección para usuarios autorizados. Una reconstrucción incompleta no reemplaza el cierre confirmado.
              </p>
              {cierre?.integridad && <p className="small mb-2">Integridad de la copia abierta: {cierre.integridad}.</p>}
              {(indicadores?.notas_diferencia_kpi || []).length > 0 && (
                <ul className="small">
                  {indicadores.notas_diferencia_kpi.map((nota) => <li key={nota}>{nota}</li>)}
                </ul>
              )}
              <Form.Group className="mb-2">
                <Form.Select value={criterio} onChange={(event) => setCriterio(event.target.value)}>
                  {CRITERIOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Form.Select>
                <Form.Text>{CRITERIOS.find((item) => item.value === criterio)?.ayuda}</Form.Text>
              </Form.Group>
              <Form.Control as="textarea" rows={2} placeholder="Motivo (obligatorio, mínimo 10 caracteres)" value={motivo} onChange={(event) => setMotivo(event.target.value)} />
              <div className="d-flex flex-wrap gap-2 mt-2">
                <Button size="sm" variant="outline-primary" disabled={motivo.trim().length < 10 || !!accion} onClick={() => ejecutar(`/cierres-fiscales/${anio}/reconstruir`, { motivo, criterio })}>
                  Reconstruir {anio}
                </Button>
                {cierre?.estado === "confirmado" && (
                  <Button size="sm" variant="outline-secondary" disabled={motivo.trim().length < 10 || !!accion} onClick={() => ejecutar(`/cierres-fiscales/${cierre.id}/corregir`, { motivo, criterio })}>
                    Corregir la versión confirmada
                  </Button>
                )}
                {cierre?.estado === "pendiente_confirmacion" && (
                  <Button size="sm" variant="outline-danger" disabled={motivo.trim().length < 10 || !!accion} onClick={() => ejecutar(`/cierres-fiscales/${cierre.id}/anular`, { motivo })}>
                    Anular esta revisión
                  </Button>
                )}
              </div>
            </details>
          )}
        </div>
      </div>

      <Modal show={!!tarjeta} onHide={() => setTarjeta(null)} centered className="dashboard-kpi-modal">
        <Modal.Header closeButton>
          <Modal.Title>
            {tarjeta === "clientes" && "Detalle de Clientes"}
            {tarjeta === "grupos" && "Detalle de Grupos Familiares"}
            {tarjeta === "coberturas" && "Detalle — Estado de Coberturas MS"}
            {tarjeta === "cotizacion" && "Detalle — Cotizaciones"}
            {tarjeta === "otros" && "Detalle — Otras coberturas"}
            {tarjeta === "canceladas" && "Coberturas Canceladas"}
            {tarjeta === "retiradas" && "Coberturas Retiradas"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {tarjeta === "clientes" && (
            <>
              <p className="dashboard-kpi-detalle-intro">Personas registradas al corte, según su tipo en la copia guardada.</p>
              <Linea label="Clientes" valor={panel?.detalle_clientes?.clientes ?? 0} color="#1a73e8" descripcion="Personas con estado Cliente" abierta={lineaAbierta === "clientes"} onToggle={() => abrirLinea("clientes", { tipo: "cliente", estado_cliente: "Cliente" })} />
              {lineaAbierta === "clientes" && <ListaGuardada filas={filasLinea} cargando={cargandoLinea} />}
              <Linea label="Contactos" valor={panel?.detalle_clientes?.contactos ?? 0} color="#34a853" descripcion="Personas de contacto registradas" abierta={lineaAbierta === "contactos"} onToggle={() => abrirLinea("contactos", { tipo: "cliente", estado_cliente: "Contacto" })} />
              {lineaAbierta === "contactos" && <ListaGuardada filas={filasLinea} cargando={cargandoLinea} />}
            </>
          )}
          {tarjeta === "grupos" && (
            <>
              <p className="dashboard-kpi-detalle-intro">
                Grupos que ya existían al corte, según el estado guardado. El total no es el de grupos con cobertura activa.
              </p>
              {(panel?.grupos_por_estado || []).map((fila) => (
                <Linea
                  key={fila.codigo || "sin-estado"}
                  label={fila.codigo ? labelEstadoGrupoParaDisplay(fila.codigo) : "Sin estado conocido al corte"}
                  valor={fila.total}
                  color="#9334e6"
                  abierta={lineaAbierta === `grupo-${fila.codigo}`}
                  onToggle={() => abrirLinea(`grupo-${fila.codigo}`, { tipo: "grupo", estado_grupo: fila.codigo || "" })}
                />
              ))}
              {lineaAbierta?.startsWith("grupo-") && <ListaGuardada filas={filasLinea} cargando={cargandoLinea} />}
              <p className="dashboard-kpi-detalle-total mt-3 mb-0">Total grupos: <strong>{panel?.total_grupos_familiares ?? 0}</strong></p>
            </>
          )}
          {tarjeta === "coberturas" && (
            <>
              <p className="dashboard-kpi-detalle-intro">
                Salud MS en Sí, No, Medicare y Medicaid, más Dental MS. El total no significa que todas estuvieran activas.
              </p>
              {[
                ["si", "Sí", panel?.polizas_activas?.si, "salud_ms_si", "#34a853"],
                ["no", "No", panel?.polizas_activas?.no, "salud_ms_no", "#6c757d"],
                ["medicare", "Medicare", panel?.polizas_activas?.medicare, "salud_ms_medicare", "#4285f4"],
                ["medicaid", "Medicaid", panel?.polizas_activas?.medicaid, "salud_ms_medicaid", "#1a73e8"],
              ].map(([clave, etiqueta, valor, clasificacion, color]) => (
                <div key={clave}>
                  <Linea label={etiqueta} valor={valor ?? 0} color={color} abierta={lineaAbierta === clave} onToggle={() => abrirLinea(clave, { tipo: "cobertura", clasificacion })} />
                  {lineaAbierta === clave && <ListaGuardada filas={filasLinea} cargando={cargandoLinea} />}
                </div>
              ))}
              <Linea label="Dental MS" valor={panel?.dental_ms ?? 0} color="#059669" abierta={lineaAbierta === "dental"} onToggle={() => abrirLinea("dental", { tipo: "cobertura", clasificacion: "dental_ms" })} />
              {lineaAbierta === "dental" && <ListaGuardada filas={filasLinea} cargando={cargandoLinea} />}
              <p className="dashboard-kpi-detalle-total mt-3 mb-0">Total: <strong>{panel?.estado_coberturas_ms ?? 0}</strong></p>
            </>
          )}
          {tarjeta === "cotizacion" && (
            <>
              <p className="dashboard-kpi-detalle-intro">Coberturas cuyo grupo estaba en flujo de cotización al corte.</p>
              <Linea label="Cotización" valor={panel?.cotizaciones ?? 0} color="#f9ab00" abierta={lineaAbierta === "cotizacion"} onToggle={() => abrirLinea("cotizacion", { tipo: "cobertura", clasificacion: "cotizacion" })} />
              {lineaAbierta === "cotizacion" && <ListaGuardada filas={filasLinea} cargando={cargandoLinea} />}
            </>
          )}
          {tarjeta === "otros" && (
            <>
              <p className="dashboard-kpi-detalle-intro">Vision, Plan Dental y Plan de Descuentos en Grupo Familiar al corte.</p>
              {[
                ["vision", "Vision", panel?.otros_productos?.vision, "vision", "#0d9488"],
                ["plan", "Plan Dental", panel?.otros_productos?.plan_dental, "plan_dental", "#0891b2"],
                ["descuentos", "Plan de Descuentos", panel?.otros_productos?.descuentos, "descuentos", "#f9ab00"],
              ].map(([clave, etiqueta, valor, clasificacion, color]) => (
                <div key={clave}>
                  <Linea label={etiqueta} valor={valor ?? 0} color={color} abierta={lineaAbierta === clave} onToggle={() => abrirLinea(clave, { tipo: "cobertura", clasificacion })} />
                  {lineaAbierta === clave && <ListaGuardada filas={filasLinea} cargando={cargandoLinea} />}
                </div>
              ))}
            </>
          )}
          {(tarjeta === "canceladas" || tarjeta === "retiradas") && (
            <>
              <p className="dashboard-kpi-detalle-intro">
                {tarjeta === "canceladas"
                  ? "Pólizas canceladas al corte, por producto. Una fecha posterior al 31 de diciembre no entra aquí."
                  : "Pólizas retiradas o terminadas al corte, por producto. El cierre técnico de la renovación no entra aquí."}
              </p>
              {[
                ["salud", "Plan Salud", "salud"],
                ["dental_ms", "Dental MS", "dental_ms"],
                ["vision", "Vision", "vision"],
                ["plan_dental", "Dental Privado", "plan_dental"],
                ["otros", "Otros", "otros"],
              ].map(([clave, etiqueta, producto]) => {
                const bolsa = tarjeta === "canceladas" ? panel?.canceladas_por_producto : panel?.retiradas_por_producto;
                const valor = bolsa?.[clave] ?? 0;
                if (clave === "otros" && !valor) return null;
                const idLinea = `${tarjeta}-${clave}`;
                return (
                  <div key={idLinea}>
                    <Linea
                      label={etiqueta}
                      valor={valor}
                      color="#ea4335"
                      abierta={lineaAbierta === idLinea}
                      onToggle={() => abrirLinea(idLinea, {
                        tipo: "cobertura",
                        clasificacion: tarjeta === "canceladas" ? "cancelada" : "retirada",
                        producto,
                      })}
                    />
                    {lineaAbierta === idLinea && <ListaGuardada filas={filasLinea} cargando={cargandoLinea} />}
                  </div>
                );
              })}
              <p className="dashboard-kpi-detalle-total mt-3 mb-0">
                Total: <strong>{tarjeta === "canceladas" ? panel?.polizas_canceladas : panel?.polizas_retiradas}</strong>
              </p>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
