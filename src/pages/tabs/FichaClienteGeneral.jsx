import React, { useMemo, useState, useEffect } from "react";
import { useFichaCliente } from "../../context/fichaClienteContext";
import ProductosButtons from "../../components/fase2/ProductosButtons";
import CotizacionesButtons from "../../components/fase2/CotizacionesButtons";
import PersonaContactoCard from "../../components/fase2/PersonaContactoCard";
import TareasPendientesPanel from "../../components/fase2/TareasPendientesPanel";
import TareasTerminadasPanel from "../../components/fase2/TareasTerminadasPanel";

export default function FichaClienteGeneral() {
  const { cliente, formatDate, coberturaPrincipal } = useFichaCliente();

  // ===== helpers =====
  const toValidId = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // ===== construir opciones de grupos disponibles =====
  const grupoInicial =
    coberturaPrincipal?.grupo_familiar_id ??
    cliente?.grupo_familiar_id ??
    null;

  const grupos = useMemo(() => {
    const arr = [];

    // 1) desde coberturas (suele venir la info más rica)
    for (const c of Array.isArray(cliente?.coberturas) ? cliente.coberturas : []) {
      const id =
        c?.grupo_familiar_id ??
        c?.grupo_familiar?.id ??
        c?.gf_id ??
        null;
      if (!toValidId(id)) continue;

      arr.push({
        id: toValidId(id),
        responsable: c?.grupo_familiar?.responsable ?? c?.responsable ?? "—",
        estado: c?.grupo_familiar?.estado_actual_catalogo?.estado_nombre ?? c?.estado_gf ?? c?.estado ?? "—",
        anoCobertura: c?.ano_cobertura ?? c?.anio ?? c?.year ?? "—",
        codigoPoliza: c?.codigo_poliza ?? c?.poliza ?? c?.policy_code ?? "—",
        companiaId: c?.compania_id ?? c?.compania?.id ?? cliente?.compania_id ?? "—",
        companiaNombre: c?.compania?.nombre ?? c?.compania_nombre ?? cliente?.compania_nombre ?? cliente?.compania ?? "—",
        raw: c,
      });
    }

    // 2) fallback: si no hubo coberturas, intenta desde el propio cliente
    if (arr.length === 0 && toValidId(cliente?.grupo_familiar_id)) {
      arr.push({
        id: toValidId(cliente?.grupo_familiar_id),
        responsable: cliente?.grupo_familiar?.responsable ?? "—",
        estado: cliente?.grupo_familiar?.estado_actual_catalogo?.estado_nombre ?? cliente?.estado ?? "—",
        anoCobertura: coberturaPrincipal?.ano_cobertura ?? "—",
        codigoPoliza: coberturaPrincipal?.codigo_poliza ?? "—",
        companiaId: coberturaPrincipal?.compania_id ?? cliente?.compania_id ?? "—",
        companiaNombre:
          coberturaPrincipal?.compania?.nombre ??
          cliente?.compania_nombre ??
          cliente?.compania ??
          "—",
        raw: cliente?.grupo_familiar ?? null,
      });
    }

    // desduplicar por id
    const unique = Object.values(
      arr.reduce((acc, g) => {
        if (g?.id != null) acc[g.id] = acc[g.id] ?? g;
        return acc;
      }, {})
    );

    // orden simple por id asc
    unique.sort((a, b) => a.id - b.id);
    return unique;
  }, [cliente, coberturaPrincipal]);

  // ===== grupo seleccionado =====
  const [selectedGrupoId, setSelectedGrupoId] = useState(toValidId(grupoInicial));

  // si cambia el cliente / cobertura principal, reasigna default
  useEffect(() => {
    setSelectedGrupoId(toValidId(grupoInicial));
  }, [grupoInicial]);

  const currentGrupo = useMemo(() => {
    if (!selectedGrupoId) return grupos[0] ?? null;
    return grupos.find((g) => g.id === selectedGrupoId) ?? grupos[0] ?? null;
  }, [grupos, selectedGrupoId]);

  // ===== datos derivados visibles según grupo seleccionado =====
  const gfId          = currentGrupo?.id ?? null;
  const gfResponsable = currentGrupo?.responsable ?? "—";
  const gfEstado      = currentGrupo?.estado ?? "—";
  const anoCobertura  = currentGrupo?.anoCobertura ?? "—";
  const codigoPoliza  = currentGrupo?.codigoPoliza ?? "—";
  const companiaId    = currentGrupo?.companiaId ?? "—";
  const companiaNombre = currentGrupo?.companiaNombre ??
    coberturaPrincipal?.compania?.nombre ??
    cliente?.compania_nombre ??
    cliente?.compania ??
    "—";

  const clienteId = toValidId(cliente?.id);
  const grupoId   = toValidId(gfId);

  // mocks opcionales
  const USE_DEMO = false;

  return (
    <div className="row g-3">
      {/* Columna izquierda */}
      <div className="col-lg-6">
        <div className="card">
          <div className="card-body">
            <h6 className="mb-3">Resumen</h6>

            {/* Selector de Grupo Familiar (inteligente) */}
            <div className="mb-2">
              <label className="form-label small mb-1"><strong>Grupo Familiar</strong></label>
              {grupos.length > 1 ? (
                <select
                  className="form-select form-select-sm"
                  value={selectedGrupoId ?? ""}
                  onChange={(e) => setSelectedGrupoId(toValidId(e.target.value))}
                >
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      GF {g.id}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="small">GF {gfId ?? "—"}</div>
              )}
              <div className="form-text">
                Cambia el grupo para ver información y tareas de ese grupo.
              </div>
            </div>

            <div className="row small g-2">
              <div className="col-md-6">
                <div><strong>Nombre Completo:</strong> {cliente?.nombre_completo ?? "—"}</div>
                <div><strong>Fecha de Nacimiento:</strong> {formatDate(cliente?.fecha_nacimiento)}</div>
                <div><strong>Idioma:</strong> {cliente?.idioma || "—"}</div>
                <div><strong>ID Cliente:</strong> {cliente?.id ?? "—"}</div>
                <div><strong>Compañía:</strong> {companiaNombre}</div>
                <div><strong>Estado:</strong> {cliente?.estado ?? "—"}</div>
                <div><strong>Teléfono:</strong> {cliente?.telefono ?? "—"}</div>
                <div><strong>Medio de Contacto:</strong> {cliente?.medio_contacto ?? "—"}</div>
              </div>

              <div className="col-md-6">
                <div><strong>Asesor:</strong> {gfResponsable}</div>
                <div><strong>Edad:</strong> {cliente?.edad ?? "—"}</div>
                <div><strong>ID Grupo Familiar:</strong> {gfId ?? "—"}</div>
                <div><strong>ID Compañía:</strong> {companiaId}</div>
                <div><strong>Código Póliza:</strong> {codigoPoliza}</div>
                <div><strong>Año Cobertura:</strong> {anoCobertura}</div>
                <div><strong>Relación:</strong> {cliente?.parentesco ?? "—"}</div>
                <div><strong>Estado GF:</strong> {gfEstado}</div>
              </div>
            </div>

            <hr />

            <PersonaContactoCard
  className="mb-3"
  clienteId={clienteId}           // <- importante
  grupoFamiliarId={grupoId}       // <- importante
  primary={false}
  addAnother={false}
  onTogglePrimary={(v) => console.log("primary?", v)}
  onToggleAddAnother={(v) => console.log("add another?", v)}
  onChange={(form) => console.log("persona de contacto >", form)}
  onSaved={({ contacto, link }) => {
    // refrescar UI si quieres
  }}
  idiomaOptions={["Spanish", "English"]}
  relacionOptions={["Cónyuge", "Hijo/a", "Padre/Madre", "Hermano/a", "Amigo/a", "Otro"]}
/>


            <ProductosButtons
              className="mb-3"
              coberturas={cliente?.coberturas ?? []}
              onSelectCobertura={(c) => console.log("Producto (GF):", c)}
            />

            <CotizacionesButtons
              className="mb-3"
              coberturas={cliente?.coberturas ?? []}
              onSelectCobertura={(c) => console.log("Cotización:", c)}
            />
          </div>
        </div>
      </div>

      {/* Columna derecha */}
      <div className="col-lg-6">
        <TareasPendientesPanel
          className="mb-3"
          clienteId={clienteId}
          grupoId={grupoId}
          perPage={20}
          emptyMessage="No se tienen tareas pendientes o en progreso."
          items={USE_DEMO ? [] : []}
          onCreate={() => console.log("crear tarea")}
          onOpen={(t) => console.log("abrir", t)}
          onEdit={(t) => console.log("editar", t)}
        />

        <TareasTerminadasPanel
          className="mb-3"
          clienteId={clienteId}
          grupoId={grupoId}
          perPage={20}
          emptyMessage="No se tienen tareas terminadas."
          onOpen={(t) => console.log("abrir", t)}
          onEdit={(t) => console.log("editar", t)}
        />
      </div>
    </div>
  );
}
