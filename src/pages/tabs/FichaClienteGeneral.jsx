import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useFichaCliente } from "../../context/fichaClienteContext";
import ProductosButtons from "../../components/fase2/ProductosButtons";
import CotizacionesButtons from "../../components/fase2/CotizacionesButtons";
import ProductosDescartadosButtons from "../../components/fase2/ProductosDescartadosButtons";
import PersonaContactoCard from "../../components/fase2/PersonaContactoCard";
import TareasPendientesPanel from "../../components/fase2/TareasPendientesPanel";
import TareasTerminadasPanel from "../../components/fase2/TareasTerminadasPanel";
import GroupTags from "../../components/GroupTags";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import { FaBirthdayCake } from "react-icons/fa";
import { Badge } from "react-bootstrap";
import {
  derivarEstadoPoliza,
  estadoPolizaBadgeVariant,
  getCoberturasFromGrupoFull,
  resolverCoberturaClienteEnGrupo,
  resolverCoberturasProductoClienteEnGrupo,
} from "../../utils/estadoPoliza";
import {
  esProcesoInicialGrupoFamiliar,
  esGrupoFamiliarTerminado,
  esProcesoAntesDeTerminado,
  normalizeEstadoGrupoCodigo,
  labelEstadoGrupoParaDisplay,
} from "../../constants/estadosGrupoFamiliar";
import { isDentalCoberturaTipo } from "../../constants/coberturaTipos";
import {
  prepararCorreosContacto,
  prepararTelefonosContacto,
} from "../../utils/contactoFicha";
import { miembrosVisiblesDelGrupo } from "../../utils/miembrosGrupoFicha";
import useToast from "../../hooks/useToast";
import "../../styles/FichaClienteGeneral.css";

const copiarTextoPlano = async (texto) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // El navegador puede bloquear el portapapeles; se intenta el respaldo.
  }

  try {
    const input = document.createElement("textarea");
    input.value = texto;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(input);
    return ok;
  } catch {
    return false;
  }
};

