import React, { useState } from "react";
import ClienteExistente from "../ClienteExistente";
import apiRequest from "../../services/api";
import { unwrapClienteFromApi } from "../../utils/mergeClientePreferNonEmpty";

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

  const normalizeTipo = (v) =>
    (v || "").toString().trim().toUpperCase();

  const toBool = (v) =>
    v === true || v === 1 || v === "1" || v === "true" || v === "TRUE";

  const isBlank = (v) =>
    v === null || v === undefined || v === "";

  const validarCoberturasLocalmente = (clienteBase) => {
    if (!clienteBase) return null;

    const tipoActual = normalizeTipo(defaultCoberturaTipo);

    // Soportar tanto un arreglo de coberturas como campos planos en el cliente
    const coberturas = Array.isArray(clienteBase.coberturas)
      ? clienteBase.coberturas
      : (clienteBase.cobertura_tipo || clienteBase.vigente || clienteBase.activo)
      ? [{
          cobertura_tipo: clienteBase.cobertura_tipo,
          vigente: clienteBase.vigente,
          activo: clienteBase.activo,
          fecha_cancelacion: clienteBase.fecha_cancelacion,
          fecha_retiro: clienteBase.fecha_retiro,
          grupo_familiar_id: clienteBase.grupo_familiar_id,
        }]
      : [];

    if (!coberturas.length) return null;

    const conflicto = coberturas.find((c) => {
      const tipoCob = normalizeTipo(c.cobertura_tipo);
      const estaVigente =
        toBool(c.activo) &&
        isBlank(c.fecha_cancelacion) &&
        isBlank(c.fecha_retiro) &&
        (c.vigente === undefined || c.vigente === null || toBool(c.vigente));

      if (!estaVigente) return false;

      const grupoCob = c.grupo_familiar_id ?? c.grupo_id ?? c.grupoFamiliarId ?? null;

      // Regla: cobertura vigente, mismo producto y perteneciendo a OTRO grupo familiar.
      // Si por alguna razón no viene grupoCob, caemos al bloqueo por producto solamente.
      if (grupoCob && grupoFamiliarId) {
        return tipoCob === tipoActual && Number(grupoCob) !== Number(grupoFamiliarId);
      }

      return tipoCob === tipoActual;
    });

    return conflicto || null;
  };

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
      // Validación rápida con la data que ya viene del buscador
      const conflictoLocal = validarCoberturasLocalmente(cliente);
      if (conflictoLocal) {
        const nombreCliente =
          cliente.nombre_completo ||
          `${cliente.primer_nombre || ""} ${cliente.segundo_nombre || ""} ${cliente.apellidos || cliente.apellido || ""}`.trim() ||
          "Este cliente";

        const descripcionCobertura = [
          conflictoLocal.cobertura_tipo,
          conflictoLocal.compania_nombre || conflictoLocal.compania?.nombre,
          conflictoLocal.codigo_poliza || conflictoLocal.policy_number,
        ]
          .filter(Boolean)
          .join(" - ");

        const grupoTexto = conflictoLocal.grupo_familiar_id
          ? `Grupo familiar #${conflictoLocal.grupo_familiar_id}`
          : null;

        const mensajeDetalle = descripcionCobertura
          ? `Cobertura: ${descripcionCobertura}${grupoTexto ? ` (${grupoTexto})` : ""}`
          : `Cobertura activa/vigente para el mismo producto${grupoTexto ? ` en ${grupoTexto}` : ""}.`;

        if (window?.Swal) {
          window.Swal.fire({
            icon: "warning",
            title: "Cobertura vigente existente",
            html: `
              <p>${nombreCliente} ya pertenece a un grupo familiar con una cobertura <b>activa y vigente</b> para este mismo producto.</p>
              <p style="margin-top:8px;"><small>${mensajeDetalle}</small></p>
              <p style="margin-top:12px;">Debe realizar el <b>retiro o cancelación</b> de la cobertura actual antes de poder agregarlo a este nuevo grupo.</p>
            `,
            confirmButtonText: "Entendido",
          });
        } else {
          window.alert(
            `${nombreCliente} ya pertenece a un grupo familiar con una cobertura activa y vigente para este mismo producto.\n\n` +
            `${mensajeDetalle}\n\n` +
            `Debe retirar o cancelar la cobertura actual antes de agregarlo a este nuevo grupo.`
          );
        }
        return;
      }

      setSaving(true);
      // 1) Cliente del listado (puede venir envuelto en { data }) + GET completo
      let clienteFull = unwrapClienteFromApi(cliente) ?? cliente;
      try {
        const res = await apiRequest(`cliente/${cliente.id}`, "GET");
        if (res && typeof res === "object") {
          const u = unwrapClienteFromApi(res);
          if (u && typeof u === "object") clienteFull = u;
        }
      } catch {
        // Mantener clienteFull desde buscador ya normalizado arriba
      }

      // 2) Entregar al padre el objeto plano con campos en raíz
      await onCreateCoberturaDeClienteExistente?.(payload, clienteFull);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal fade show d-block" style={{backgroundColor:"rgba(0,0,0,0.5)"}}>
      <div className="modal-dialog modal-xl">
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
