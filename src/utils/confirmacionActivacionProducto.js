export function estadoInicialConfirmacionActivacion() {
  return {
    confirmoActivacion: false,
    preview: null,
    previewLoading: false,
    previewError: "",
  };
}

export function puedeConfirmarActivacion({
  confirmoActivacion = false,
  preview = null,
  previewLoading = false,
  previewError = "",
} = {}) {
  if (confirmoActivacion !== true) return false;
  if (previewLoading || previewError) return false;
  if (!preview || preview.confirmable === false) return false;
  return typeof preview.huella === "string" && preview.huella.length === 64;
}

export function camposConfirmacionActivacion(extra) {
  if (extra?.confirmar_activacion !== true) return {};

  const body = {
    confirmar_activacion: true,
    confirmar_pagos_iniciales: true,
  };
  if (typeof extra.huella === "string" && extra.huella) {
    body.huella = extra.huella;
  }
  return body;
}

export function previewSigueVigente(solicitudId, solicitudVigente) {
  return solicitudId === solicitudVigente;
}
