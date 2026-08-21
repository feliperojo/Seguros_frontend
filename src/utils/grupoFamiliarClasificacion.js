import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaUserSlash,
  FaUsers,
} from "react-icons/fa";
import { esGrupoEnFlujoCotizacion } from "../constants/estadosGrupoFamiliar";

export const fechaVacia = (fecha) => {
  if (!fecha) return true;
  if (typeof fecha === "string" && fecha.trim() === "") return true;
  return false;
};

const esEstadoCoberturaSi = (estadoCobertura) => {
  const upper = String(estadoCobertura || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return upper === "SI" || upper === "YES";
};

const esVigenteTrue = (cobertura) => {
  if (cobertura.vigente === undefined || cobertura.vigente === null) {
    return true;
  }
  return (
    cobertura.vigente === true ||
    cobertura.vigente === 1 ||
    cobertura.vigente === "1" ||
    cobertura.vigente === "true"
  );
};

const esActivoTrue = (cobertura) => {
  if (cobertura.activo === undefined || cobertura.activo === null) {
    return true;
  }
  return (
    cobertura.activo === true ||
    cobertura.activo === 1 ||
    cobertura.activo === "1" ||
    cobertura.activo === "true"
  );
};

/**
 * Clasifica un miembro alineado al panel:
 * activos reales vs cotización (GF en estados 1–4).
 */
export const clasificarEstadoMiembro = (cobertura, grupo = {}) => {
  const estadoCobertura = cobertura.estado_cobertura || "";
  const estadoCoberturaUpper = estadoCobertura.toUpperCase();
  const fechaCancelacion = cobertura.fecha_cancelacion;
  const fechaRetiro = cobertura.fecha_retiro;
  const enCotizacion = esGrupoEnFlujoCotizacion(
    grupo.estado_codigo ??
      grupo.estado_actual?.codigo ??
      grupo.estado_id ??
      grupo.estado_actual?.estado_id ??
      grupo.estado ??
      grupo.estado_actual?.nombre
  );

  if (!fechaVacia(fechaRetiro)) {
    return {
      categoria: "retirados",
      label: "Retirado",
      variant: "secondary",
      icon: FaUserSlash,
    };
  }

  if (!fechaVacia(fechaCancelacion)) {
    return {
      categoria: "cancelados",
      label: "Cancelado",
      variant: "danger",
      icon: FaTimesCircle,
    };
  }

  const sinFechasInvalidas =
    fechaVacia(fechaCancelacion) && fechaVacia(fechaRetiro);
  const pareceActiva =
    esEstadoCoberturaSi(estadoCobertura) &&
    esActivoTrue(cobertura) &&
    esVigenteTrue(cobertura) &&
    sinFechasInvalidas;

  if (pareceActiva && enCotizacion) {
    return {
      categoria: "cotizacion",
      label: "Cotización",
      variant: "warning",
      icon: FaExclamationTriangle,
    };
  }

  if (pareceActiva) {
    return {
      categoria: "activos_con_cobertura",
      label: "Activo con Cobertura",
      variant: "success",
      icon: FaCheckCircle,
    };
  }

  if (
    estadoCoberturaUpper === "NO" ||
    estadoCobertura === "No" ||
    !estadoCobertura ||
    estadoCobertura.trim() === ""
  ) {
    return {
      categoria: "sin_cobertura",
      label: "Sin Cobertura",
      variant: "warning",
      icon: FaExclamationTriangle,
    };
  }

  return {
    categoria: "otros_estados",
    label: estadoCobertura || "Sin definir",
    variant: "info",
    icon: FaUsers,
  };
};

export const getCoberturaTiposGrupo = (grupo) => {
  const tipos = [
    ...new Set(
      (grupo.coberturas || [])
        .map((c) => (c.cobertura_tipo || "").trim())
        .filter(Boolean)
    ),
  ];
  return tipos;
};

export const getTomadorNombreDeGrupo = (grupo) => {
  const tomador = (grupo.coberturas || []).find(
    (c) => c.parentesco?.toUpperCase() === "TOMADOR"
  );
  return (
    tomador?.cliente?.nombre_completo ||
    grupo.tomador_nombre ||
    grupo.persona_contacto ||
    "Sin asignar"
  );
};

/**
 * Normaliza payload full/listado para clasificación y UI.
 */
export const normalizarGrupoParaClasificacion = (grupo) => {
  if (!grupo || typeof grupo !== "object") return grupo;
  return {
    ...grupo,
    estado_codigo:
      grupo.estado_codigo ||
      grupo.estado_actual?.codigo ||
      null,
    estado_id:
      grupo.estado_id ||
      grupo.estado_actual?.estado_id ||
      null,
    estado:
      grupo.estado ||
      grupo.estado_actual?.nombre ||
      grupo.estado_actual_catalogo?.estado_nombre ||
      "Sin estado",
  };
};

export const clasificarGrupoFamiliar = (grupoRaw) => {
  const grupo = normalizarGrupoParaClasificacion(grupoRaw);
  const coberturas = grupo.coberturas || [];

  const miembrosClasificados = coberturas.map((cobertura) => ({
    ...cobertura,
    estadoClasificado: clasificarEstadoMiembro(cobertura, grupo),
  }));

  const porCategoria = {
    activos_con_cobertura: miembrosClasificados.filter(
      (m) => m.estadoClasificado.categoria === "activos_con_cobertura"
    ),
    cotizacion: miembrosClasificados.filter(
      (m) => m.estadoClasificado.categoria === "cotizacion"
    ),
    cancelados: miembrosClasificados.filter(
      (m) => m.estadoClasificado.categoria === "cancelados"
    ),
    retirados: miembrosClasificados.filter(
      (m) => m.estadoClasificado.categoria === "retirados"
    ),
    sin_cobertura: miembrosClasificados.filter(
      (m) => m.estadoClasificado.categoria === "sin_cobertura"
    ),
    otros_estados: miembrosClasificados.filter(
      (m) => m.estadoClasificado.categoria === "otros_estados"
    ),
  };

  const estadisticas = {
    total: miembrosClasificados.length,
    activos_con_cobertura: porCategoria.activos_con_cobertura.length,
    cotizacion: porCategoria.cotizacion.length,
    cancelados: porCategoria.cancelados.length,
    retirados: porCategoria.retirados.length,
    sin_cobertura: porCategoria.sin_cobertura.length,
    otros_estados: porCategoria.otros_estados.length,
  };

  return {
    ...grupo,
    miembrosClasificados,
    porCategoria,
    estadisticas,
    coberturaTipos: getCoberturaTiposGrupo(grupo),
    tomadorNombre: getTomadorNombreDeGrupo(grupo),
  };
};
