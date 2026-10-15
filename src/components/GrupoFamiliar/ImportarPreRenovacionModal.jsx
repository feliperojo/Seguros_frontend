/* eslint-disable react/prop-types */
import { useMemo, useRef, useState } from "react";
import apiRequest from "../../services/api";
import { leerPreRenovacionExcel } from "../../utils/preRenovacionExcel";
import "../../styles/PreRenovacionModal.css";

const ETIQUETAS = {
  "cliente.primer_nombre": "Primer nombre",
  "cliente.segundo_nombre": "Segundo nombre",
  "cliente.apellidos": "Apellidos",
  "cliente.nombre_completo": "Nombre completo",
  "cliente.fecha_nacimiento": "Fecha de nacimiento",
  "cliente.genero": "Género",
  "cliente.social": "Social",
  "cliente.status": "Estatus migratorio",
  "cliente.auscis": "A/USCIS",
  "cliente.tarjeta_numero": "Tarjeta",
  "cliente.categoria": "Categoría migratoria",
  "cliente.fecha_emision": "Fecha de emisión",
  "cliente.fecha_expiracion": "Fecha de expiración",
  "cliente.telefono": "Teléfono",
  "cliente.email": "Correo",
  "cliente.whatsapp": "WhatsApp",
  "cliente.telegram": "Telegram",
  "cliente.texto_sms": "Texto SMS",
  "cliente.calle": "Calle",
  "cliente.apto": "Apto",
  "cliente.ciudad": "Ciudad",
  "cliente.condado": "Condado",
  "cliente.estado": "Estado",
  "cliente.codigo_postal": "Código postal",
  "cliente.idioma": "Idioma",
  "cliente.tipo_ingreso": "Tipo de ingreso",
  "cliente.empleador": "Empleador o actividad",
  "cliente.telefono_empleador": "Teléfono del empleador",
  "cliente.periodo_ingreso": "Período de ingreso",
  "cliente.ingreso_por_periodo": "Ingreso por período",
  "cliente.ingreso_anual": "Ingreso anual registrado",
  "cliente.periodo_ingreso_ocasional": "Período de ingreso ocasional",
  "cliente.ingreso_por_periodo_ocasional": "Ingreso ocasional por período",
  "cliente.ingreso_ocasional_anual": "Ingreso ocasional anual",
  plan: "Plan para la renovación",
  metal: "Categoría del plan para la renovación",
  precio: "Precio para la renovación",
  compania_id: "Compañía para la renovación",
  elegibilidad: "Elegibilidad para la renovación",
  fecha_activacion: "Fecha de activación para la renovación",
};

const ROLES = {
  titular: "Titular",
  conyuge: "Cónyuge",
  dependiente: "Dependiente",
};

const mostrar = (valor) => {
  if (valor === true) return "Sí";
  if (valor === false) return "No";
  if (valor === null || valor === undefined || valor === "") return "—";
  return String(valor);
};

