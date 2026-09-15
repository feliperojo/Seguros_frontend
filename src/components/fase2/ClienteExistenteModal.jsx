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

const mostrarAviso = (title, html, plainText) => {
  if (window?.Swal) {
    window.Swal.fire({
      icon: "warning",
      title,
      html,
      confirmButtonText: "Entendido",
    });
  } else {
    window.alert(plainText || title);
  }
};

export default function ClienteExistenteModal({
  open,
  onClose,
  grupoFamiliarId,
  defaultCoberturaTipo = "Plan de salud",
  onCreateCoberturaDeClienteExistente,   // (payload, cliente) => Promise
  contexto = "grupo", // "grupo" | "pre_renovacion"
  loteId = null,
  anioDestino = null,
}) {
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState("");

  if (!open) return null;

  const isBlank = (v) =>
    v === null || v === undefined || v === "" || String(v).trim() === "null";

  const normalizarEstado = (valor) =>
    String(valor || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  /** Mismo producto solo se libera con retiro (no con cancelación). */
  const esCoberturaRetirada = (c = {}) => {
    if (!isBlank(c.fecha_retiro)) return true;
    const definidos = [c.cobertura_definida, c.estado_cobertura];
    const pareceRetiro = definidos.some((valor) => {
      const norm = normalizarEstado(valor);
      return norm === "retirado" || norm === "retirada" || norm === "terminado";
    });
    return pareceRetiro && isBlank(c.fecha_cancelacion);
  };

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
      if (!sonMismoProductoParaConflicto(defaultCoberturaTipo, c.cobertura_tipo)) {
        return false;
      }
      // Cancelado / activo / anulado del mismo producto bloquean; solo retiro libera.
      if (esCoberturaRetirada(c)) return false;

      const grupoCob = c.grupo_familiar_id ?? c.grupo_id ?? c.grupoFamiliarId ?? null;

      // Mismo producto no retirado en OTRO grupo familiar.
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

      // En grupo familiar: mismo producto solo si está retirado (Cancelado bloquea).
      // En pre-renovación: el check de elegibilidad (mismo backend) valida
      // origen con pre-renovación + no renovar / otra pre-renovación.
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

          mostrarAviso(
            "Mismo producto en otro grupo",
            `
              <p>${nombreCliente} ya tiene <b>${defaultCoberturaTipo}</b> en otro grupo familiar.</p>
              <p style="margin-top:8px;"><small>${mensajeDetalle}</small></p>
              <p style="margin-top:12px;">Solo se puede agregar si ese producto está <b>retirado</b> (con fecha de retiro) en el otro grupo, o si el producto es <b>distinto</b>. Cancelado no habilita el alta.</p>
            `,
            `${nombreCliente} ya tiene ${defaultCoberturaTipo} en otro grupo familiar.\n\n` +
              `${mensajeDetalle}\n\n` +
              `Solo se puede agregar si está retirado en el otro grupo, o si el producto es distinto. Cancelado no habilita el alta.`
          );
          return;
        }
      } else if (grupoFamiliarId && loteId) {
        setSaving(true);
        try {
          const tipoParam = encodeURIComponent(defaultCoberturaTipo || "");
          const check = await apiRequest(
            `grupo_familiar/${grupoFamiliarId}/pre-renovacion/${loteId}/elegibilidad-cliente?cliente_id=${cliente.id}&cobertura_tipo=${tipoParam}`,
            "GET"
          );
          const elegible = check?.elegible === true;
          if (!elegible) {
            const motivo =
              check?.motivo ||
              "Este cliente no puede agregarse a esta pre-renovación todavía.";
            mostrarAviso(
              "No se puede agregar",
              `<p>${motivo}</p>`,
              motivo
            );
            return;
          }
        } catch (err) {
          const motivo =
            err?.message ||
            "No se pudo validar la elegibilidad del cliente para esta pre-renovación.";
          mostrarAviso("No se puede agregar", `<p>${motivo}</p>`, motivo);
          return;
        } finally {
          setSaving(false);
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
                {contexto === "pre_renovacion" ? (
                  <>
                    En pre-renovación: si la persona tiene cobertura activa en otro grupo,
                    ese grupo debe tener pre-renovación abierta y la persona marcada como{" "}
                    <strong>no renovar</strong> antes de agregarla aquí.
                  </>
                ) : (
                  <>
                    En grupo familiar: se puede agregar solo si el producto es{" "}
                    <strong>distinto</strong>, o si en el otro grupo ese mismo producto
                    está <strong>retirado</strong> (fecha de retiro).{" "}
                    <strong>Cancelado no permite</strong> agregarlo.
                  </>
                )}
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
                aquí para el año destino
                {anioDestino ? ` (${anioDestino})` : ""}. Si ya figura en otra
                pre-renovación del mismo año, debe quedar <strong>no activa para
                renovar</strong> allí. El tomador de otro grupo no se traslada por
                este camino, salvo que ese grupo esté en No renovará o Terminado.
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
