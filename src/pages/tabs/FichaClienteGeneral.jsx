import React from "react";
import { useFichaCliente } from "../../context/fichaClienteContext";
import ProductosButtons from "../../components/fase2/ProductosButtons";
import CotizacionesButtons from "../../components/fase2/CotizacionesButtons";
import PersonaContactoCard from "../../components/fase2/PersonaContactoCard";
import TareasPendientesPanel from "../../components/fase2/TareasPendientesPanel";
import TareasTerminadasPanel from "../../components/fase2/TareasTerminadasPanel";

export default function FichaClienteGeneral() {
  const { cliente, formatDate, coberturaPrincipal } = useFichaCliente();

  // ===== datos derivados =====
  const gfId          = coberturaPrincipal?.grupo_familiar_id ?? cliente?.grupo_familiar_id ?? null;
  const gfResponsable = coberturaPrincipal?.grupo_familiar?.responsable ?? "—";
  const gfEstado      = coberturaPrincipal?.grupo_familiar?.estado_actual_catalogo?.estado_nombre ?? "—";
  const anoCobertura  = coberturaPrincipal?.ano_cobertura ?? "—";
  const codigoPoliza  = coberturaPrincipal?.codigo_poliza ?? "—";
  const companiaId    = coberturaPrincipal?.compania_id ?? cliente?.compania_id ?? "—";

  const companiaNombre =
    coberturaPrincipal?.compania?.nombre ??
    cliente?.compania_nombre ??
    cliente?.compania ??
    "—";

  // Helper: asegura IDs numéricos o null
  const toValidId = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const clienteId = toValidId(cliente?.id);
  const grupoId   = toValidId(gfId);

  return (
    <div className="row g-3">
      {/* Columna izquierda */}
      <div className="col-lg-6">
        <div className="card">
          <div className="card-body">
            <h6 className="mb-3">Resumen</h6>

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
              primary={false}
              addAnother={false}
              onTogglePrimary={(v) => console.log("primary?", v)}
              onToggleAddAnother={(v) => console.log("add another?", v)}
              onChange={(form) => console.log("persona de contacto >", form)}
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
          // ✅ ahora sí mandamos los IDs para que consulte al backend
          clienteId={clienteId}
          grupoId={grupoId}
          perPage={20}
          // Mantén items como fallback por si el back no trae nada
          items={[
            {
              id: 1,
              titulo: "Médicos",
              responsable: "Andrea",
              estado: "pending",         // mejor en minúsculas si usas badges
              fechaLimite: "2025-08-25",
              fechaCreacion: "2025-08-15",
            },
            {
              id: 2,
              titulo: "Facturación Médica",
              responsable: "Cata",
              estado: "processing",
              fechaLimite: "2025-08-30",
              fechaCreacion: "2025-08-17",
            },
          ]}
          onCreate={() => console.log("crear tarea")}
          onOpen={(t) => console.log("abrir", t)}
          onEdit={(t) => console.log("editar", t)}
        />

        <TareasTerminadasPanel
          items={[
            {
              id: 3,
              titulo: "Médicos",
              responsable: "Andrea",
              estado: "Completada",
              fechaCreacion: "2025-08-10",
              fechaTermino: "2025-08-20",
            },
            {
              id: 4,
              titulo: "Facturación Médica",
              responsable: "Cata",
              estado: "Completada",
              fechaCreacion: "2025-08-12",
              fechaTermino: "2025-08-17",
            },
          ]}
          onOpen={(t) => console.log("abrir", t)}
          onEdit={(t) => console.log("editar", t)}
        />
      </div>
    </div>
  );
}