const nuevaClave = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const ImportarPreRenovacionModal = ({
  show,
  onHide,
  grupoFamiliarId,
  anioDestino,
  tomadorNombre,
}) => {
  const [archivoNombre, setArchivoNombre] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [revision, setRevision] = useState(null);
  const [seleccion, setSeleccion] = useState({});
  const [temporadaConfirmada, setTemporadaConfirmada] = useState({});
  const [resultado, setResultado] = useState("");
  const guardando = useRef(false);

  const cambios = revision?.cambios || [];
  const seleccionados = useMemo(
    () => cambios.filter((cambio) => seleccion[cambio.id]),
    [cambios, seleccion]
  );
  const faltaTemporada = seleccionados.some(
    (cambio) => cambio.requiere_confirmacion_temporada && !temporadaConfirmada[cambio.id]
  );

  if (!show) return null;

  const limpiar = () => {
    setArchivoNombre("");
    setError("");
    setRevision(null);
    setSeleccion({});
    setTemporadaConfirmada({});
    setResultado("");
    setOcupado(false);
  };

  const cerrar = () => {
    if (ocupado) return;
    limpiar();
    onHide();
  };

  const revisarArchivo = async (file) => {
    setError("");
    setResultado("");
    setRevision(null);
    setSeleccion({});
    setTemporadaConfirmada({});
    if (!file) return;
    setArchivoNombre(file.name);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "xlsx") {
      setError("Esta entrega solo admite archivos .xlsx OOXML. Los .xlsb no se importan.");
      return;
    }
    setOcupado(true);
    try {
      const buffer = await file.arrayBuffer();
      const leido = leerPreRenovacionExcel(buffer);
      if (!leido.ok) {
        setError(leido.mensaje);
        return;
      }
      const respuesta = await apiRequest(
        `/grupo_familiar/${grupoFamiliarId}/pre-renovacion/importacion/revisar`,
        "POST",
        {
          anio_destino: anioDestino,
          extraccion: leido.extraccion,
        }
      );
      setRevision(respuesta.data);
    } catch (requestError) {
      setError(requestError?.message || "No se pudo revisar el archivo.");
    } finally {
      setOcupado(false);
    }
  };

  const guardar = async () => {
    if (!revision?.revision || faltaTemporada || seleccionados.length === 0 || guardando.current) return;
    guardando.current = true;
    setOcupado(true);
    setError("");
    try {
      const respuesta = await apiRequest(
        `/grupo_familiar/${grupoFamiliarId}/pre-renovacion/importacion/confirmar`,
        "POST",
        {
          anio_destino: anioDestino,
          revision: revision.revision,
          idempotency_key: nuevaClave(),
          seleccion: seleccionados.map((cambio) => ({
            id: cambio.id,
            ...(cambio.requiere_confirmacion_temporada
              ? { confirma_temporada: true }
              : {}),
          })),
        }
      );
      setResultado(respuesta?.data?.mensaje || "Los cambios quedaron en el borrador.");
      setRevision(null);
      setSeleccion({});
      setTemporadaConfirmada({});
    } catch (requestError) {
      setError(requestError?.message || "No se guardó la importación.");
    } finally {
      guardando.current = false;
      setOcupado(false);
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ zIndex: 1070 }}>
      <div className="modal-dialog modal-dialog-centered pr-modal" role="document">
        <div className="modal-content pr-modal__content">
          <div className="modal-header pr-modal__header">
            <div>
              <h5 className="modal-title pr-modal__title">Importar pre-renovación desde Excel</h5>
              <p className="pr-modal__subtitle mb-0">
                Grupo #{grupoFamiliarId}
                {tomadorNombre ? ` · ${tomadorNombre}` : ""} · temporada {anioDestino}
              </p>
            </div>
            <button type="button" className="btn-close" aria-label="Cerrar" onClick={cerrar} />
          </div>
          <div className="modal-body" style={{ overflow: "auto" }}>
            <div className="alert alert-warning">
              Esta entrega solo lee archivos .xlsx de Excel moderno (OOXML). Los .xlsb y los .xlsx
              con contenido binario se rechazan. El año del nombre del archivo no define la temporada.
              Subir el archivo no guarda datos.
            </div>
            <label className="form-label" htmlFor="archivo-prerenovacion">
              Archivo de la familia
            </label>
            <input
              id="archivo-prerenovacion"
              className="form-control"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={ocupado}
              onChange={(event) => revisarArchivo(event.target.files?.[0])}
            />
            {archivoNombre && <div className="small text-muted mt-1">{archivoNombre}</div>}
            {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
            {resultado && <div className="alert alert-success mt-3 mb-0">{resultado}</div>}

            {revision && (
              <>
                {revision.correspondencia && !revision.correspondencia.verificada && (
                  <div className="alert alert-warning mt-3 mb-0">
                    {revision.correspondencia.mensaje} Puede revisar los integrantes, pero no se guardará nada hasta confirmar que el archivo es de este grupo.
                  </div>
                )}

                <div className="row mt-3">
                  <div className="col-md-6">
                    <h6>Integrantes del Excel</h6>
                    <TablaMiembros filas={revision.miembros_excel || []} />
                  </div>
                  <div className="col-md-6">
                    <h6>Integrantes del grupo</h6>
                    <TablaMiembros filas={revision.miembros_grupo || []} />
                  </div>
                </div>

                {revision.correspondencia?.verificada && (
                  <p className="small text-muted mt-3 mb-0">
                    El nombre y la fecha de nacimiento confirman a los integrantes. El parentesco se muestra para reconocerlos y permanece como está en el grupo.
                  </p>
                )}

                {revision.importacion_incompleta && (
                  <div className="alert alert-warning mt-3">
                    Esta importación no está completa. Hay información del Excel que no se guardará
                    o personas pendientes de vincular.
                  </div>
                )}

                {revision.informativos?.length > 0 && (
                  <>
                    <h6 className="mt-3">Datos del grupo que no se guardan</h6>
                    <p className="small text-muted">
                      Estos campos se muestran para compararlos. No se guardan en el grupo vigente ni se incorporan al consolidar.
                    </p>
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Campo</th>
                            <th>Valor actual</th>
                            <th>Valor del Excel</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revision.informativos.map((fila) => (
                            <tr key={fila.campo}>
                              <td>{fila.etiqueta}</td>
                              <td>{mostrar(fila.valor_actual)}</td>
                              <td>{mostrar(fila.valor_excel)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {revision.pendientes?.length > 0 && (
                  <>
                    <h6 className="mt-3">Pendientes de vinculación</h6>
                    <ul>
                      {revision.pendientes.map((pendiente) => (
                        <li key={`${pendiente.hoja}-${pendiente.nombre}`}>
                          <strong>{pendiente.nombre}</strong> ({pendiente.hoja}
                          {pendiente.cobertura_excel ? `, cobertura ${pendiente.cobertura_excel}` : ""})
                          . {pendiente.mensaje}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {revision.advertencias?.length > 0 && (
                  <ul className="small text-muted">
                    {revision.advertencias.map((aviso) => (
                      <li key={`${aviso.codigo}-${aviso.mensaje}`}>{aviso.mensaje}</li>
                    ))}
                  </ul>
                )}

                {revision.correspondencia?.verificada && (
                  <>
                    <h6 className="mt-3">Datos que puede guardar en el borrador</h6>
                    {cambios.length === 0 ? (
                      <p className="text-muted">Los integrantes vinculados no tienen diferencias para guardar.</p>
                    ) : (
                      <div className="d-flex flex-column gap-2 mt-2">
                        {agruparCambios(cambios).map((persona, indice) => (
                          <Acordeon
                            key={persona.clave}
                            id={`import-persona-${persona.clave}`}
                            title={persona.nombre}
                            icon={<i className="fas fa-user" />}
                            defaultOpen={indice === 0}
                            detalle={persona.sinCobertura ? "Cobertura en el Excel: NO. No se asegura por esta importación." : ""}
                          >
                            <div className="d-flex flex-column gap-2">
                              {persona.cliente.length > 0 && (
                                <Acordeon
                                  id={`import-cliente-${persona.clave}`}
                                  title="Datos del cliente"
                                  icon={<i className="fas fa-id-card" />}
                                  defaultOpen
                                >
                                  <TablaCambios
                                    filas={persona.cliente}
                                    seleccion={seleccion}
                                    temporadaConfirmada={temporadaConfirmada}
                                    anioDestino={anioDestino}
                                    onSeleccion={setSeleccion}
                                    onTemporada={setTemporadaConfirmada}
                                  />
                                </Acordeon>
                              )}
                              <Acordeon
                                id={`import-cobertura-${persona.clave}`}
                                title="Datos de la cobertura"
                                icon={<i className="fas fa-shield-alt" />}
                                defaultOpen={persona.sinCobertura}
                              >
                                <TablaCambios
                                  filas={persona.cobertura}
                                  referencias={referenciasCobertura(persona)}
                                  seleccion={seleccion}
                                  temporadaConfirmada={temporadaConfirmada}
                                  anioDestino={anioDestino}
                                  onSeleccion={setSeleccion}
                                  onTemporada={setTemporadaConfirmada}
                                />
                              </Acordeon>
                            </div>
                          </Acordeon>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={cerrar} disabled={ocupado}>
              Cerrar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={ocupado || !revision?.revision || seleccionados.length === 0 || faltaTemporada}
              onClick={guardar}
            >
              {ocupado ? "Procesando..." : "Guardar en el borrador"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const agruparCambios = (filas) => {
  const orden = [];
  const grupos = new Map();
  filas.forEach((cambio) => {
    const clave = String(cambio.cliente_id || cambio.nombre);
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        nombre: cambio.nombre,
        sinCobertura: false,
        coberturaTipo: "",
        coberturaExcel: "",
        cliente: [],
        cobertura: [],
      });
      orden.push(clave);
    }
    const grupo = grupos.get(clave);
    if (cambio.sin_cobertura_excel) grupo.sinCobertura = true;
    if (!grupo.coberturaTipo && cambio.cobertura_tipo) grupo.coberturaTipo = cambio.cobertura_tipo;
    if (!grupo.coberturaExcel && cambio.cobertura_excel) grupo.coberturaExcel = cambio.cobertura_excel;
    if (String(cambio.campo).startsWith("cliente.")) grupo.cliente.push(cambio);
    else grupo.cobertura.push(cambio);
  });
  return orden.map((clave) => grupos.get(clave));
};

const Acordeon = ({ id, title, icon, children, defaultOpen = false, detalle = "" }) => {
  const [abierto, setAbierto] = useState(defaultOpen);

  return (
    <div className="pr-acc">
      <button
        type="button"
        id={`pr-acc-btn-${id}`}
        className={`pr-acc__toggle ${abierto ? "is-open" : ""}`}
        aria-expanded={abierto}
        aria-controls={`pr-acc-panel-${id}`}
        onClick={() => setAbierto((actual) => !actual)}
      >
        <span className="d-flex align-items-center gap-2">
          {icon && <span className="pr-acc__icon">{icon}</span>}
          <span>
            {title}
            {detalle && <span className="pr-acc__detalle">{detalle}</span>}
          </span>
        </span>
        <i className="fas fa-chevron-down pr-acc__chevron" />
      </button>
      {abierto && (
        <div id={`pr-acc-panel-${id}`} className="pr-acc__panel">
          {children}
        </div>
      )}
    </div>
  );
};

const referenciasCobertura = (persona) => ([
  {
    id: `tipo-${persona.clave}`,
    campo: "Tipo de cobertura",
    nota: "Es la cobertura que ya tiene en el grupo. Permanece igual en esta importación.",
    valor_actual: persona.coberturaTipo || "—",
    valor_excel: "—",
  },
  {
    id: `marca-${persona.clave}`,
    campo: "Cobertura indicada en el Excel",
    nota: persona.sinCobertura
      ? "El archivo indica NO. La persona no queda asegurada por esta importación."
      : "El archivo indica cobertura. Los datos de la póliza se guardan solo si los marcas.",
    valor_actual: "—",
    valor_excel: persona.coberturaExcel || "—",
  },
]);

const TablaCambios = ({
  filas,
  referencias = [],
  seleccion,
  temporadaConfirmada,
  anioDestino,
  onSeleccion,
  onTemporada,
}) => (
  <div className="table-responsive">
    <table className="table table-sm align-middle mb-0">
      <thead>
        <tr>
          <th />
          <th>Campo</th>
          <th>Valor actual</th>
          <th>Valor del Excel</th>
        </tr>
      </thead>
      <tbody>
        {referencias.map((fila) => (
          <tr key={fila.id}>
            <td />
            <td>
              {fila.campo}
              {fila.nota && <div className="small text-muted">{fila.nota}</div>}
            </td>
            <td>{mostrar(fila.valor_actual)}</td>
            <td>{mostrar(fila.valor_excel)}</td>
          </tr>
        ))}
        {filas.map((cambio) => (
          <tr key={cambio.id}>
            <td>
              <input
                type="checkbox"
                checked={Boolean(seleccion[cambio.id])}
                aria-label={`Aplicar ${ETIQUETAS[cambio.campo] || cambio.campo}`}
                onChange={(event) => {
                  onSeleccion((actual) => ({
                    ...actual,
                    [cambio.id]: event.target.checked,
                  }));
                }}
              />
            </td>
            <td>
              {ETIQUETAS[cambio.campo] || cambio.campo}
              <div className="small text-muted">
                {cambio.origen_actual === "borrador" ? "Borrador actual" : "Dato vigente"}
              </div>
              {cambio.requiere_confirmacion_temporada && seleccion[cambio.id] && (
                <label className="small d-block mt-1">
                  <input
                    type="checkbox"
                    className="me-1"
                    checked={Boolean(temporadaConfirmada[cambio.id])}
                    onChange={(event) => {
                      onTemporada((actual) => ({
                        ...actual,
                        [cambio.id]: event.target.checked,
                      }));
                    }}
                  />
                  Confirmo que este ingreso corresponde a la temporada {anioDestino}.
                </label>
              )}
              {cambio.nota && <div className="small text-muted">{cambio.nota}</div>}
            </td>
            <td>{mostrar(cambio.valor_actual)}</td>
            <td>{mostrar(cambio.presentacion_excel || cambio.valor_excel)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TablaMiembros = ({ filas }) => {
  if (!filas.length) {
    return <p className="text-muted small">No hay integrantes para mostrar.</p>;
  }

  return (
    <div className="table-responsive">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Parentesco</th>
            <th>Nacimiento</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={`${fila.nombre}-${fila.rol}-${fila.hoja || ""}`}>
              <td>{fila.nombre}</td>
              <td>{ROLES[fila.rol] || fila.rol || "—"}</td>
              <td>{mostrar(fila.fecha_nacimiento)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ImportarPreRenovacionModal;
