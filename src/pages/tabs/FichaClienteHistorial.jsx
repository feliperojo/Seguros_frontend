// src/pages/tabs/FichaClienteHistorial.jsx
import React, { useMemo, useState } from "react";
import { useFichaCliente } from "../../context/fichaClienteContext";
import HistorialCambiosModal from "../../components/Reports/HistorialCambiosModal";

const toValidId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function FichaClienteHistorial() {
  const { cliente, coberturaPrincipal } = useFichaCliente();

  const [showGrupoModal, setShowGrupoModal] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [coberturaElegida, setCoberturaElegida] = useState("");
  const [coberturaAbierta, setCoberturaAbierta] = useState(null);
  const coberturas = useMemo(() => {
    const opciones = [...(cliente?.coberturas || []), coberturaPrincipal].filter(Boolean);
    return [...new Map(opciones.filter((c) => toValidId(c.id)).map((c) => [String(c.id), c])).values()];
  }, [cliente, coberturaPrincipal]);
  const coberturaSeleccionada = coberturas.find((c) => String(c.id) === coberturaElegida) || coberturas[0];

  // ===== Grupo familiar principal =====
  const gfId = useMemo(() => {
    if (!cliente) return null;
    return (
      toValidId(cliente.grupo_familiar_id) ??
      toValidId(coberturaPrincipal?.grupo_familiar_id) ??
      toValidId(coberturaPrincipal?.grupo_familiar?.id) ??
      null
    );
  }, [cliente, coberturaPrincipal]);

  const grupoData = useMemo(() => {
    if (!cliente) return null;

    const cover =
      (cliente.coberturas || []).find(
        (c) =>
          toValidId(c.grupo_familiar_id) === gfId ||
          toValidId(c.grupo_familiar?.id) === gfId
      ) || coberturaPrincipal;

    return {
      id: gfId,
      anoCobertura: cover?.ano_cobertura ?? "—",
      codigoPoliza: cover?.codigo_poliza ?? "—",
      responsable:
        cover?.grupo_familiar?.responsable ??
        cover?.responsable ??
        cliente?.grupo_familiar?.responsable ??
        "—",
      estadoGf:
        cover?.grupo_familiar?.estado_actual_catalogo?.estado_nombre ??
        cover?.estado_gf ??
        cliente?.grupo_familiar?.estado_actual_catalogo?.estado_nombre ??
        "—",
    };
  }, [cliente, coberturaPrincipal, gfId]);

  if (!cliente) {
    return (
      <div className="alert alert-info">
        No se encontró información del cliente.
      </div>
    );
  }

  const clienteId = toValidId(cliente.id);

  return (
    <>
      {/* 🔹 Card: Historial del Grupo Familiar */}
      <div className="card mb-3">
        <div className="card-body">
          <h6 className="mb-3">Historial de cambios del Grupo Familiar</h6>
          <p className="small text-muted mb-2">
            Selecciona el grupo familiar del cliente para consultar su historial
            de cambios.
          </p>

          <div className="row small mb-3">
            <div className="col-md-6">
              <div><strong>Grupo Familiar</strong></div>
              <div>GF {grupoData?.id ?? "—"}</div>
              <div><strong>ID Grupo Familiar:</strong> {grupoData?.id ?? "—"}</div>
              <div><strong>Año cobertura:</strong> {grupoData?.anoCobertura}</div>
              <div><strong>Numero ID:</strong> {grupoData?.codigoPoliza}</div>
            </div>
            <div className="col-md-6">
              <div><strong>Asesor / Responsable:</strong> {grupoData?.responsable}</div>
              <div><strong>Estado GF:</strong> {grupoData?.estadoGf}</div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!gfId}
            onClick={() => setShowGrupoModal(true)}
          >
            Ver historial de cambios del grupo
          </button>
        </div>
      </div>

      {/* 🔹 Card: Historial del Cliente */}
      <div className="card">
        <div className="card-body">
          <h6 className="mb-3">Historial de datos del Cliente</h6>

          <div className="row small mb-3">
            <div className="col-md-6">
              <div><strong>Cliente</strong></div>
              <div>{cliente.nombre_completo ?? "—"}</div>
              <div><strong>ID Cliente:</strong> {clienteId ?? "—"}</div>
              <div><strong>Estado:</strong> {cliente.estado_cliente ?? "—"}</div>
            </div>
            <div className="col-md-6">
              <div><strong>Teléfono:</strong> {cliente.telefono ?? "—"}</div>
              <div><strong>Email:</strong> {cliente.email ?? "—"}</div>
              <div><strong>Medio de contacto:</strong> {cliente.medio_contacto ?? "—"}</div>
              <div><strong>Idioma:</strong> {cliente.idioma ?? "—"}</div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={!clienteId}
            onClick={() => setShowClienteModal(true)}
          >
            Ver historial de datos del cliente
          </button>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body">
          <h6 className="mb-2">Historial de cobertura · Detalle</h6>
          <p className="small text-muted mb-3">
            Consulta qué campo cambió, su valor anterior y nuevo, la fecha y quién lo modificó.
            Selecciona la cobertura que deseas revisar.
          </p>
          {coberturas.length ? (
            <>
              <label htmlFor="historial-cobertura" className="form-label small">Cobertura</label>
              <select id="historial-cobertura" className="form-select form-select-sm mb-3"
                value={String(coberturaSeleccionada.id)} onChange={(event) => setCoberturaElegida(event.target.value)}>
                {coberturas.map((c) => (
                  <option key={c.id} value={c.id}>
                    Cobertura #{c.id} · Grupo #{c.grupo_familiar_id ?? c.grupo_familiar?.id ?? "—"} · {c.plan || c.tipo_cobertura || "Sin plan"} · {c.ano_cobertura || "Sin año"}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-outline-primary btn-sm"
                onClick={() => setCoberturaAbierta({ ...coberturaSeleccionada, clienteId })}>
                Ver historial detallado de cobertura
              </button>
            </>
          ) : <p className="small text-muted mb-0">Este cliente no tiene coberturas disponibles para consultar.</p>}
        </div>
      </div>

      {coberturaAbierta && coberturaAbierta.clienteId === clienteId && (
        <HistorialCambiosModal key={`${clienteId}-${coberturaAbierta.id}`} show
          onClose={() => setCoberturaAbierta(null)} modelo="Cobertura" modeloId={coberturaAbierta.id}
          seccion="cobertura" grupoFamiliarId={coberturaAbierta.grupo_familiar_id ?? coberturaAbierta.grupo_familiar?.id} />
      )}

      {/* 🔹 Modal: Historial GF */}
      {showGrupoModal && gfId && (
        <HistorialCambiosModal
          show={showGrupoModal}
          onClose={() => setShowGrupoModal(false)}
          modelo="GrupoFamiliar"
          modeloId={gfId}
        />
      )}

      {/* 🔹 Modal: Historial Cliente */}
      {showClienteModal && clienteId && (
        <HistorialCambiosModal
          show={showClienteModal}
          onClose={() => setShowClienteModal(false)}
          modelo="Cliente"
          modeloId={clienteId}
        />
      )}
    </>
  );
}
