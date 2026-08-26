import React, { useMemo, useState, useEffect, useCallback } from "react";
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
import "../../styles/FichaClienteGeneral.css";

export default function FichaClienteGeneral() {
  const { cliente, formatDate, coberturaPrincipal } = useFichaCliente();

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
    const producto = (g?.coberturaTipo || "Sin producto").trim();
    const id = g?.id ?? "—";
    return `${producto} · GF ${id}`;
  };

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

  // ===== Cargar datos completos de todos los grupos familiares del cliente =====
  useEffect(() => {
    if (!uniqueGrupoIds.length) {
      setGruposFullCache({});
      return;
    }

    let cancelled = false;
    setLoadingEtiquetas(true);

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
        }
      } finally {
        if (!cancelled) setLoadingEtiquetas(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uniqueGrupoIds.join(",")]);

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
                  <div className="ficha-field">
                    <label className="ficha-label">Teléfonos</label>
                    {telefonosFormateados.length > 0 ? (
                      <div className="d-flex flex-column gap-1">
                        {telefonosFormateados.map((tel, idx) => (
                          <div key={idx} className="ficha-value">
                            {tel}
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
                      <label className="ficha-label">ID grupo familiar</label>
                      <div className="ficha-value">GF {gfId}</div>
                    </div>
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
                      <label className="ficha-label">ID grupo familiar</label>
                      <div className="ficha-value">GF {gfId ?? "—"}</div>
                    </div>
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

                  {productosPoliza.length > 0 && (
                    <div className="ficha-poliza-productos">
                      {productosPoliza.map(({ key, cobertura }) => {
                        const esDental = key === "dental";
                        const titulo =
                          cobertura?.cobertura_tipo ||
                          (esDental ? "Dental MS" : "Plan de salud");
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
                              esDental ? " ficha-poliza-card--dental" : ""
                            }`}
                          >
                            <div className="ficha-poliza-card__header">
                              <span className="ficha-poliza-card__icon" aria-hidden="true">
                                <i
                                  className={
                                    esDental ? "fas fa-tooth" : "fas fa-heartbeat"
                                  }
                                />
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