export default function FichaClienteGeneral() {
  const { cliente, formatDate, coberturaPrincipal } = useFichaCliente();
  const toast = useToast();

  // ===== helpers =====
  const toValidId = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // Formatea el valor de la póliza para mostrarlo como monto legible
  const formatearPrecioPoliza = (valor) => {
    if (valor === null || valor === undefined || valor === "") return "—";
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return String(valor);
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numero);
    } catch {
      return numero.toFixed(2);
    }
  };

  // ===== construir opciones de grupos disponibles =====
  const grupoInicial =
    coberturaPrincipal?.grupo_familiar_id ??
    cliente?.grupo_familiar_id ??
    null;

  const grupos = useMemo(() => {
    const arr = [];

    // 1) desde coberturas (suele venir la info más rica)
    const gfIdPrincipal = toValidId(
      coberturaPrincipal?.grupo_familiar_id ??
      coberturaPrincipal?.grupo_familiar?.id ??
      null
    );
      for (const c of Array.isArray(cliente?.coberturas) ? cliente.coberturas : []) {
      const id =
        c?.grupo_familiar_id ??
        c?.grupo_familiar?.id ??
        c?.gf_id ??
        null;
      if (!toValidId(id)) continue;

      // Solo usar "coberturaPrincipal" para estado si es realmente la MISMA cobertura.
      // Si no, puede “contaminar” el estado del grupo con datos de otra cobertura.
      const esMismaCobertura =
        toValidId(coberturaPrincipal?.id) != null &&
        toValidId(c?.id) != null &&
        toValidId(coberturaPrincipal?.id) === toValidId(c?.id);

      const coberturaParaEstado = esMismaCobertura ? coberturaPrincipal : c;

      const { estado, fecha, tipoFecha } = derivarEstadoPoliza(
        coberturaParaEstado
      );

      arr.push({
        id: toValidId(id),
        coberturaTipo:
          c?.cobertura_tipo ||
          coberturaPrincipal?.cobertura_tipo ||
          "Sin producto",
        responsable: c?.grupo_familiar?.responsable ?? c?.responsable ?? "—",
        estado: c?.grupo_familiar?.estado_actual_catalogo?.estado_nombre ?? c?.estado_gf ?? c?.estado ?? "—",
        anoCobertura: c?.ano_cobertura ?? c?.anio ?? c?.year ?? "—",
        codigoPoliza: c?.codigo_poliza ?? c?.poliza ?? c?.policy_code ?? "—",
        companiaId: c?.compania_id ?? c?.compania?.id ?? cliente?.compania_id ?? "—",
        companiaNombre:
          c?.compania?.nombre ??
          c?.compania_nombre ??
          cliente?.compania_nombre ??
          cliente?.compania ??
          "—",
        estadoPoliza: estado,
        fechaEstadoPoliza: fecha,
        tipoFechaEstadoPoliza: tipoFecha,
        precioPoliza: c?.precio ?? null,
        raw: c,
      });
    }

    // 2) fallback: si no hubo coberturas, intenta desde el propio cliente
    if (arr.length === 0 && toValidId(cliente?.grupo_familiar_id)) {
      const { estado, fecha, tipoFecha } = derivarEstadoPoliza(
        coberturaPrincipal ?? cliente?.grupo_familiar
      );

      arr.push({
        id: toValidId(cliente?.grupo_familiar_id),
        coberturaTipo:
          coberturaPrincipal?.cobertura_tipo ||
          cliente?.cobertura_tipo ||
          "Sin producto",
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
        estadoPoliza: estado,
        fechaEstadoPoliza: fecha,
        tipoFechaEstadoPoliza: tipoFecha,
        precioPoliza: coberturaPrincipal?.precio ?? null,
        raw: cliente?.grupo_familiar ?? null,
      });
    }

    // desduplicar por id (preferir salud si Dental MS llegó primero)
    const unique = Object.values(
      arr.reduce((acc, g) => {
        if (g?.id == null) return acc;
        const prev = acc[g.id];
        if (!prev) {
          acc[g.id] = g;
        } else if (
          isDentalCoberturaTipo(prev.coberturaTipo) &&
          !isDentalCoberturaTipo(g.coberturaTipo)
        ) {
          acc[g.id] = g;
        }
        return acc;
      }, {})
    );

    // orden simple por id asc
    unique.sort((a, b) => a.id - b.id);
    return unique;
  }, [cliente, coberturaPrincipal]);

  // ===== grupo seleccionado (desde el contexto compartido) =====
  const { selectedGrupoId, setSelectedGrupoId } = useFichaCliente();

  // si cambia el cliente / cobertura principal, reasigna default usando el setter del contexto
  useEffect(() => {
    if (setSelectedGrupoId && grupoInicial !== null) {
      setSelectedGrupoId(toValidId(grupoInicial));
    }
  }, [grupoInicial, setSelectedGrupoId]);

  const currentGrupo = useMemo(() => {
    const selectedId = toValidId(selectedGrupoId);
    if (!selectedId) return grupos[0] ?? null;
    return (
      grupos.find((g) => toValidId(g.id) === selectedId) ??
      grupos[0] ??
      null
    );
  }, [grupos, selectedGrupoId]);

  // ===== Estado para grupos full (fuente de verdad del endpoint) y etiquetas =====
  const [gruposFullCache, setGruposFullCache] = useState({});
  const [loadingEtiquetas, setLoadingEtiquetas] = useState(false);
  const [errorCargaGrupos, setErrorCargaGrupos] = useState(false);
  const [miembrosAbiertos, setMiembrosAbiertos] = useState(false);

  const uniqueGrupoIds = useMemo(() => {
    const ids = new Set();
    for (const c of Array.isArray(cliente?.coberturas) ? cliente.coberturas : []) {
      const id = toValidId(c?.grupo_familiar_id ?? c?.grupo_familiar?.id);
      if (id) ids.add(id);
    }
    if (ids.size === 0 && toValidId(cliente?.grupo_familiar_id)) {
      ids.add(toValidId(cliente.grupo_familiar_id));
    }
    return [...ids].sort((a, b) => a - b);
  }, [cliente?.coberturas, cliente?.grupo_familiar_id]);

  const grupoFull = useMemo(() => {
    const selectedId = toValidId(selectedGrupoId) ?? toValidId(currentGrupo?.id);
    return selectedId ? gruposFullCache[selectedId] ?? null : null;
  }, [gruposFullCache, selectedGrupoId, currentGrupo?.id]);

  const etiquetasGrupo = useMemo(() => {
    const base = grupoFull ?? {};
    const tagsRaw = base?.tags || base?.etiquetas || [];
    let tagsArray = [];

    if (Array.isArray(tagsRaw)) {
      tagsArray = tagsRaw;
    } else if (typeof tagsRaw === "string" && tagsRaw.trim().startsWith("[")) {
      try {
        tagsArray = JSON.parse(tagsRaw);
        if (!Array.isArray(tagsArray)) tagsArray = [];
      } catch {
        tagsArray = [];
      }
    }

    return tagsArray.filter(
      (tag) =>
        tag &&
        typeof tag === "object" &&
        tag.key &&
        tag.label &&
        tag.color
    );
  }, [grupoFull]);

  // ===== cobertura seleccionada por grupo (fuente de verdad para estado/fechas) =====
  const coberturaSeleccionada = useMemo(() => {
    const selectedId = toValidId(selectedGrupoId) ?? toValidId(currentGrupo?.id);
    if (!selectedId) return coberturaPrincipal ?? null;

    const coberturasFuente = getCoberturasFromGrupoFull(grupoFull);
    const coberturas =
      coberturasFuente.length > 0
        ? coberturasFuente
        : Array.isArray(cliente?.coberturas)
        ? cliente.coberturas
        : [];

    if (coberturas.length === 0) return coberturaPrincipal ?? null;

    const porProducto = resolverCoberturasProductoClienteEnGrupo(
      coberturas,
      selectedId,
      cliente?.id
    );

    return (
      porProducto.salud ??
      porProducto.dental ??
      resolverCoberturaClienteEnGrupo(coberturas, selectedId, cliente?.id) ??
      coberturaPrincipal ??
      null
    );
  }, [
    grupoFull,
    cliente?.coberturas,
    cliente?.id,
    selectedGrupoId,
    currentGrupo?.id,
    coberturaPrincipal,
  ]);

  /** Productos del cliente en el GF actual (salud y/o dental) para cards de póliza */
  const productosPoliza = useMemo(() => {
    const selectedId = toValidId(selectedGrupoId) ?? toValidId(currentGrupo?.id);
    if (!selectedId) {
      if (!coberturaPrincipal) return [];
      const key = isDentalCoberturaTipo(coberturaPrincipal?.cobertura_tipo)
        ? "dental"
        : "salud";
      return [{ key, cobertura: coberturaPrincipal }];
    }

    const coberturasFuente = getCoberturasFromGrupoFull(grupoFull);
    const coberturas =
      coberturasFuente.length > 0
        ? coberturasFuente
        : Array.isArray(cliente?.coberturas)
        ? cliente.coberturas
        : [];

    const { productos } = resolverCoberturasProductoClienteEnGrupo(
      coberturas,
      selectedId,
      cliente?.id
    );

    if (productos.length > 0) return productos;

    if (coberturaPrincipal) {
      const key = isDentalCoberturaTipo(coberturaPrincipal?.cobertura_tipo)
        ? "dental"
        : "salud";
      return [{ key, cobertura: coberturaPrincipal }];
    }

    return [];
  }, [
    grupoFull,
    cliente?.coberturas,
    cliente?.id,
    selectedGrupoId,
    currentGrupo?.id,
    coberturaPrincipal,
  ]);

  const resolveCoberturaParaEstado = useCallback(
    (c) => {
      const gf = toValidId(c?.grupo_familiar_id ?? c?.grupo_familiar?.id);
      if (!gf) return c;

      const fuenteGrupo = getCoberturasFromGrupoFull(gruposFullCache[gf]);
      const fuente =
        fuenteGrupo.length > 0
          ? fuenteGrupo
          : Array.isArray(cliente?.coberturas)
          ? cliente.coberturas
          : [];

      const coberturaId = toValidId(c?.id);
      if (coberturaId) {
        const misma = fuente.find((x) => toValidId(x?.id) === coberturaId);
        if (misma) return misma;
      }

      const { salud, dental } = resolverCoberturasProductoClienteEnGrupo(
        fuente,
        gf,
        cliente?.id
      );

      if (isDentalCoberturaTipo(c?.cobertura_tipo)) {
        return dental ?? c;
      }

      return salud ?? resolverCoberturaClienteEnGrupo(fuente, gf, cliente?.id) ?? c;
    },
    [gruposFullCache, cliente?.coberturas, cliente?.id]
  );

  // ===== datos derivados visibles según grupo seleccionado =====
  const labelGrupoSelector = (g) => {
    const id = g?.id ?? "—";
    return `ID de grupo · GF ${id}`;
  };

  /** Salud (+ dental adjunto como icono); evita card duplicada de Dental MS. */
  const productosPolizaVista = useMemo(() => {
    const salud = productosPoliza.find((p) => p.key === "salud") ?? null;
    const dental = productosPoliza.find((p) => p.key === "dental") ?? null;
    if (salud) {
      return [{ key: "salud", cobertura: salud.cobertura, conDental: Boolean(dental) }];
    }
    if (dental) {
      return [{ key: "dental", cobertura: dental.cobertura, conDental: false }];
    }
    return [];
  }, [productosPoliza]);

  const gfId          = currentGrupo?.id ?? null;
  const gfResponsable = currentGrupo?.responsable ?? "—";
  const gfEstado      = currentGrupo?.estado ?? "—";

  const parentescoCobertura =
    coberturaSeleccionada?.parentesco ??
    coberturaSeleccionada?.relacion ??
    cliente?.parentesco ??
    "—";

  const esEstadoDescartado = useMemo(() => {
    const estadoNormalizado = String(gfEstado ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    return estadoNormalizado === "descartado";
  }, [gfEstado]);

  const codigoProcesoGrupo = useMemo(() => {
    const codigoRaw =
      currentGrupo?.raw?.grupo_familiar?.estado_actual_catalogo?.estado_codigo ??
      currentGrupo?.raw?.estado_actual_catalogo?.estado_codigo ??
      currentGrupo?.raw?.estado_codigo ??
      grupoFull?.estado_actual?.codigo ??
      grupoFull?.estado_codigo ??
      gfEstado;
    return normalizeEstadoGrupoCodigo(codigoRaw);
  }, [currentGrupo, grupoFull, gfEstado]);

  // Prospecto / Cotización / Seguimiento: aún no mostrar estado de póliza real
  const ocultarEstadoPolizaPorProcesoInicial = useMemo(
    () => esProcesoInicialGrupoFamiliar(codigoProcesoGrupo),
    [codigoProcesoGrupo]
  );

  // Póliza solo aplica cuando el GF ya está en Terminado
  const mostrarSeccionPoliza = useMemo(
    () => !!gfId && esGrupoFamiliarTerminado(codigoProcesoGrupo),
    [gfId, codigoProcesoGrupo]
  );

  // Hay GF en proceso (antes de Terminado): mostrar contexto, no póliza
  const mostrarContextoProceso = useMemo(() => {
    if (!gfId || mostrarSeccionPoliza) return false;
    if (esProcesoAntesDeTerminado(codigoProcesoGrupo) || esEstadoDescartado) {
      return true;
    }
    // GF asociado pero etapa aún no es Terminado (o código desconocido)
    return !esGrupoFamiliarTerminado(codigoProcesoGrupo);
  }, [gfId, mostrarSeccionPoliza, codigoProcesoGrupo, esEstadoDescartado]);

  const sinGrupoFamiliar = !gfId;

  const procesoDisplayLabel = useMemo(
    () => labelEstadoGrupoParaDisplay(codigoProcesoGrupo || gfEstado),
    [codigoProcesoGrupo, gfEstado]
  );

  const clienteId = toValidId(cliente?.id);
  const grupoId   = toValidId(gfId);

  const miembrosGrupo = useMemo(
    () => miembrosVisiblesDelGrupo(getCoberturasFromGrupoFull(grupoFull), clienteId),
    [grupoFull, clienteId]
  );

  useEffect(() => {
    setMiembrosAbiertos(false);
  }, [grupoId]);

  // ===== Cargar datos completos de todos los grupos familiares del cliente =====
  useEffect(() => {
    if (!uniqueGrupoIds.length) {
      setGruposFullCache({});
      setErrorCargaGrupos(false);
      return;
    }

    let cancelled = false;
    setLoadingEtiquetas(true);
    setErrorCargaGrupos(false);

    (async () => {
      try {
        const results = await Promise.all(
          uniqueGrupoIds.map((id) => GrupoFamiliarService.getFullById(id))
        );
        if (cancelled) return;

        const cache = {};
        uniqueGrupoIds.forEach((id, i) => {
          cache[id] = results[i]?.data ?? results[i] ?? null;
        });
        setGruposFullCache(cache);
      } catch (error) {
        if (!cancelled) {
          console.error("Error al cargar grupos familiares:", error);
          setGruposFullCache({});
          setErrorCargaGrupos(true);
        }
      } finally {
        if (!cancelled) setLoadingEtiquetas(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uniqueGrupoIds.join(",")]);

  const copiarContacto = async (texto, mensaje) => {
    const valor = String(texto ?? "").trim();
    if (!valor) return;
    const copiado = await copiarTextoPlano(valor);
    if (copiado) {
      toast.showSuccess(mensaje, { autoClose: 1600 });
      return;
    }
    toast.showError("No se pudo copiar.", { autoClose: 2500 });
  };

  // ===== verificar si es cumpleaños hoy =====
  const esCumpleanosHoy = useMemo(() => {
    const fechaNacimiento = cliente?.fecha_nacimiento;
    if (!fechaNacimiento) return false;
    try {
      const hoy = new Date();
      // Usar UTC para evitar problemas de zona horaria
      let nacimiento;
      if (typeof fechaNacimiento === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaNacimiento)) {
        const [year, month, day] = fechaNacimiento.split('T')[0].split('-');
        nacimiento = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      } else {
        const date = new Date(fechaNacimiento);
        nacimiento = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      }
      
      const hoyUTC = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
      
      return (
        hoyUTC.getUTCMonth() === nacimiento.getUTCMonth() &&
        hoyUTC.getUTCDate() === nacimiento.getUTCDate()
      );
    } catch {
      return false;
    }
  }, [cliente?.fecha_nacimiento]);

  const telefonosContacto = useMemo(
    () => prepararTelefonosContacto(cliente),
    [cliente]
  );
  const correosContacto = useMemo(
    () => prepararCorreosContacto(cliente?.email),
    [cliente?.email]
  );

  // mocks opcionales
  const USE_DEMO = false;

  return (
    <div className="ficha-page">
      <div className="row g-3">
        {/* Columna izquierda */}
        <div className="col-lg-7">
            <div className="ficha-shell">
              <div
                className={`ficha-section ficha-section--toolbar${
                  esCumpleanosHoy ? " ficha-section--birthday" : ""
                }`}
              >
                <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                  <div>
                    <h2 className="ficha-toolbar__title mb-0">
                      Resumen del cliente
                      {esCumpleanosHoy && (
                        <span className="ficha-shell__birthday">
                          <FaBirthdayCake /> ¡Cumpleaños de hoy!
                        </span>
                      )}
                    </h2>
                    <p className="ficha-toolbar__subtitle mb-0">
                      Datos personales, contacto y pólizas del grupo seleccionado
                    </p>
                  </div>
                  <div>
                    {grupos.length > 1 ? (
                      <select
                        className="form-select form-select-sm"
                        value={toValidId(selectedGrupoId) ?? ""}
                        onChange={(e) => setSelectedGrupoId(toValidId(e.target.value))}
                        style={{ minWidth: "200px", borderRadius: "8px" }}
                      >
                        {grupos.map((g) => (
                          <option key={g.id} value={g.id}>
                            {labelGrupoSelector(g)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="ficha-value" style={{ fontSize: "0.8125rem" }}>
                        {currentGrupo
                          ? labelGrupoSelector(currentGrupo)
                          : sinGrupoFamiliar
                          ? "Sin grupo familiar"
                          : `GF ${gfId ?? "—"}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="ficha-shell__body ficha-shell__body--flush">
              <div className="ficha-section">
                <h6 className="ficha-section__title">
                  <i className="fas fa-id-card" aria-hidden="true" />
                  Datos personales
                </h6>
                <div className="ficha-fields">
                  <div className="ficha-field">
                    <label className="ficha-label">Nombre completo</label>
                    <div className="ficha-value">{cliente?.nombre_completo ?? "—"}</div>
                  </div>
                  <div className="ficha-field">
                    <label className="ficha-label">ID cliente</label>
                    <div className="ficha-value">{cliente?.id ?? "—"}</div>
                  </div>
                  <div className="ficha-field">
                    <label className="ficha-label">Fecha de nacimiento</label>
                    <div
                      className={`ficha-value d-flex align-items-center gap-2${
                        esCumpleanosHoy ? " ficha-value--birthday" : ""
                      }`}
                    >
                      {formatDate(cliente?.fecha_nacimiento) ?? "—"}
                      {esCumpleanosHoy && <FaBirthdayCake />}
                    </div>
                  </div>
                  <div className="ficha-field">
                    <label className="ficha-label">Idioma</label>
                    <div className="ficha-value">{cliente?.idioma || "—"}</div>
                  </div>
                  <div className="ficha-field">
                    <label className="ficha-label">Edad</label>
                    <div className="ficha-value">
                      {cliente?.edad ?? "—"}
                      {cliente?.edad ? " años" : ""}
                    </div>
                  </div>
                  <div className="ficha-field">
                    <label className="ficha-label">Estado</label>
                    <div className="ficha-value">{cliente?.estado ?? "—"}</div>
                  </div>
                </div>
              </div>

              <div className="ficha-section">
                <h6 className="ficha-section__title">
                  <i className="fas fa-phone" aria-hidden="true" />
                  Información de contacto
                </h6>
                <div className="ficha-fields">
                  <div className="ficha-field ficha-field--wide">
                    <label className="ficha-label">Teléfonos</label>
                    {telefonosContacto.length > 0 ? (
                      <div className="ficha-contacto">
                        {telefonosContacto.map((tel, idx) => (
                          <div key={tel.id ?? `${tel.visible}-${idx}`} className="ficha-contacto__item">
                            <div className="ficha-contacto__dato">
                              <span className="ficha-value ficha-contacto__numero">
                                {tel.bandera && (
                                  <span
                                    className="ficha-contacto__bandera"
                                    role="img"
                                    aria-label={tel.pais || "País del indicativo"}
                                  >
                                    {tel.bandera}
                                  </span>
                                )}
                                {tel.numero || tel.visible}
                              </span>
                              {(tel.tipo || tel.principal) && (
                                <span className="ficha-contacto__etiquetas">
                                  {tel.tipo && (
                                    <span className="ficha-contacto__etiqueta">{tel.tipo}</span>
                                  )}
                                  {tel.principal && (
                                    <span className="ficha-contacto__etiqueta ficha-contacto__etiqueta--principal">
                                      Principal
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            {(tel.whatsapp || tel.llamar || tel.copiar) && (
                              <div
                                className="ficha-contacto__acciones"
                                role="group"
                                aria-label={`Acciones para ${tel.copiar || tel.visible}`}
                              >
                                {tel.whatsapp && (
                                  <a
                                    className="ficha-contacto__accion"
                                    href={tel.whatsapp}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`WhatsApp ${tel.copiar || tel.visible}`}
                                  >
                                    <i className="fab fa-whatsapp" aria-hidden="true" />
                                    WhatsApp
                                  </a>
                                )}
                                {tel.llamar && (
                                  <a
                                    className="ficha-contacto__accion"
                                    href={tel.llamar}
                                    aria-label={`Llamar a ${tel.copiar || tel.visible}`}
                                  >
                                    <i className="fas fa-phone" aria-hidden="true" />
                                    Llamar
                                  </a>
                                )}
                                {tel.copiar && (
                                  <button
                                    type="button"
                                    className="ficha-contacto__accion"
                                    aria-label={`Copiar número ${tel.copiar}`}
                                    onClick={() => copiarContacto(tel.copiar, "Número copiado")}
                                  >
                                    <i className="fas fa-copy" aria-hidden="true" />
                                    Copiar número
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ficha-value ficha-value--muted">—</div>
                    )}
                  </div>
                  <div className="ficha-field ficha-field--wide">
                    <label className="ficha-label">Correo</label>
                    {correosContacto.length > 0 ? (
                      <div className="ficha-contacto">
                        {correosContacto.map((correo, idx) => (
                          <div key={`${correo.visible}-${idx}`} className="ficha-contacto__item">
                            <div className="ficha-contacto__dato">
                              <span className="ficha-value ficha-contacto__numero">{correo.visible}</span>
                            </div>
                            <div
                              className="ficha-contacto__acciones"
                              role="group"
                              aria-label={`Acciones para ${correo.visible}`}
                            >
                              {correo.mailto && (
                                <a
                                  className="ficha-contacto__accion"
                                  href={correo.mailto}
                                  aria-label={`Enviar correo a ${correo.visible}`}
                                >
                                  <i className="fas fa-envelope" aria-hidden="true" />
                                  Enviar correo
                                </a>
                              )}
                              <button
                                type="button"
                                className="ficha-contacto__accion"
                                aria-label={`Copiar correo ${correo.visible}`}
                                onClick={() => copiarContacto(correo.copiar, "Correo copiado")}
                              >
                                <i className="fas fa-copy" aria-hidden="true" />
                                Copiar correo
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ficha-value ficha-value--muted">—</div>
                    )}
                  </div>
                  <div className="ficha-field">
                    <label className="ficha-label">Medio de contacto</label>
                    <div className="ficha-value">{cliente?.medio_contacto ?? "—"}</div>
                  </div>
                </div>
              </div>

              {sinGrupoFamiliar && (
                <div className="ficha-section">
                  <h6 className="ficha-section__title">
                    <i className="fas fa-users" aria-hidden="true" />
                    Grupo familiar
                  </h6>
                  <div className="ficha-alert">
                    No hay grupo familiar asociado. Los datos de póliza no aplican hasta
                    vincular a un GF y completar el proceso hasta <strong>Terminado</strong>.
                  </div>
                </div>
              )}

              {mostrarContextoProceso && (
                <div className="ficha-section">
                  <h6 className="ficha-section__title">
                    <i className="fas fa-sitemap" aria-hidden="true" />
                    Contexto del grupo familiar
                  </h6>
                  <div className="ficha-fields">
                    <div className="ficha-field">
                      <label className="ficha-label">Proceso</label>
                      <div
                        className={`ficha-value${
                          esEstadoDescartado ? " ficha-value--danger" : ""
                        }`}
                      >
                        {procesoDisplayLabel}
                      </div>
                    </div>
                    <div className="ficha-field">
                      <label className="ficha-label">Relación en el grupo</label>
                      <div className="ficha-value">{parentescoCobertura}</div>
                    </div>
                    <div className="ficha-field">
                      <label className="ficha-label">Asesor / Responsable</label>
                      <div className="ficha-value">{gfResponsable}</div>
                    </div>
                  </div>
                  {grupoId && (
                    <div className="ficha-tags">
                      <label className="ficha-label">Etiquetas del grupo familiar</label>
                      {loadingEtiquetas ? (
                        <div className="ficha-value ficha-value--muted">
                          <i className="fas fa-spinner fa-spin me-2" />
                          Cargando etiquetas...
                        </div>
                      ) : (
                        <GroupTags
                          value={etiquetasGrupo}
                          onChange={() => {}}
                          readOnly={true}
                          className="mb-0"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {mostrarSeccionPoliza && (
                <div className="ficha-section">
                  <h6 className="ficha-section__title">
                    <i className="fas fa-file-medical" aria-hidden="true" />
                    Grupo familiar y póliza
                  </h6>
                  <div className="ficha-fields">
                    <div className="ficha-field">
                      <label className="ficha-label">Proceso</label>
                      <div
                        className={`ficha-value${
                          esEstadoDescartado ? " ficha-value--danger" : ""
                        }`}
                      >
                        {procesoDisplayLabel}
                      </div>
                    </div>
                    <div className="ficha-field">
                      <label className="ficha-label">Asesor / Responsable</label>
                      <div className="ficha-value">{gfResponsable}</div>
                    </div>
                    <div className="ficha-field">
                      <label className="ficha-label">Relación</label>
                      <div className="ficha-value">{parentescoCobertura}</div>
                    </div>
                  </div>

                  {grupoId && (
                    <div className="ficha-tags">
                      <label className="ficha-label">Etiquetas del grupo familiar</label>
                      {loadingEtiquetas ? (
                        <div className="ficha-value ficha-value--muted">
                          <i className="fas fa-spinner fa-spin me-2" />
                          Cargando etiquetas...
                        </div>
                      ) : (
                        <GroupTags
                          value={etiquetasGrupo}
                          onChange={() => {}}
                          readOnly={true}
                          className="mb-0"
                        />
                      )}
                    </div>
                  )}

                  {productosPolizaVista.length > 0 && (
                    <div className="ficha-poliza-productos">
                      {productosPolizaVista.map(({ key, cobertura, conDental }) => {
                        const esDentalSolo = key === "dental";
                        const titulo =
                          cobertura?.cobertura_tipo ||
                          (esDentalSolo ? "Dental MS" : "Plan de salud");
                        const estadoDerivado = derivarEstadoPoliza(cobertura);
                        const estado = estadoDerivado?.estado ?? "Vigente";
                        const fechaEstado = estadoDerivado?.fecha ?? null;
                        const tipoFecha = estadoDerivado?.tipoFecha ?? null;
                        const compania =
                          cobertura?.compania?.nombre ??
                          cobertura?.compania_nombre ??
                          "—";
                        const companiaIdLocal =
                          cobertura?.compania_id ?? cobertura?.compania?.id ?? null;
                        const codigo =
                          cobertura?.codigo_poliza ??
                          cobertura?.policy_number ??
                          "—";
                        const precio = cobertura?.precio ?? null;
                        const anio = cobertura?.ano_cobertura ?? "—";

                        return (
                          <div
                            key={`${key}-${cobertura?.id ?? titulo}`}
                            className={`ficha-poliza-card${
                              esDentalSolo ? " ficha-poliza-card--dental" : ""
                            }`}
                          >
                            <div className="ficha-poliza-card__header">
                              <span className="ficha-poliza-card__icons" aria-hidden="true">
                                {esDentalSolo ? (
                                  <span className="ficha-poliza-card__icon ficha-poliza-card__icon--dental">
                                    <i className="fas fa-tooth" />
                                  </span>
                                ) : (
                                  <>
                                    <span className="ficha-poliza-card__icon">
                                      <i className="fas fa-heartbeat" />
                                    </span>
                                    {conDental && (
                                      <span
                                        className="ficha-poliza-card__icon ficha-poliza-card__icon--dental"
                                        title="Dental MS"
                                      >
                                        <i className="fas fa-tooth" />
                                      </span>
                                    )}
                                  </>
                                )}
                              </span>
                              <h6 className="ficha-poliza-card__title">{titulo}</h6>
                            </div>
                            <div className="ficha-poliza-card__fields">
                              <div>
                                <label className="ficha-label">Compañía</label>
                                <div className="ficha-value">{compania}</div>
                                {companiaIdLocal != null && (
                                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                                    ID: {companiaIdLocal}
                                  </div>
                                )}
                              </div>
                              <div>
                                <label className="ficha-label">Año de cobertura</label>
                                <div className="ficha-value">{anio}</div>
                              </div>
                              <div>
                                <label className="ficha-label">Código de póliza</label>
                                <div className="ficha-value">{codigo}</div>
                              </div>
                              <div>
                                <label className="ficha-label">Valor de la póliza</label>
                                <div className="ficha-value">
                                  {formatearPrecioPoliza(precio)}
                                </div>
                              </div>
                              {!esEstadoDescartado &&
                                !ocultarEstadoPolizaPorProcesoInicial && (
                                  <div className="ficha-poliza-field--full">
                                    <label className="ficha-label">Estado de la póliza</label>
                                    <div className="ficha-value">
                                      <Badge
                                        bg={estadoPolizaBadgeVariant(estado)}
                                        className="text-uppercase"
                                        style={{ fontSize: "0.7rem" }}
                                      >
                                        {estado}
                                      </Badge>
                                      {fechaEstado && (
                                        <div
                                          className="mt-1 text-muted"
                                          style={{ fontSize: "0.7rem" }}
                                        >
                                          {tipoFecha === "cancelacion" &&
                                            "Fecha de expiración: "}
                                          {tipoFecha === "retiro" && "Fecha de retiro: "}
                                          {!tipoFecha && "Fecha: "}
                                          {formatDate(fechaEstado)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {loadingEtiquetas && !grupoFull ? (
                    <p className="ficha-miembros__estado">
                      <i className="fas fa-spinner fa-spin me-2" aria-hidden="true" />
                      Cargando miembros...
                    </p>
                  ) : errorCargaGrupos && !grupoFull ? (
                    <p className="ficha-miembros__estado">No se pudieron cargar los miembros.</p>
                  ) : miembrosGrupo.length === 0 ? (
                    <p className="ficha-miembros__estado">Sin otros miembros vinculados</p>
                  ) : (
                    <div className="ficha-miembros">
                      <button
                        type="button"
                        className="ficha-miembros__toggle"
                        aria-expanded={miembrosAbiertos}
                        aria-controls="ficha-miembros-panel"
                        onClick={() => setMiembrosAbiertos((abierto) => !abierto)}
                      >
                        <span>
                          Miembros del grupo familiar
                          <span className="ficha-miembros__cantidad"> · {miembrosGrupo.length}</span>
                        </span>
                        <span className="ficha-miembros__accion">
                          Ver miembros
                          <i
                            className={`fas fa-chevron-down ficha-miembros__chevron${
                              miembrosAbiertos ? " is-open" : ""
                            }`}
                            aria-hidden="true"
                          />
                        </span>
                      </button>
                      {miembrosAbiertos && (
                        <ul id="ficha-miembros-panel" className="ficha-miembros__lista">
                          {miembrosGrupo.map((miembro) => (
                            <li key={miembro.clienteId} className="ficha-miembros__item">
                              <div className="min-w-0">
                                <div className="ficha-value">{miembro.nombre}</div>
                                <div className="ficha-miembros__relacion">
                                  {miembro.relacion || "Sin relación registrada"}
                                </div>
                                {miembro.coberturas.length > 0 && (
                                  <div className="ficha-miembros__coberturas">
                                    {miembro.coberturas.map((cobertura) => (
                                      <div key={cobertura}>{cobertura}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <Link
                                to={`/clientes/${miembro.clienteId}/ficha`}
                                className="ficha-miembros__abrir"
                              >
                                Abrir ficha
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="ficha-stack">
                <PersonaContactoCard
                  className="mb-0"
                  clienteId={clienteId}
                  grupoFamiliarId={grupoId}
                  grupoContextLabel=""
                  primary={false}
                  addAnother={false}
                  onTogglePrimary={(v) => console.log("primary?", v)}
                  onToggleAddAnother={(v) => console.log("add another?", v)}
                  onChange={(form) => console.log("persona de contacto >", form)}
                  onSaved={({ contacto, link }) => {}}
                  idiomaOptions={["Spanish", "English"]}
                  relacionOptions={[
                    "Cónyuge",
                    "Hijo/a",
                    "Padre/Madre",
                    "Hermano/a",
                    "Amigo/a",
                    "Otro",
                  ]}
                />

                <ProductosButtons
                  className="mb-0"
                  coberturas={cliente?.coberturas ?? []}
                  resolveCobertura={resolveCoberturaParaEstado}
                  onSelectCobertura={(c) => console.log("Producto (GF):", c)}
                />

                <CotizacionesButtons
                  className="mb-0"
                  coberturas={cliente?.coberturas ?? []}
                  resolveCobertura={resolveCoberturaParaEstado}
                  onSelectCobertura={(c) => console.log("Cotización:", c)}
                />

                <ProductosDescartadosButtons
                  className="mb-0"
                  coberturas={cliente?.coberturas ?? []}
                  resolveCobertura={resolveCoberturaParaEstado}
                  onSelectCobertura={(c) =>
                    console.log("Producto descartado (GF):", c)
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="col-lg-5 ficha-aside">
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
          />
        </div>
      </div>
    </div>
  );
}
