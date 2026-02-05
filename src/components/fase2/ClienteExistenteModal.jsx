import React, { useState } from "react";
import ClienteExistente from "../ClienteExistente";
import apiRequest from "../../services/api";

const TYPE_COLOR = {
  Tomador: "primary", Conyuge: "info", "Hijo/a": "success", Hermano: "secondary",
  Dependiente: "secondary", Padre: "dark", Madre: "danger", Nieto: "warning",
  "Abuelo/a": "warning", "Suegro/a": "warning", "Tio/a": "warning", "Sobrino/a": "warning",
};
const TIPOS = ["Tomador","Conyuge","Hijo/a","Hermano","Padre","Madre","Nieto","Abuelo/a","Suegro/a","Tio/a","Sobrino/a"];

export default function ClienteExistenteModal({
  open,
  onClose,
  grupoFamiliarId,
  defaultCoberturaTipo = "Plan de salud",
  onCreateCoberturaDeClienteExistente,   // (payload, cliente) => Promise
}) {
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState("");

  if (!open) return null;

  const handlePick = async (cliente) => {
    if (!cliente?.id) return;
    if (!tipo || tipo.trim() === "") {
      return; // No permitir seleccionar cliente sin tipo
    }

    const payload = {
      grupo_familiar_id: grupoFamiliarId,
      cliente_id: cliente.id,
      parentesco: tipo,
      tipo,
      cobertura_tipo: defaultCoberturaTipo,
      estado_cobertura: "Sí",
    };

    try {
      setSaving(true);
    // 1) Traer el cliente completo por id (para hidratar la card)
     //    Si en tu API existe un parámetro tipo hydrate=full, úsalo aquí.
     //    Ej: apiRequest(`cliente/${cliente.id}?hydrate=full`, "GET")
     let clienteFull = null;
     try {
       const res = await apiRequest(`cliente/${cliente.id}`, "GET");
       // Asegura forma objeto
       clienteFull = (res && typeof res === "object") ? res : cliente;
     } catch {
       // fallback: si falla, usa lo que venía del buscador
       clienteFull = cliente;
     }


     // 2) Entregar al padre SIEMPRE el cliente completo
     await onCreateCoberturaDeClienteExistente?.(payload, clienteFull);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal fade show d-block" style={{backgroundColor:"rgba(0,0,0,0.5)"}}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">

          <div className="modal-header">
            <h5 className="modal-title">Agregar cliente existente</h5>
            <button className="btn-close" onClick={onClose}/>
          </div>

          <div className="modal-body">
            <div className="row g-2 align-items-center mb-3">
              <div className="col-auto">
                <label className="form-label mb-0">Tipo <span className="text-danger">*</span></label>
              </div>
              <div className="col-auto">
                <select
                  className="form-select form-select-sm"
                  value={tipo}
                  onChange={(e)=>setTipo(e.target.value)}
                  required
                >
                  <option value="">Seleccione un tipo</option>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {tipo && (
                <div className="col-auto">
                  <span className={`badge bg-${TYPE_COLOR[tipo]||"secondary"}`}>{tipo}</span>
                </div>
              )}
            </div>

            {!tipo && (
              <div className="alert alert-info mb-3">
                <i className="bi bi-info-circle me-2"></i>
                Por favor, seleccione un tipo de cliente antes de buscar y agregar.
              </div>
            )}

            {/* Buscador/listado de clientes existentes */}
            <ClienteExistente onClienteSeleccionado={handlePick} />
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cerrar</button>
          </div>

        </div>
      </div>
    </div>
  );
}
