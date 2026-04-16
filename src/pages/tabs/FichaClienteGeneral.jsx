import React, { useMemo, useState, useEffect } from "react";
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

export default function FichaClienteGeneral() {
  const { cliente, formatDate, coberturaPrincipal } = useFichaCliente();

  // ===== helpers =====
  const toValidId = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  // Deriva el estado de la póliza basándose en los campos "vigente" y "activo"
  // y retorna también la fecha relevante (retiro / cancelación) y su tipo.
  const derivarEstadoPoliza = (c) => {
    try {
      if (!c || typeof c !== "object") {
        return { estado: "Vigente", fecha: null, tipoFecha: null };
      }

      const estadoCoberturaRaw =
        c?.estado_cobertura != null ? String(c.estado_cobertura).trim() : "";
      const estadoCoberturaNormalizado = estadoCoberturaRaw.toLowerCase();
      const estadoCoberturaMostrar =
        estadoCoberturaNormalizado === "no"
          ? "Sin cobertura"
          : estadoCoberturaRaw;
      const mostrarEstadoCoberturaDirecto =
        estadoCoberturaNormalizado === "no" ||
        estadoCoberturaNormalizado === "medicare" ||
        estadoCoberturaNormalizado === "medicaid" ||
        estadoCoberturaNormalizado === "medicai";

      const activo =
        c?.activo !== undefined && c?.activo !== null
          ? c.activo === true || c.activo === "true" || c.activo === 1
          : true;
      const vigente =
        c?.vigente !== undefined && c?.vigente !== null
          ? c.vigente === true || c.vigente === "true" || c.vigente === 1
          : true;

      const fechaRetiroValida =
        c?.fecha_retiro &&
        String(c.fecha_retiro).trim() &&
        String(c.fecha_retiro) !== "null"
          ? String(c.fecha_retiro)
          : null;

      const fechaCancelacionValida =
        c?.fecha_cancelacion &&
        String(c.fecha_cancelacion).trim() &&
        String(c.fecha_cancelacion) !== "null"
          ? String(c.fecha_cancelacion)
          : null;

      // 1) Si está retirada, ese estado tiene prioridad
      // Regla solicitada: si "vigente" y "activo" son false, se considera retirada (aun si existe fecha_cancelacion).
      if (fechaRetiroValida || !activo) {
        return {
          estado: "Retirada",
          fecha: fechaRetiroValida,
          tipoFecha: fechaRetiroValida ? "retiro" : null,
        };
      }

      // 2) Si está cancelada, ese estado tiene prioridad sobre el estado_cobertura
      if (fechaCancelacionValida) {
        return {
          estado: "Póliza Cancelada",
          fecha: fechaCancelacionValida,
          tipoFecha: "cancelacion",
        };
      }

      // 3) Si no está cancelada ni retirada, mostrar el estado real de cobertura
      if (mostrarEstadoCoberturaDirecto) {
        return {
          estado: estadoCoberturaMostrar,
          fecha: null,
          tipoFecha: null,
        };
      }

      // 4) Si la póliza está vigente, ese es el estado principal
      if (vigente) {
        return { estado: "Vigente", fecha: null, tipoFecha: null };
      }

      // 5) No vigente y activa, sin fecha de cancelación => Póliza Cancelada (sin fecha)
      return {
        estado: "Póliza Cancelada",
        fecha: null,
        tipoFecha: null,
      };
    } catch (_) {
      return { estado: "Vigente", fecha: null, tipoFecha: null };
    }
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

  // ===== Estado para grupo full (fuente de verdad del endpoint de grupo) y etiquetas =====
  const [grupoFull, setGrupoFull] = useState(null);
  const [etiquetasGrupo, setEtiquetasGrupo] = useState([]);
  const [loadingEtiquetas, setLoadingEtiquetas] = useState(false);

  // ===== cobertura seleccionada por grupo (fuente de verdad para estado/fechas) =====
  const coberturaSeleccionada = useMemo(() => {
    const selectedId = toValidId(selectedGrupoId) ?? toValidId(currentGrupo?.id);
    const coberturasFuente =
      Array.isArray(grupoFull?.coberturas)
        ? grupoFull.coberturas
        : Array.isArray(grupoFull?.data?.coberturas)
        ? grupoFull.data.coberturas
        : Array.isArray(cliente?.coberturas)
        ? cliente.coberturas
        : [];

    const coberturas = coberturasFuente;
    if (!selectedId || coberturas.length === 0) return coberturaPrincipal ?? null;

    const delGrupo = coberturas.filter(
      (c) => toValidId(c?.grupo_familiar_id) === selectedId
    );
    if (delGrupo.length === 0) return coberturaPrincipal ?? null;

    const toBool = (v, dflt = false) => {
      if (v === undefined || v === null) return dflt;
      return v === true || v === "true" || v === 1;
    };
    const toTime = (s) => {
      if (!s || String(s).trim() === "" || String(s) === "null") return null;
      const t = new Date(String(s)).getTime();
      return Number.isFinite(t) ? t : null;
    };

    // 1) Preferir siempre la cobertura del cliente actual dentro del grupo seleccionado
    const clienteIdLocal = toValidId(cliente?.id);
    const delCliente = clienteIdLocal
      ? delGrupo.filter((c) => toValidId(c?.cliente?.id) === clienteIdLocal)
      : [];

    const pool = delCliente.length > 0 ? delCliente : delGrupo;

    // 2) Preferir una cobertura vigente si existe; si no, la más reciente cancelada; si no, la más reciente retirada; si no, la primera.
    const vigente = pool.find((c) => toBool(c?.vigente, false));
    if (vigente) return vigente;

    const conCancel = pool
      .map((c) => ({ c, t: toTime(c?.fecha_cancelacion) }))
      .filter((x) => x.t != null)
      .sort((a, b) => b.t - a.t)[0]?.c;
    if (conCancel) return conCancel;

    const conRetiro = pool
      .map((c) => ({ c, t: toTime(c?.fecha_retiro) }))
      .filter((x) => x.t != null)
      .sort((a, b) => b.t - a.t)[0]?.c;
    if (conRetiro) return conRetiro;

    return pool[0];
  }, [
    grupoFull,
    cliente?.coberturas,
    selectedGrupoId,
    currentGrupo?.id,
    coberturaPrincipal,
  ]);

  const estadoPolizaDerivado = useMemo(() => {
    return derivarEstadoPoliza(coberturaSeleccionada);
  }, [coberturaSeleccionada]);

  // ===== datos derivados visibles según grupo seleccionado =====
  const gfId          = currentGrupo?.id ?? null;
  const gfResponsable = currentGrupo?.responsable ?? "—";
  const gfEstado      = currentGrupo?.estado ?? "—";
  const estadoPoliza  = estadoPolizaDerivado?.estado ?? currentGrupo?.estadoPoliza ?? "Vigente";
  const fechaEstadoPoliza =
    estadoPolizaDerivado?.fecha ?? currentGrupo?.fechaEstadoPoliza ?? null;
  const tipoFechaEstadoPoliza =
    estadoPolizaDerivado?.tipoFecha ??
    currentGrupo?.tipoFechaEstadoPoliza ??
    null;

  const anoCobertura  =
    coberturaSeleccionada?.ano_cobertura ??
    currentGrupo?.anoCobertura ??
    "—";
  const codigoPoliza  =
    coberturaSeleccionada?.codigo_poliza ??
    coberturaSeleccionada?.policy_number ??
    currentGrupo?.codigoPoliza ??
    "—";
  const precioPoliza  =
    coberturaSeleccionada?.precio ?? currentGrupo?.precioPoliza ?? null;
  const companiaId    =
    coberturaSeleccionada?.compania_id ??
    coberturaSeleccionada?.compania?.id ??
    currentGrupo?.companiaId ??
    "—";
  const companiaNombre =
    coberturaSeleccionada?.compania?.nombre ??
    currentGrupo?.companiaNombre ??
    coberturaPrincipal?.compania?.nombre ??
    cliente?.compania_nombre ??
    cliente?.compania ??
    "—";

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

  const clienteId = toValidId(cliente?.id);
  const grupoId   = toValidId(gfId);

  // ===== Cargar etiquetas del grupo familiar cuando cambia el grupoId =====
  useEffect(() => {
    const cargarEtiquetasGrupo = async () => {
      if (!grupoId) {
        setEtiquetasGrupo([]);
        setGrupoFull(null);
        return;
      }

      setLoadingEtiquetas(true);
      try {
        const grupoData = await GrupoFamiliarService.getFullById(grupoId);
        setGrupoFull(grupoData?.data ?? grupoData ?? null);
        
        // Normalizar etiquetas: pueden venir como "tags" o "etiquetas"
        const base = grupoData?.data ?? grupoData ?? {};
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
        
        // Validar formato de cada etiqueta
        const etiquetasValidas = tagsArray.filter(tag => 
          tag &&
          typeof tag === "object" &&
          tag.key &&
          tag.label &&
          tag.color
        );
        
        setEtiquetasGrupo(etiquetasValidas);
      } catch (error) {
        console.error("Error al cargar etiquetas del grupo familiar:", error);
        setEtiquetasGrupo([]);
        setGrupoFull(null);
      } finally {
        setLoadingEtiquetas(false);
      }
    };

    cargarEtiquetasGrupo();
  }, [grupoId]);

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
    <>
      {/* Estilos para animación de cumpleaños */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }
        `}
      </style>
      <div className="row g-4">
      {/* Columna izquierda */}
      <div className="col-lg-7">
        <div className="card border">
          <div className="card-body">
            {/* Header con título y selector de grupo */}
            <div className={`d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom ${esCumpleanosHoy ? 'bg-warning bg-opacity-10 rounded px-3 py-2' : ''}`}>
              <h6 className="mb-0 fw-semibold text-dark d-flex align-items-center gap-2">
                RESUMEN DEL CLIENTE
                {esCumpleanosHoy && (
                  <Badge bg="warning" className="d-flex align-items-center gap-1">
                    <FaBirthdayCake /> ¡Cumpleaños de Hoy!
                  </Badge>
                )}
              </h6>
              <div style={{ minWidth: "180px" }}>
                {grupos.length > 1 ? (
                  <select
                    className="form-select form-select-sm border-secondary"
                    value={toValidId(selectedGrupoId) ?? ""}
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
                    <div className={`text-dark small d-flex align-items-center gap-2 ${esCumpleanosHoy ? 'fw-bold text-warning' : ''}`} style={esCumpleanosHoy ? { animation: 'pulse 2s infinite' } : {}}>
                      {formatDate(cliente?.fecha_nacimiento) ?? "—"}
                      {esCumpleanosHoy && <FaBirthdayCake className="text-warning" />}
                    </div>
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
                    <div className="text-dark small">{parentescoCobertura}</div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Proceso</label>
                    <div className={`small ${esEstadoDescartado ? "text-danger fw-semibold" : "text-dark"}`}>
                      {gfEstado}
                    </div>
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
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Valor de la Póliza</label>
                    <div className="text-dark small">{formatearPrecioPoliza(precioPoliza)}</div>
                  </div>
                  {!esEstadoDescartado && (
                    <div className="mb-2">
                      <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Estado de la Póliza</label>
                      <div className="text-dark small">
                        <Badge
                          bg={
                            estadoPoliza === "Vigente"
                              ? "success"
                              : estadoPoliza === "Póliza Cancelada"
                              ? "warning"
                              : estadoPoliza === "Sin cobertura" ||
                                estadoPoliza === "No" ||
                                estadoPoliza === "Medicare" ||
                                estadoPoliza === "Medicaid" ||
                                estadoPoliza === "Medicai"
                              ? "danger"
                              : "secondary"
                          }
                          className="text-uppercase"
                          style={{ fontSize: "0.7rem" }}
                        >
                          {estadoPoliza}
                        </Badge>
                        {fechaEstadoPoliza && (
                          <div className="mt-1 text-muted" style={{ fontSize: "0.7rem" }}>
                            {tipoFechaEstadoPoliza === "cancelacion" && "Fecha de cancelación: "}
                            {tipoFechaEstadoPoliza === "retiro" && "Fecha de retiro: "}
                            {!tipoFechaEstadoPoliza && "Fecha: "}
                            {formatDate(fechaEstadoPoliza)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mb-2">
                    <label className="text-muted small d-block mb-0" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Año de Cobertura</label>
                    <div className="text-dark small">{anoCobertura}</div>
                  </div>
                </div>
              </div>
              
              {/* Etiquetas del Grupo Familiar */}
              {grupoId && (
                <div className="mt-3 pt-2 border-top">
                  <label className="text-muted small d-block mb-2" style={{ fontSize: "0.75rem", fontWeight: "500" }}>Etiquetas del Grupo Familiar</label>
                  {loadingEtiquetas ? (
                    <div className="text-muted small">
                      <i className="fas fa-spinner fa-spin me-2"></i>
                      Cargando etiquetas...
                    </div>
                  ) : (
                    <GroupTags
                      value={etiquetasGrupo}
                      onChange={() => {}} // Solo lectura en la ficha del cliente
                      readOnly={true}
                      className="mb-0"
                    />
                  )}
                </div>
              )}
            </div>

            <hr className="my-3 border-secondary opacity-25" />

            <PersonaContactoCard
  className="mb-3"
  clienteId={clienteId}           // <- importante
  grupoFamiliarId={grupoId}       // <- importante
  grupoContextLabel={
    gfId
      ? `Estás asociando contactos para el Grupo Familiar ${gfId}, donde este cliente es "${parentescoCobertura}".`
      : ""
  }
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

            <ProductosDescartadosButtons
              className="mb-3"
              coberturas={cliente?.coberturas ?? []}
              onSelectCobertura={(c) => console.log("Producto descartado (GF):", c)}
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
        />
      </div>
    </div>
    </>
  );
}
