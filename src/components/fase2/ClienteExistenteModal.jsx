import React, { useState } from "react";
import ClienteExistente from "../ClienteExistente";
import apiRequest from "../../services/api";
import { unwrapClienteFromApi } from "../../utils/mergeClientePreferNonEmpty";
import {
  isProductoPrivadoIndependiente,
  sonMismoProductoParaConflicto,
} from "../../constants/coberturaTipos";
import "../../styles/GfModal.css";

const TYPE_COLOR = {
  Tomador: "primary", Conyuge: "info", "Hijo/a": "success", Hermano: "secondary",
  Dependiente: "secondary", Padre: "dark", Madre: "danger", Nieto: "warning",
  "Abuelo/a": "warning", "Suegro/a": "warning", "Tio/a": "warning", "Sobrino/a": "warning",
};
const TIPOS = ["Tomador","Conyuge","Hijo/a","Hermano","Padre","Madre","Nieto","Abuelo/a","Suegro/a","Tio/a","Sobrino/a"];

/** Badge visual del producto criterio (privados + salud). */
const badgeClassProducto = (tipo = "") => {
  const t = String(tipo || "").toLowerCase();
  if (t.includes("dental") && !t.includes("ms")) return "bg-info text-dark";
  if (t.includes("vision") || t.includes("visión")) return "bg-success";
  if (t.includes("vida")) return "bg-danger";
  if (t.includes("descuento")) return "bg-warning text-dark";
  if (isProductoPrivadoIndependiente(tipo)) return "bg-secondary";
  return "bg-primary";
};

