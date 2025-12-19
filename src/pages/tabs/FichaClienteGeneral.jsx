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

  // ===== helper para formatear número con distribución 3-3-4 =====
  const formatearNumeroTelefono = (numero) => {
    if (!numero) return "";
    // Remover todos los caracteres no numéricos
    const soloDigitos = numero.toString().replace(/\D/g, "");
    // Aplicar formato 3-3-4 si tiene 10 dígitos
    if (soloDigitos.length === 10) {
      return `${soloDigitos.slice(0, 3)}-${soloDigitos.slice(3, 6)}-${soloDigitos.slice(6)}`;
    }
    // Si no tiene 10 dígitos, devolver el número original
    return numero;
  };

  // ===== formatear teléfonos del cliente =====
  const telefonosFormateados = useMemo(() => {
    // Normalizar telefonos: puede venir como array, string JSON, o null
    let telefonos = [];
    if (Array.isArray(cliente?.telefonos)) {
      telefonos = cliente.telefonos;
    } else if (typeof cliente?.telefonos === "string" && cliente.telefonos.trim().startsWith("[")) {
      try {
        telefonos = JSON.parse(cliente.telefonos);
        if (!Array.isArray(telefonos)) telefonos = [];
      } catch (_) {
        telefonos = [];
      }
    }
    
    if (telefonos.length === 0) {
      // Fallback al campo legacy si no hay arreglo
      return cliente?.telefono ? [cliente.telefono] : [];
    }

    // Ordenar: principal primero
    const ordenados = [...telefonos].sort(
      (a, b) => (b?.principal ? 1 : 0) - (a?.principal ? 1 : 0)
    );

    // Formatear cada teléfono
    return ordenados.map((t) => {
      const indicativo = t?.indicativo ? `+${t.indicativo} ` : "";
      const numeroFormateado = formatearNumeroTelefono(t?.numero || "");
      const tipo = t?.tipo ? ` (${t.tipo})` : "";
      const principal = t?.principal ? " [Principal]" : "";
      return `${indicativo}${numeroFormateado}${tipo}${principal}`.trim();
    });
  }, [cliente?.telefonos, cliente?.telefono]);

  // mocks opcionales
  const USE_DEMO = false;

  return (
    <div className="row g-4">
      {/* Columna izquierda */}
      <div className="col-lg-7">
        <div className="card border">
          <div className="card-body">
            {/* Header con título y selector de grupo */}
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
              <h6 className="mb-0 fw-semibold text-dark">RESUMEN DEL CLIENTE</h6>
              <div style={{ minWidth: "180px" }}>
                {grupos.length > 1 ? (
                  <select
                    className="form-select form-select-sm border-secondary"
                    value={selectedGrupoId ?? ""}
                    onChange={(e) => setSelectedGrupoId(toValidId(e.target.value))}
                  >
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        Grupo Familiar {g.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-end">
                    <span className="text-dark fw-normal">GF {gfId ?? "—"}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sección: Datos Personales */}
            <div className="mb-3">
              <h6 className="text-dark border-bottom pb-1 mb-2" style={{ fontSize: "0.85rem", fontWeight: "600", letterSpacing: "0.5px" }}>
                DATOS PERSONALES
              </h6>
              <div className="row g-2">
                <div className="col-md-6">
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Nombre Completo</label>
                    <div className="text-dark small">{cliente?.nombre_completo ?? "—"}</div>
                  </div>
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Fecha de Nacimiento</label>
                    <div className="text-dark small">{formatDate(cliente?.fecha_nacimiento) ?? "—"}</div>
                  </div>
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Edad</label>
                    <div className="text-dark small">{cliente?.edad ?? "—"} {cliente?.edad ? "años" : ""}</div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>ID Cliente</label>
                    <div className="text-dark small">{cliente?.id ?? "—"}</div>
                  </div>
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Idioma</label>
                    <div className="text-dark small">{cliente?.idioma || "—"}</div>
                  </div>
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Estado</label>
                    <div className="text-dark small">{cliente?.estado ?? "—"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sección: Información de Contacto */}
            <div className="mb-3">
              <h6 className="text-dark border-bottom pb-1 mb-2" style={{ fontSize: "0.85rem", fontWeight: "600", letterSpacing: "0.5px" }}>
                INFORMACIÓN DE CONTACTO
              </h6>
              <div className="row g-2">
                <div className="col-12">
                  <label className="text-muted small d-block mb-1" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Teléfonos</label>
                  {telefonosFormateados.length > 0 ? (
                    <div className="d-flex flex-column gap-1">
                      {telefonosFormateados.map((tel, idx) => (
                        <div key={idx} className="text-dark small">
                          {tel}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted small">—</div>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Medio de Contacto</label>
                  <div className="text-dark small">{cliente?.medio_contacto ?? "—"}</div>
                </div>
              </div>
            </div>

            {/* Sección: Grupo Familiar y Póliza */}
            <div className="mb-3">
              <h6 className="text-dark border-bottom pb-1 mb-2" style={{ fontSize: "0.85rem", fontWeight: "600", letterSpacing: "0.5px" }}>
                GRUPO FAMILIAR Y PÓLIZA
              </h6>
              <div className="row g-2">
                <div className="col-md-6">
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>ID Grupo Familiar</label>
                    <div className="text-dark small">GF {gfId ?? "—"}</div>
                  </div>
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Asesor / Responsable</label>
                    <div className="text-dark small fw-normal">{gfResponsable}</div>
                  </div>
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Relación</label>
                    <div className="text-dark small">{cliente?.parentesco ?? "—"}</div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Estado del Grupo</label>
                    <div className="text-dark small">{gfEstado}</div>
                  </div>
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Compañía</label>
                    <div className="text-dark small fw-normal">{companiaNombre}</div>
                    {companiaId !== "—" && (
                      <div className="text-muted" style={{ fontSize: "0.7rem" }}>ID: {companiaId}</div>
                    )}
                  </div>
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Código de Póliza</label>
                    <div className="text-dark small">{codigoPoliza}</div>
                  </div>
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Año de Cobertura</label>
                    <div className="text-dark small">{anoCobertura}</div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="my-3 border-secondary opacity-25" />

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
      <div className="col-lg-5">
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