export default function ClienteExistenteModal({
  open,
  onClose,
  grupoFamiliarId,
  defaultCoberturaTipo = "Plan de salud",
  onCreateCoberturaDeClienteExistente,   // (payload, cliente) => Promise
  contexto = "grupo", // "grupo" | "pre_renovacion"
}) {
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState("");

  if (!open) return null;

  const toBool = (v) =>
    v === true || v === 1 || v === "1" || v === "true" || v === "TRUE";

  const isBlank = (v) =>
    v === null || v === undefined || v === "";

  const validarCoberturasLocalmente = (clienteBase) => {
    if (!clienteBase) return null;

    // Soportar tanto un arreglo de coberturas como campos planos en el cliente
    const coberturas = Array.isArray(clienteBase.coberturas)
      ? clienteBase.coberturas
      : (clienteBase.cobertura_tipo || clienteBase.vigente || clienteBase.activo || clienteBase.estado_cobertura)
      ? [{
          cobertura_tipo: clienteBase.cobertura_tipo,
          vigente: clienteBase.vigente,
          activo: clienteBase.activo,
          estado_cobertura: clienteBase.estado_cobertura,
          cobertura_definida: clienteBase.cobertura_definida,
          fecha_cancelacion: clienteBase.fecha_cancelacion,
          fecha_retiro: clienteBase.fecha_retiro,
          fecha_anulacion: clienteBase.fecha_anulacion,
          grupo_familiar_id: clienteBase.grupo_familiar_id,
        }]
      : [];

    if (!coberturas.length) return null;

    const conflicto = coberturas.find((c) => {
      const estaVigente =
        toBool(c.activo) &&
        isBlank(c.fecha_cancelacion) &&
        isBlank(c.fecha_retiro) &&
        isBlank(c.fecha_anulacion) &&
        (c.vigente === undefined || c.vigente === null || toBool(c.vigente));

      if (!estaVigente) return false;
      if (!sonMismoProductoParaConflicto(defaultCoberturaTipo, c.cobertura_tipo)) {
        return false;
      }

      const grupoCob = c.grupo_familiar_id ?? c.grupo_id ?? c.grupoFamiliarId ?? null;

      // Regla: cobertura vigente, mismo producto y perteneciendo a OTRO grupo familiar.
      // Si por alguna razón no viene grupoCob, caemos al bloqueo por producto solamente.
      if (grupoCob && grupoFamiliarId) {
        return Number(grupoCob) !== Number(grupoFamiliarId);
      }

      return true;
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
      const esPreRenovacion = contexto === "pre_renovacion";

      // En grupo familiar: no duplicar cobertura vigente del mismo producto.
      // En pre-renovación: sí puede tener cobertura 2026 en otro grupo; el año
      // entrante se valida en backend (no estar en otra pre-renovación).
      if (!esPreRenovacion) {
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
              <p>${nombreCliente} ya pertenece a un grupo familiar con una cobertura <b>activa y vigente</b> para este mismo producto (<b>${defaultCoberturaTipo}</b>).</p>
              <p style="margin-top:8px;"><small>${mensajeDetalle}</small></p>
              <p style="margin-top:12px;">Debe realizar el <b>retiro o cancelación</b> de la cobertura actual antes de poder agregarlo a este nuevo grupo.</p>
            `,
              confirmButtonText: "Entendido",
            });
          } else {
            window.alert(
              `${nombreCliente} ya pertenece a un grupo familiar con una cobertura activa y vigente para este mismo producto (${defaultCoberturaTipo}).\n\n` +
              `${mensajeDetalle}\n\n` +
              `Debe retirar o cancelar la cobertura actual antes de agregarlo a este nuevo grupo.`
            );
          }
          return;
        }
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
    } catch {
      // El padre muestra el error; el modal permanece abierto para corregir.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal fade show d-block gf-modal" style={{backgroundColor:"rgba(0,0,0,0.5)", zIndex: 1075}}>
      <div className="modal-dialog modal-xl gf-modal gf-modal--xl">
        <div className="modal-content gf-modal__content">

          <div className="modal-header gf-modal__header">
            <div className="gf-modal__header-main" style={{ justifyContent: "space-between" }}>
              <div style={{ minWidth: 0 }}>
                <h5 className="modal-title gf-modal__title mb-1">Agregar cliente existente</h5>
                <div className="small" style={{ color: "rgba(255,255,255,0.9)" }}>
                  Criterio de producto:{" "}
                  <span className={`badge ${badgeClassProducto(defaultCoberturaTipo)}`}>
                    {defaultCoberturaTipo || "Plan de salud"}
                  </span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" />
            </div>
          </div>

          <div className="modal-body gf-modal__body">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3 p-2 border rounded bg-light">
              <span className="text-muted small mb-0">Producto seleccionado del grupo:</span>
              <span className={`badge fs-6 ${badgeClassProducto(defaultCoberturaTipo)}`}>
                {defaultCoberturaTipo || "Plan de salud"}
              </span>
              <span className="text-muted small mb-0">
                Criterio para todos los productos (Salud MS y privados: Plan Dental,
                Vision, Vida, Descuentos). Solo bloquea si ya tiene <strong>este mismo</strong> producto activo.
              </span>
            </div>

            <div className="row g-2 align-items-center mb-3">
              <div className="col-auto">
                <label className="form-label mb-0">Tipo de miembro <span className="text-danger">*</span></label>
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
                Seleccione el tipo de miembro (Tomador, Cónyuge, etc.) antes de buscar.
                El producto ya está fijado: <strong>{defaultCoberturaTipo || "Plan de salud"}</strong>.
              </div>
            )}

            {contexto === "pre_renovacion" && (
              <div className="alert alert-info mb-3">
                Si la persona ya está en otro grupo este año, primero hay que
                abrir la pre-renovación de <strong>ese grupo</strong> y marcarla
                como <strong>no renovar</strong>. Solo después se puede agregar
                aquí para el año destino. El tomador de otro grupo no se
                traslada por este camino, salvo que ese grupo esté en No renovará
                o Terminado.
              </div>
            )}

            {/* Buscador/listado de clientes existentes */}
            <ClienteExistente
              onClienteSeleccionado={handlePick}
              contexto={contexto}
              coberturaTipoDestino={defaultCoberturaTipo}
            />
          </div>

          <div className="modal-footer gf-modal__footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cerrar</button>
          </div>

        </div>
      </div>
    </div>
  );
}
