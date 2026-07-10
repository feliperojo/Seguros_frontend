// src/components/coberturas/CambioVidaCancelacionModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Table, Alert, Spinner, Badge } from "react-bootstrap";
import apiRequest from "../../services/api";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import DateInputWithCalendar from "../common/DateInputWithCalendar";
import { formatDateForDisplay } from "../../utils/formatters";
import {
  COBERTURA_DEFINIDA,
  OPCIONES_COBERTURA_RETIRO,
  badgeCoberturaDefinida,
} from "../../utils/coberturaDefinida";

/**
 * CambioVidaCancelacionModal
 * 
 * Modal para cancelar coberturas de un grupo familiar (cambio de vida).
 * 
 * Props:
 * - show (boolean): Controla la visibilidad del modal
 * - onClose (func): Se llama para cerrar el modal sin guardar
 * - onSuccess (func): Se llama cuando la operación se completa exitosamente
 * - grupoFamiliarId (number|string): ID del grupo familiar
 * 
 * El componente:
 * - Carga las coberturas vigentes del grupo familiar
 * - Permite seleccionar una o varias coberturas mediante checkboxes
 * - Valida que haya al menos una cobertura seleccionada y fecha_cancelacion
 * - Envía la petición POST a /api/coberturas/cancelar
 * - Muestra estados de loading, éxito y error
 */
const CambioVidaCancelacionModal = ({
  show,
  onClose,
  onSuccess,
  grupoFamiliarId,
  // ✅ NUEVO: Callback para actualizar estado local sin llamar al backend
  onUpdateLocal = null,
  // ✅ NUEVO: Si es true, el modal solo actualiza estado local (no llama al backend)
  soloActualizarLocal = false
}) => {
  const [coberturas, setCoberturas] = useState([]);
  const [coberturasSeleccionadas, setCoberturasSeleccionadas] = useState(new Set());
  // Estado para rastrear si cada cobertura se renueva o no (por ID de cobertura)
  // Map<coberturaId, {renovar: boolean, fecha_retiro: string}>
  const [renovacionCoberturas, setRenovacionCoberturas] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [loadingCoberturas, setLoadingCoberturas] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Modo global opcional (aplicar mismos datos a varias coberturas)
  const [usarDatosGlobales, setUsarDatosGlobales] = useState(false);
  const [fechaCancelacionGlobal, setFechaCancelacionGlobal] = useState("");
  const [fechaRetiroGlobal, setFechaRetiroGlobal] = useState("");
  const [motivoCancelacionGlobal, setMotivoCancelacionGlobal] = useState("");
  const [notaCancelGlobal, setNotaCancelGlobal] = useState("");
  const [motivoRetiroGlobal, setMotivoRetiroGlobal] = useState("");
  const [notaRetiroGlobal, setNotaRetiroGlobal] = useState("");
  const [coberturaDefinidaGlobal, setCoberturaDefinidaGlobal] = useState(COBERTURA_DEFINIDA.RETIRADO);

  // Opciones predefinidas para motivo_cancelacion
  const motivosCancelacion = [
    "CAMBIO DE AGENTE",
    "MS CANCELO POR FALTA DE DOCUMENTOS",
    "POR FALTA DE PAGO",
    "POR FALTA DE PAGO INICIAL",
    "TOMO MEDICAID",
    "TOMO MEDICARE",
    "TOMO SEGURO POR EL TRABAJO",
    "CLIENTE CANCELO",
    "CLIENTE SE MUDO A OTRO ESTADO",
    "OTRO",
  ];

  const esTrue = (v) => v === true || v === "true" || v === 1 || v === "1";
  const hasFechaValida = (v) => {
    if (v === null || v === undefined) return false;
    const s = String(v).trim();
    return s !== "" && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined";
  };

  const esSinCobertura = (c = {}) => {
    const raw = c?.estado_cobertura != null ? String(c.estado_cobertura).trim().toLowerCase() : "";
    return raw === "no";
  };

  /** Póliza ya cancelada (fecha de cancelación, aún activo en el grupo). */
  const esPolizaCancelada = (c = {}) => {
    const activo = esTrue(c.activo);
    const fueRetirada =
      hasFechaValida(c.fecha_retiro || c.fechaRetiro) || !activo;
    if (fueRetirada) return false;
    return hasFechaValida(c.fecha_cancelacion || c.fechaCancelacion);
  };

  /**
   * Agrupación visual del bloque inferior (sin cobertura + póliza cancelada).
   */
  const esBloqueSinCoberturaActiva = (c = {}) =>
    esSinCobertura(c) || esPolizaCancelada(c);

  /** Sin póliza activa: solo retiro del grupo (sin cobertura o ya cancelada). */
  const esSoloRetiro = (c = {}) => esBloqueSinCoberturaActiva(c);

  const getEstadoActualInfo = (c = {}) => {
    const definida = c?.cobertura_definida ? String(c.cobertura_definida).trim() : "";
    if (definida) {
      return { bg: badgeCoberturaDefinida(definida), text: definida };
    }

    const vigente = esTrue(c.vigente);
    const activo = esTrue(c.activo);
    const fueCancelada = hasFechaValida(c.fecha_cancelacion || c.fechaCancelacion);
    const fueRetirada = hasFechaValida(c.fecha_retiro || c.fechaRetiro) || !activo;
    const estadoCoberturaRaw =
      c?.estado_cobertura != null ? String(c.estado_cobertura).trim() : "";
    const estadoCoberturaNorm = estadoCoberturaRaw.toLowerCase();
    const estadoCoberturaMostrar =
      estadoCoberturaNorm === "no" ? "Sin cobertura" : estadoCoberturaRaw;

    // Prioridad: retirada / cancelada
    if (fueRetirada) return { bg: "secondary", text: "Retirada" };
    if (fueCancelada) return { bg: "danger", text: "Póliza cancelada" };

    // Mostrar el estado real cuando aplica (igual que ficha de cliente)
    if (
      estadoCoberturaNorm === "no" ||
      estadoCoberturaNorm === "medicare" ||
      estadoCoberturaNorm === "medicaid" ||
      estadoCoberturaNorm === "medicai"
    ) {
      return { bg: "danger", text: estadoCoberturaMostrar || "Sin cobertura" };
    }

    if (vigente) return { bg: "success", text: "Vigente en póliza" };
    if (activo) return { bg: "warning", text: "Póliza sin cobertura" };
    return { bg: "secondary", text: "No tiene cobertura" };
  };

  // Cargar coberturas vigentes cuando se abre el modal
  useEffect(() => {
    if (show && grupoFamiliarId) {
      cargarCoberturas();
      // Resetear formulario
      resetFormulario();
    }
  }, [show, grupoFamiliarId]);

  const resetFormulario = () => {
    setCoberturasSeleccionadas(new Set());
    setRenovacionCoberturas(new Map());
    setUsarDatosGlobales(false);
    setFechaCancelacionGlobal("");
    setFechaRetiroGlobal("");
    setMotivoCancelacionGlobal("");
    setNotaCancelGlobal("");
    setMotivoRetiroGlobal("");
    setNotaRetiroGlobal("");
    setCoberturaDefinidaGlobal(COBERTURA_DEFINIDA.RETIRADO);
    setError("");
    setSuccess(false);
  };

  const normalizarFecha = (fecha) => {
    if (!fecha) return "";
    if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
      return fecha.slice(0, 10);
    }
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const crearDatosInicialesCobertura = (cobertura) => {
    const soloRetiro = esSoloRetiro(cobertura);
    const yaCancelada = esPolizaCancelada(cobertura);
    const fechaCancelExistente = yaCancelada
      ? normalizarFecha(cobertura.fecha_cancelacion || cobertura.fechaCancelacion)
      : "";

    return {
      renovar: soloRetiro || yaCancelada ? false : true,
      fecha_retiro: "",
      fecha_cancelacion: fechaCancelExistente,
      motivo_cancelacion: yaCancelada ? cobertura.motivo_cancelacion || "" : "",
      nota_cancel: yaCancelada ? cobertura.nota_cancel || "" : "",
      motivo_retiro: "",
      nota_retiro: "",
      cobertura_definida: soloRetiro || yaCancelada
        ? COBERTURA_DEFINIDA.RETIRADO
        : COBERTURA_DEFINIDA.CANCELADO,
    };
  };

  const esFlujoSoloRetiro = (cobertura, datos) =>
    esSoloRetiro(cobertura) || esPolizaCancelada(cobertura) || datos?.renovar === false;

  const requiereCamposCancelacion = (cobertura, datos) => {
    if (esSoloRetiro(cobertura) || esPolizaCancelada(cobertura)) return false;
    if (datos?.renovar === true) return true;
    if (datos?.renovar === false) return true;
    return false;
  };

  const requiereCamposRetiro = (cobertura, datos) => esFlujoSoloRetiro(cobertura, datos);

  const requiereFechaCancelacionNueva = (cobertura) =>
    !esSoloRetiro(cobertura) && !esPolizaCancelada(cobertura);

  const requiereFechaRetiro = (cobertura, datos) =>
    esSoloRetiro(cobertura) || esPolizaCancelada(cobertura) || datos?.renovar === false;

  const handleCampoIndividualChange = (coberturaId, campo, valor) => {
    if (!coberturaId) return;
    setRenovacionCoberturas((prev) => {
      const nuevo = new Map(prev);
      const cobertura = coberturas.find((c) => c.id === coberturaId);
      const actual = nuevo.get(coberturaId) || crearDatosInicialesCobertura(cobertura);
      nuevo.set(coberturaId, { ...actual, [campo]: valor });
      return nuevo;
    });
  };

  const obtenerDatosFinalesCobertura = (id) => {
    const datos = renovacionCoberturas.get(id);
    const cobertura = coberturas.find((c) => c.id === id);
    if (!datos || !cobertura) return null;

    if (!usarDatosGlobales) {
      return { ...datos, cobertura };
    }

    return {
      ...datos,
      motivo_cancelacion: motivoCancelacionGlobal || datos.motivo_cancelacion,
      nota_cancel: notaCancelGlobal || datos.nota_cancel,
      motivo_retiro: motivoRetiroGlobal || datos.motivo_retiro,
      nota_retiro: notaRetiroGlobal || datos.nota_retiro,
      cobertura_definida:
        datos.renovar === true
          ? COBERTURA_DEFINIDA.CANCELADO
          : coberturaDefinidaGlobal || datos.cobertura_definida,
      fecha_cancelacion: requiereFechaCancelacionNueva(cobertura)
        ? fechaCancelacionGlobal || datos.fecha_cancelacion
        : datos.fecha_cancelacion,
      fecha_retiro: requiereFechaRetiro(cobertura, datos)
        ? fechaRetiroGlobal || datos.fecha_retiro
        : datos.fecha_retiro,
      cobertura,
    };
  };

  const cargarCoberturas = async () => {
    if (!grupoFamiliarId) return;

    setLoadingCoberturas(true);
    setError("");

    try {
      // Obtener el grupo familiar completo
      const grupoData = await GrupoFamiliarService.getFullById(grupoFamiliarId);
      
      // Extraer coberturas vigentes (activas)
      const coberturasVigentes = (grupoData?.coberturas || []).filter(
        (c) => c.activo === true || c.activo === "true" || c.activo === 1
      );

      setCoberturas(coberturasVigentes);
    } catch (err) {
      console.error("Error al cargar coberturas:", err);
      setError("No se pudieron cargar las coberturas. Intente nuevamente.");
    } finally {
      setLoadingCoberturas(false);
    }
  };

  // Manejar selección/deselección de coberturas
  const toggleCobertura = (coberturaId) => {
    if (!coberturaId) {
      console.warn("toggleCobertura: coberturaId es undefined o null");
      return;
    }
    
    setCoberturasSeleccionadas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(coberturaId)) {
        nuevo.delete(coberturaId);
        // Limpiar datos de renovación cuando se deselecciona
        setRenovacionCoberturas((prevRenov) => {
          const nuevoRenov = new Map(prevRenov);
          nuevoRenov.delete(coberturaId);
          return nuevoRenov;
        });
      } else {
        nuevo.add(coberturaId);
        const cobertura = coberturas.find((c) => c.id === coberturaId);
        const soloRetiro = esSoloRetiro(cobertura);
        setRenovacionCoberturas((prevRenov) => {
          const nuevoRenov = new Map(prevRenov);
          nuevoRenov.set(coberturaId, crearDatosInicialesCobertura(cobertura));
          return nuevoRenov;
        });
      }
      return nuevo;
    });
  };

  // Manejar cambio en la decisión de renovación para una cobertura
  const handleRenovacionChange = (coberturaId, renovar) => {
    if (!coberturaId) {
      console.warn("handleRenovacionChange: coberturaId es undefined o null");
      return;
    }

    const cobertura = coberturas.find((c) => c.id === coberturaId);
    if (esSoloRetiro(cobertura) && renovar === true) {
      return;
    }
    
    setRenovacionCoberturas((prev) => {
      const nuevo = new Map(prev);
      const datosActuales = nuevo.get(coberturaId) || crearDatosInicialesCobertura(cobertura);
      nuevo.set(coberturaId, {
        ...datosActuales,
        renovar: Boolean(renovar),
        fecha_retiro: renovar ? "" : datosActuales.fecha_retiro || "",
        cobertura_definida: renovar
          ? COBERTURA_DEFINIDA.CANCELADO
          : datosActuales.cobertura_definida || COBERTURA_DEFINIDA.RETIRADO,
      });
      return nuevo;
    });
  };

  // Manejar cambio en la fecha de retiro individual para una cobertura
  const handleFechaRetiroChange = (coberturaId, fechaRetiro) => {
    if (!coberturaId) {
      console.warn("handleFechaRetiroChange: coberturaId es undefined o null");
      return;
    }
    
    setRenovacionCoberturas((prev) => {
      const nuevo = new Map(prev);
      const datosActuales = nuevo.get(coberturaId) || { renovar: true };
      nuevo.set(coberturaId, {
        renovar: datosActuales.renovar,
        fecha_retiro: fechaRetiro || "",
      });
      return nuevo;
    });
  };

  // Seleccionar / deseleccionar un bloque: con póliza o solo retiro
  const toggleGrupo = (grupo) => {
    const ids =
      grupo === "soloRetiro"
        ? coberturas.filter((c) => c?.id && esBloqueSinCoberturaActiva(c)).map((c) => c.id)
        : coberturas.filter((c) => c?.id && !esBloqueSinCoberturaActiva(c)).map((c) => c.id);

    if (ids.length === 0) return;

    const todasSeleccionadas = ids.every((id) => coberturasSeleccionadas.has(id));

    if (todasSeleccionadas) {
      setCoberturasSeleccionadas((prev) => {
        const nuevo = new Set(prev);
        ids.forEach((id) => nuevo.delete(id));
        return nuevo;
      });
      setRenovacionCoberturas((prevRenov) => {
        const nuevoRenov = new Map(prevRenov);
        ids.forEach((id) => nuevoRenov.delete(id));
        return nuevoRenov;
      });
      return;
    }

    setCoberturasSeleccionadas((prev) => {
      const nuevo = new Set(prev);
      ids.forEach((id) => nuevo.add(id));
      return nuevo;
    });
    setRenovacionCoberturas((prevRenov) => {
      const nuevoRenov = new Map(prevRenov);
      ids.forEach((id) => {
        const cobertura = coberturas.find((c) => c.id === id);
        nuevoRenov.set(id, crearDatosInicialesCobertura(cobertura));
      });
      return nuevoRenov;
    });
  };

  // Validar formulario (datos individuales por cobertura)
  const validarFormulario = () => {
    if (coberturasSeleccionadas.size === 0) {
      setError("Debe seleccionar al menos una cobertura.");
      return false;
    }

    if (usarDatosGlobales) {
      const algunaCancelacion = Array.from(coberturasSeleccionadas).some((id) => {
        const cobertura = coberturas.find((c) => c.id === id);
        const datos = renovacionCoberturas.get(id);
        return cobertura && datos && requiereCamposCancelacion(cobertura, datos);
      });
      const algunaRetiro = Array.from(coberturasSeleccionadas).some((id) => {
        const cobertura = coberturas.find((c) => c.id === id);
        const datos = renovacionCoberturas.get(id);
        return cobertura && datos && requiereCamposRetiro(cobertura, datos);
      });

      if (algunaCancelacion) {
        if (!motivoCancelacionGlobal) {
          setError("El motivo de cancelación es requerido en el modo global.");
          return false;
        }
        if (!notaCancelGlobal || String(notaCancelGlobal).trim().length === 0) {
          setError("Las observaciones de cancelación son requeridas en el modo global.");
          return false;
        }
      }

      if (algunaRetiro) {
        if (!motivoRetiroGlobal) {
          setError("El motivo de retiro es requerido en el modo global.");
          return false;
        }
        if (!notaRetiroGlobal || String(notaRetiroGlobal).trim().length === 0) {
          setError("Las observaciones de retiro son requeridas en el modo global.");
          return false;
        }
        if (!OPCIONES_COBERTURA_RETIRO.includes(coberturaDefinidaGlobal)) {
          setError("Seleccione Retirado o Terminado en el modo global.");
          return false;
        }
      }

      const requiereCancelGlobal = Array.from(coberturasSeleccionadas).some((id) => {
        const cobertura = coberturas.find((c) => c.id === id);
        return cobertura && requiereFechaCancelacionNueva(cobertura);
      });
      if (requiereCancelGlobal && !fechaCancelacionGlobal) {
        setError("La fecha de cancelación global es requerida para las coberturas con póliza vigente.");
        return false;
      }

      const requiereRetiroGlobal = Array.from(coberturasSeleccionadas).some((id) => {
        const cobertura = coberturas.find((c) => c.id === id);
        const datos = renovacionCoberturas.get(id);
        return cobertura && datos && requiereFechaRetiro(cobertura, datos);
      });
      if (requiereRetiroGlobal && !fechaRetiroGlobal) {
        setError("La fecha de retiro global es requerida para las coberturas marcadas para retiro.");
        return false;
      }
    }

    const coberturasSinDecision = Array.from(coberturasSeleccionadas).filter(
      (id) => !renovacionCoberturas.has(id)
    );
    if (coberturasSinDecision.length > 0) {
      setError("Por favor, indica para cada cobertura seleccionada si será cancelación o retiro.");
      return false;
    }

    for (const id of coberturasSeleccionadas) {
      const datosFinales = obtenerDatosFinalesCobertura(id);
      if (!datosFinales) continue;

      const cobertura = datosFinales.cobertura;
      const datos = datosFinales;
      const nombre = cobertura?.cliente?.nombre_completo || `ID ${id}`;

      if (esSoloRetiro(cobertura) && datos.renovar === true) {
        setError(`${nombre} no tiene póliza activa y solo puede retirarse del grupo.`);
        return false;
      }

      if (requiereFechaCancelacionNueva(cobertura) && !datos.fecha_cancelacion) {
        setError(`${nombre}: la fecha de cancelación es requerida.`);
        return false;
      }

      if (requiereFechaRetiro(cobertura, datos) && !datos.fecha_retiro) {
        setError(`${nombre}: la fecha de retiro es requerida.`);
        return false;
      }

      const motivoCancel = datos.motivo_cancelacion;
      const notaCancel = datos.nota_cancel;
      const motivoRetiro = datos.motivo_retiro;
      const notaRetiro = datos.nota_retiro;
      const definida = datos.cobertura_definida;

      if (requiereCamposCancelacion(cobertura, datos)) {
        if (!motivoCancel) {
          setError(`${nombre}: el motivo de cancelación es requerido.`);
          return false;
        }
        if (!notaCancel || String(notaCancel).trim().length === 0) {
          setError(`${nombre}: las observaciones de cancelación son requeridas.`);
          return false;
        }
      }

      if (requiereCamposRetiro(cobertura, datos)) {
        if (!OPCIONES_COBERTURA_RETIRO.includes(definida)) {
          setError(`${nombre}: seleccione Retirado o Terminado.`);
          return false;
        }
        if (!motivoRetiro) {
          setError(`${nombre}: el motivo de retiro es requerido.`);
          return false;
        }
        if (!notaRetiro || String(notaRetiro).trim().length === 0) {
          setError(`${nombre}: las observaciones de retiro son requeridas.`);
          return false;
        }
      }

      const fechaCancel = datos.fecha_cancelacion;
      const fechaRetiro = datos.fecha_retiro;
      if (
        fechaCancel &&
        fechaRetiro &&
        fechaRetiro < fechaCancel
      ) {
        setError(`${nombre}: la fecha de retiro no puede ser menor a la fecha de cancelación.`);
        return false;
      }
    }

    return true;
  };

  // Formatear fecha a YYYY-MM-DD
  // Si ya es un string en formato YYYY-MM-DD, retornarlo directamente
  // Si es un objeto Date, formatearlo usando métodos locales para evitar desfase de zona horaria
  const formatearFecha = (fecha) => {
    if (!fecha) return null;
    
    // Si ya es un string en formato YYYY-MM-DD, retornarlo directamente
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }
    
    // Si es un objeto Date, usar métodos locales para evitar desfase
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(d.getTime())) return null;
    
    // Usar métodos locales (getFullYear, getMonth, getDate) que respetan la zona horaria local
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const construirDatosRenovacion = () =>
    Array.from(coberturasSeleccionadas).map((id) => {
      const datosFinales = obtenerDatosFinalesCobertura(id);
      const cobertura = datosFinales?.cobertura;
      const datos = datosFinales;
      if (!cobertura || !datos) return null;

      const yaCancelada = esPolizaCancelada(cobertura);
      const soloRetiro = esSoloRetiro(cobertura);
      const renovar = soloRetiro || yaCancelada ? false : (datos?.renovar ?? false);
      const base = {
        cobertura_id: Number(id),
        cliente_id: cobertura?.cliente?.id || cobertura?.cliente_id || null,
        renovar,
      };

      if (renovar === true) {
        return {
          ...base,
          renovar: true,
          activo: true,
          vigente: false,
          estado_cobertura: "No",
          cobertura_definida: COBERTURA_DEFINIDA.CANCELADO,
          fecha_cancelacion: datos.fecha_cancelacion || null,
          fecha_retiro: null,
          motivo_cancelacion: datos.motivo_cancelacion || null,
          nota_cancel: datos.nota_cancel || null,
        };
      }

      const fechaCancelFinal = yaCancelada
        ? normalizarFecha(cobertura.fecha_cancelacion || cobertura.fechaCancelacion)
        : soloRetiro
          ? null
          : datos.fecha_cancelacion || null;

      const item = {
        ...base,
        renovar: false,
        activo: false,
        vigente: false,
        estado_cobertura: "No",
        cobertura_definida: datos.cobertura_definida || COBERTURA_DEFINIDA.RETIRADO,
        fecha_retiro: datos.fecha_retiro || null,
        motivo_retiro: datos.motivo_retiro || null,
        nota_retiro: datos.nota_retiro || null,
      };

      if (fechaCancelFinal) {
        item.fecha_cancelacion = fechaCancelFinal;
      }

      if (!yaCancelada && requiereCamposCancelacion(cobertura, datos)) {
        item.motivo_cancelacion = datos.motivo_cancelacion || null;
        item.nota_cancel = datos.nota_cancel || null;
      }

      return item;
    }).filter(Boolean);

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const datosRenovacion = construirDatosRenovacion();

      // ✅ MODO LOCAL: Solo actualizar estado local, NO llamar al backend
      if (soloActualizarLocal && onUpdateLocal) {
        console.log("🔄 [CambioVidaCancelacionModal] Modo local: actualizando estado sin llamar al backend", {
          cantidadCoberturas: datosRenovacion.length,
          datosRenovacion
        });

        // Llamar al callback para actualizar el estado local
        onUpdateLocal(datosRenovacion, {
          usar_datos_globales: usarDatosGlobales,
        });

        setSuccess(true);
        
        // Cerrar el modal después de un breve delay
        setTimeout(() => {
          onClose();
        }, 1000);
        
        setLoading(false);
        return;
      }

      // ✅ MODO TRADICIONAL: Llamar al backend (comportamiento original)
      // Construir payload principal con campos comunes
      const payload = {
        cobertura_ids: Array.from(coberturasSeleccionadas).map(Number),
        accion_origen: "Cambio de vida",
        datos_renovacion: datosRenovacion,
      };

      // Eliminar campos null/undefined del payload principal (excepto datos_renovacion y cobertura_ids que siempre deben ir)
      Object.keys(payload).forEach((key) => {
        if (key !== 'datos_renovacion' && key !== 'cobertura_ids' && (payload[key] === null || payload[key] === undefined || payload[key] === "")) {
          delete payload[key];
        }
      });

      // DEBUG: Verificar payload antes de enviar
      console.log("📤 PAYLOAD COMPLETO ENVIADO AL BACKEND:", JSON.stringify(payload, null, 2));
      console.log("📋 RESUMEN datos_renovacion:", datosRenovacion.map(d => ({
        cobertura_id: d.cobertura_id,
        activo: d.activo,
        vigente: d.vigente,
        estado_cobertura: d.estado_cobertura,
        fecha_retiro: d.fecha_retiro
      })));

      await apiRequest("coberturas/cancelar", "POST", payload);

      setSuccess(true);
      
      // Llamar onSuccess después de un breve delay para mostrar el mensaje
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Error al cancelar coberturas:", err);
      
      // Manejar errores de validación del backend
      if (err.message) {
        setError(err.message);
      } else {
        setError("Ocurrió un error al cancelar las coberturas. Intente nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Obtener fecha actual en formato YYYY-MM-DD para el input date
  const getFechaHoy = () => {
    const hoy = new Date();
    return formatearFecha(hoy);
  };

  // Calcular estadísticas (renovar=true → cancelación; renovar=false → retiro)
  const totalSeleccionadas = coberturasSeleccionadas.size;
  const idsSeleccionados = Array.from(coberturasSeleccionadas);
  const totalCancelaciones = idsSeleccionados.filter((id) => {
    const datos = renovacionCoberturas.get(id);
    const cobertura = coberturas.find((c) => c.id === id);
    return datos?.renovar === true && !esBloqueSinCoberturaActiva(cobertura);
  }).length;
  const totalRetiros = idsSeleccionados.filter((id) => {
    const datos = renovacionCoberturas.get(id);
    return datos?.renovar === false;
  }).length;
  const totalSoloRetiroEnSeleccion = idsSeleccionados.filter((id) => {
    const cobertura = coberturas.find((c) => c.id === id);
    return esBloqueSinCoberturaActiva(cobertura);
  }).length;

  const coberturasOrdenadas = [...coberturas]
    .filter((c) => c && c.id)
    .sort((a, b) => {
      const aInferior = esBloqueSinCoberturaActiva(a) ? 1 : 0;
      const bInferior = esBloqueSinCoberturaActiva(b) ? 1 : 0;
      return aInferior - bInferior;
    });

  const hayConPoliza = coberturasOrdenadas.some((c) => !esBloqueSinCoberturaActiva(c));
  const hayBloqueInferior = coberturasOrdenadas.some((c) => esBloqueSinCoberturaActiva(c));

  const idsConPoliza = coberturasOrdenadas
    .filter((c) => !esBloqueSinCoberturaActiva(c))
    .map((c) => c.id);
  const idsBloqueInferior = coberturasOrdenadas
    .filter((c) => esBloqueSinCoberturaActiva(c))
    .map((c) => c.id);

  const todasConPolizaSeleccionadas =
    idsConPoliza.length > 0 && idsConPoliza.every((id) => coberturasSeleccionadas.has(id));
  const algunaConPolizaSeleccionada = idsConPoliza.some((id) =>
    coberturasSeleccionadas.has(id)
  );
  const todasBloqueInferiorSeleccionadas =
    idsBloqueInferior.length > 0 &&
    idsBloqueInferior.every((id) => coberturasSeleccionadas.has(id));

  const hayAlgunaConFechaCancelacion = coberturasOrdenadas.some((c) =>
    hasFechaValida(c.fecha_cancelacion || c.fechaCancelacion)
  );

  const getFechaCancelacionMostrar = (cobertura) => {
    const raw = cobertura?.fecha_cancelacion || cobertura?.fechaCancelacion;
    if (!hasFechaValida(raw)) return null;
    return formatDateForDisplay(normalizarFecha(raw));
  };

  const columnasDatos = hayAlgunaConFechaCancelacion ? 5 : 4;

  return (
    <>
      <style>{`
        .modal-cambio-vida-cancelacion-dialog {
          width: calc(100vw - 1rem) !important;
          max-width: calc(100vw - 1rem) !important;
          margin: 0.5rem auto !important;
        }
        @media (min-width: 576px) {
          .modal-cambio-vida-cancelacion-dialog {
            width: calc(100vw - 2rem) !important;
            max-width: min(96vw, 1500px) !important;
            margin: 1rem auto !important;
          }
        }
        @media (min-width: 992px) {
          .modal-cambio-vida-cancelacion-dialog {
            width: min(94vw, 1500px) !important;
            max-width: min(94vw, 1500px) !important;
          }
        }
        .modal-cambio-vida-cancelacion-content {
          max-height: calc(100dvh - 1rem);
          display: flex;
          flex-direction: column;
        }
        @media (min-width: 576px) {
          .modal-cambio-vida-cancelacion-content {
            max-height: calc(100dvh - 2rem);
          }
        }
        .modal-cambio-vida-cancelacion-content .modal-body {
          flex: 1 1 auto;
          overflow-y: auto;
          min-height: 0;
          padding: 0.75rem 1rem;
        }
        @media (min-width: 768px) {
          .modal-cambio-vida-cancelacion-content .modal-body {
            padding: 1rem 1.25rem;
          }
        }
        .cvc-table-wrap {
          max-height: min(58dvh, 680px);
          overflow: auto;
          -webkit-overflow-scrolling: touch;
        }
        .cvc-table thead th {
          font-size: 0.78rem;
          font-weight: 600;
          background: #f8f9fa;
          border-bottom: 1px solid #dee2e6;
          color: #495057;
          white-space: nowrap;
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .cvc-table tbody td {
          font-size: 0.85rem;
          vertical-align: middle;
        }
        .cvc-row-selected {
          background-color: #f0f7ff !important;
        }
        .cvc-detail-row td {
          background: #fafbfc;
          border-top: none;
          padding: 0.5rem 0.75rem 0.75rem;
        }
        .cvc-detail-fields {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.65rem;
          align-items: end;
        }
        @media (min-width: 576px) {
          .cvc-detail-fields {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 992px) {
          .cvc-detail-fields {
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          }
        }
        .cvc-detail-fields .obs-col {
          grid-column: 1 / -1;
        }
        .cvc-stat-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 600;
          background: #fff;
          border: 1px solid #dee2e6;
        }
        .cvc-col-plan {
          min-width: 140px;
        }
        .cvc-col-action {
          min-width: 150px;
        }
        .cvc-col-fecha-cancel {
          min-width: 110px;
          white-space: nowrap;
        }
        @media (max-width: 575.98px) {
          .cvc-col-estado {
            display: none;
          }
          .cvc-member-name {
            max-width: 160px;
          }
        }
        @media (min-width: 576px) {
          .cvc-member-name {
            max-width: 320px;
          }
        }
      `}</style>
      <Modal
        show={show}
        onHide={onClose}
        centered
        scrollable
        fullscreen="sm-down"
        dialogClassName="modal-cambio-vida-cancelacion-dialog"
        contentClassName="modal-cambio-vida-cancelacion-content"
      >
      <Modal.Header closeButton className="py-2 px-3 border-bottom">
        <div className="w-100 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <Modal.Title className="fs-6 mb-0 fw-semibold">
              Gestión de Cancelaciones y Retiros
            </Modal.Title>
          </div>
          {totalSeleccionadas > 0 && (
            <div className="d-flex flex-wrap gap-2">
              <span className="cvc-stat-chip text-primary">
                {totalSeleccionadas} seleccionada{totalSeleccionadas !== 1 ? "s" : ""}
              </span>
              {totalCancelaciones > 0 && (
                <span className="cvc-stat-chip text-warning">
                  {totalCancelaciones} cancelación{totalCancelaciones !== 1 ? "es" : ""}
                </span>
              )}
              {totalRetiros > 0 && (
                <span className="cvc-stat-chip text-danger">
                  {totalRetiros} retiro{totalRetiros !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>
      </Modal.Header>
      <Modal.Body>
        <Form id="cvc-cancelacion-form" onSubmit={handleSubmit}>
        {loadingCoberturas ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Cargando coberturas...</p>
          </div>
        ) : coberturas.length === 0 ? (
          <Alert variant="info">
            <i className="fas fa-info-circle me-2"></i>
            No hay coberturas vigentes disponibles para cancelar.
          </Alert>
        ) : (
          <>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <div className="d-flex flex-wrap align-items-center gap-2">
                {hayConPoliza && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    type="button"
                    onClick={() => toggleGrupo("conPoliza")}
                  >
                    {todasConPolizaSeleccionadas ? "Deseleccionar con póliza" : "Seleccionar con póliza"}
                  </Button>
                )}
                <Form.Check
                  type="switch"
                  id="usar-datos-globales"
                  className="mb-0 ms-1"
                  label={<span className="small">Datos globales</span>}
                  checked={usarDatosGlobales}
                  onChange={(e) => setUsarDatosGlobales(e.target.checked)}
                />
              </div>
            </div>

            {usarDatosGlobales && (
              <div className="border rounded p-2 mb-2 bg-light">
                <div className="row g-2 align-items-end">
                  <div className="col-md-3 col-6">
                    <Form.Label className="small mb-1">F. cancelación</Form.Label>
                    <DateInputWithCalendar
                      valueIso={fechaCancelacionGlobal || ""}
                      onChangeIso={(iso) => setFechaCancelacionGlobal(iso)}
                      disabled={false}
                    />
                  </div>
                  <div className="col-md-3 col-6">
                    <Form.Label className="small mb-1">F. retiro</Form.Label>
                    <DateInputWithCalendar
                      valueIso={fechaRetiroGlobal || ""}
                      onChangeIso={(iso) => setFechaRetiroGlobal(iso)}
                      minIso={fechaCancelacionGlobal || ""}
                      disabled={false}
                    />
                  </div>
                  <div className="col-md-3 col-6">
                    <Form.Label className="small mb-1">Motivo cancelación *</Form.Label>
                    <Form.Select
                      size="sm"
                      value={motivoCancelacionGlobal}
                      onChange={(e) => setMotivoCancelacionGlobal(e.target.value)}
                    >
                      <option value="">Seleccione...</option>
                      {motivosCancelacion.map((motivo) => (
                        <option key={motivo} value={motivo}>{motivo}</option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="col-md-3 col-6">
                    <Form.Label className="small mb-1">Obs. cancelación *</Form.Label>
                    <Form.Control
                      size="sm"
                      value={notaCancelGlobal}
                      onChange={(e) => setNotaCancelGlobal(e.target.value)}
                      placeholder="Notas cancelación..."
                    />
                  </div>
                  <div className="col-md-3 col-6">
                    <Form.Label className="small mb-1">Estado retiro *</Form.Label>
                    <Form.Select
                      size="sm"
                      value={coberturaDefinidaGlobal}
                      onChange={(e) => setCoberturaDefinidaGlobal(e.target.value)}
                    >
                      {OPCIONES_COBERTURA_RETIRO.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="col-md-3 col-6">
                    <Form.Label className="small mb-1">Motivo retiro *</Form.Label>
                    <Form.Select
                      size="sm"
                      value={motivoRetiroGlobal}
                      onChange={(e) => setMotivoRetiroGlobal(e.target.value)}
                    >
                      <option value="">Seleccione...</option>
                      {motivosCancelacion.map((motivo) => (
                        <option key={`r-${motivo}`} value={motivo}>{motivo}</option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="col-md-3 col-12">
                    <Form.Label className="small mb-1">Obs. retiro *</Form.Label>
                    <Form.Control
                      size="sm"
                      value={notaRetiroGlobal}
                      onChange={(e) => setNotaRetiroGlobal(e.target.value)}
                      placeholder="Notas retiro..."
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="table-responsive border rounded cvc-table-wrap">
              <Table hover size="sm" className="mb-0 cvc-table">
                <thead>
                  <tr>
                    <th width="40" className="text-center">
                      {hayConPoliza ? (
                        <Form.Check
                          type="checkbox"
                          checked={todasConPolizaSeleccionadas}
                          ref={(el) => {
                            if (el) {
                              el.indeterminate =
                                algunaConPolizaSeleccionada && !todasConPolizaSeleccionadas;
                            }
                          }}
                          onChange={() => toggleGrupo("conPoliza")}
                          title="Seleccionar miembros con póliza"
                        />
                      ) : null}
                    </th>
                    <th>Miembro</th>
                    <th className="cvc-col-plan">Plan</th>
                    {hayAlgunaConFechaCancelacion && (
                      <th className="text-center cvc-col-fecha-cancel">F. cancelación</th>
                    )}
                    <th className="cvc-col-action">Acción</th>
                    <th width="130" className="text-center cvc-col-estado">Estado</th>
                  </tr>
                </thead>
                  <tbody>
                    {coberturasOrdenadas.map((cobertura, index) => {
                      const coberturaId = cobertura.id;
                      const isSelected = coberturasSeleccionadas.has(coberturaId);
                      const esTomador = cobertura.parentesco?.toUpperCase() === "TOMADOR";
                      const soloRetiro = esSoloRetiro(cobertura);
                      const enBloqueInferior = esBloqueSinCoberturaActiva(cobertura);
                      const datosRenovacion = renovacionCoberturas.get(coberturaId) || crearDatosInicialesCobertura(cobertura);
                      const yaCancelada = esPolizaCancelada(cobertura);
                      const estadoActual = getEstadoActualInfo(cobertura);
                      const fechaCancelMostrar = getFechaCancelacionMostrar(cobertura);
                      const filaAnterior = index > 0 ? coberturasOrdenadas[index - 1] : null;
                      const mostrarSeparadorBloqueInferior =
                        enBloqueInferior &&
                        ((index === 0 && hayConPoliza === false) ||
                          (filaAnterior && !esBloqueSinCoberturaActiva(filaAnterior)));
                      
                      return (
                        <React.Fragment key={coberturaId}>
                          {mostrarSeparadorBloqueInferior && (
                            <tr className="table-secondary">
                              <td className="text-center align-middle py-1">
                                <Form.Check
                                  type="checkbox"
                                  checked={todasBloqueInferiorSeleccionadas}
                                  onChange={() => toggleGrupo("soloRetiro")}
                                  title="Seleccionar sin cobertura activa"
                                />
                              </td>
                              <td colSpan={columnasDatos} className="py-1 px-2">
                                <span className="small fw-semibold text-muted">
                                  Sin cobertura activa o póliza cancelada
                                </span>
                              </td>
                            </tr>
                          )}
                        <tr
                          className={
                            isSelected
                              ? "cvc-row-selected"
                              : esTomador
                                ? "table-warning"
                                : ""
                          }
                        >
                          <td className="text-center align-middle">
                            <Form.Check
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCobertura(coberturaId)}
                            />
                          </td>
                          <td className="align-middle">
                            <div className="fw-semibold text-truncate cvc-member-name">
                              {cobertura.cliente?.nombre_completo || "-"}
                            </div>
                            <div className="d-flex align-items-center gap-1 mt-1 flex-wrap">
                              <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                {cobertura.parentesco || "-"}
                              </span>
                              {esTomador && (
                                <Badge bg="warning" text="dark" style={{ fontSize: "0.6rem" }}>TOMADOR</Badge>
                              )}
                              {soloRetiro && (
                                <Badge bg="secondary" style={{ fontSize: "0.6rem" }}>SOLO RETIRO</Badge>
                              )}
                            </div>
                          </td>
                          <td className="align-middle">
                            <div className="small fw-medium">{cobertura.plan || "-"}</div>
                            <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                              {[cobertura.metal, cobertura.red, cobertura.codigo_poliza].filter(Boolean).join(" · ") || "-"}
                            </div>
                          </td>
                          {hayAlgunaConFechaCancelacion && (
                            <td className="align-middle text-center cvc-col-fecha-cancel">
                              {fechaCancelMostrar ? (
                                <span className="small fw-medium text-danger">
                                  {fechaCancelMostrar}
                                </span>
                              ) : (
                                <span className="text-muted" style={{ fontSize: "0.78rem" }}>—</span>
                              )}
                            </td>
                          )}
                          <td className="align-middle">
                            {isSelected ? (
                              soloRetiro ? (
                                <span className="small text-danger fw-medium">Retiro</span>
                              ) : (
                                <Form.Select
                                  size="sm"
                                  value={datosRenovacion.renovar === true ? "cancelar" : "retiro"}
                                  onChange={(e) =>
                                    handleRenovacionChange(coberturaId, e.target.value === "cancelar")
                                  }
                                >
                                  <option value="cancelar">Cancelar póliza</option>
                                  <option value="retiro">Retiro del grupo</option>
                                </Form.Select>
                              )
                            ) : (
                              <span className="text-muted" style={{ fontSize: "0.78rem" }}>—</span>
                            )}
                          </td>
                          <td className="align-middle cvc-col-estado text-center">
                            <Badge
                              bg={estadoActual.bg}
                              className="small"
                              style={{ fontWeight: "500", fontSize: "0.7rem" }}
                            >
                              {estadoActual.text}
                            </Badge>
                          </td>
                        </tr>
                        {isSelected && !usarDatosGlobales && (
                          <tr className="cvc-detail-row">
                            <td></td>
                            <td colSpan={columnasDatos}>
                              <div className="cvc-detail-fields">
                                {requiereFechaCancelacionNueva(cobertura) && (
                                  <div>
                                    <Form.Label className="small mb-1">
                                      F. cancelación <span className="text-danger">*</span>
                                    </Form.Label>
                                    <DateInputWithCalendar
                                      valueIso={datosRenovacion.fecha_cancelacion || ""}
                                      onChangeIso={(iso) =>
                                        handleCampoIndividualChange(coberturaId, "fecha_cancelacion", iso)
                                      }
                                      disabled={false}
                                    />
                                  </div>
                                )}
                                {yaCancelada && datosRenovacion.fecha_cancelacion && (
                                  <div>
                                    <Form.Label className="small mb-1">F. cancelación</Form.Label>
                                    <Form.Control
                                      size="sm"
                                      type="text"
                                      value={datosRenovacion.fecha_cancelacion}
                                      disabled
                                      readOnly
                                      className="bg-white"
                                    />
                                  </div>
                                )}
                                {requiereFechaRetiro(cobertura, datosRenovacion) && (
                                  <div>
                                    <Form.Label className="small mb-1">
                                      F. retiro <span className="text-danger">*</span>
                                    </Form.Label>
                                    <DateInputWithCalendar
                                      valueIso={datosRenovacion.fecha_retiro || ""}
                                      onChangeIso={(iso) =>
                                        handleCampoIndividualChange(coberturaId, "fecha_retiro", iso)
                                      }
                                      minIso={datosRenovacion.fecha_cancelacion || ""}
                                      disabled={false}
                                    />
                                  </div>
                                )}
                                {yaCancelada && (datosRenovacion.motivo_cancelacion || datosRenovacion.nota_cancel) && (
                                  <div className="obs-col">
                                    <Form.Label className="small mb-1 text-muted">Cancelación previa</Form.Label>
                                    <div className="small border rounded p-2 bg-white">
                                      {datosRenovacion.motivo_cancelacion && (
                                        <div><strong>Motivo:</strong> {datosRenovacion.motivo_cancelacion}</div>
                                      )}
                                      {datosRenovacion.nota_cancel && (
                                        <div><strong>Nota:</strong> {datosRenovacion.nota_cancel}</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {requiereCamposCancelacion(cobertura, datosRenovacion) && (
                                  <>
                                    <div>
                                      <Form.Label className="small mb-1">
                                        Motivo cancelación <span className="text-danger">*</span>
                                      </Form.Label>
                                      <Form.Select
                                        size="sm"
                                        value={datosRenovacion.motivo_cancelacion || ""}
                                        onChange={(e) =>
                                          handleCampoIndividualChange(
                                            coberturaId,
                                            "motivo_cancelacion",
                                            e.target.value
                                          )
                                        }
                                      >
                                        <option value="">Seleccione...</option>
                                        {motivosCancelacion.map((motivo) => (
                                          <option key={motivo} value={motivo}>{motivo}</option>
                                        ))}
                                      </Form.Select>
                                    </div>
                                    <div>
                                      <Form.Label className="small mb-1">
                                        Obs. cancelación <span className="text-danger">*</span>
                                      </Form.Label>
                                      <Form.Control
                                        size="sm"
                                        value={datosRenovacion.nota_cancel || ""}
                                        onChange={(e) =>
                                          handleCampoIndividualChange(coberturaId, "nota_cancel", e.target.value)
                                        }
                                        placeholder="Notas de cancelación..."
                                      />
                                    </div>
                                  </>
                                )}
                                {requiereCamposRetiro(cobertura, datosRenovacion) && (
                                  <>
                                    <div>
                                      <Form.Label className="small mb-1">
                                        Estado <span className="text-danger">*</span>
                                      </Form.Label>
                                      <Form.Select
                                        size="sm"
                                        value={datosRenovacion.cobertura_definida || COBERTURA_DEFINIDA.RETIRADO}
                                        onChange={(e) =>
                                          handleCampoIndividualChange(
                                            coberturaId,
                                            "cobertura_definida",
                                            e.target.value
                                          )
                                        }
                                      >
                                        {OPCIONES_COBERTURA_RETIRO.map((op) => (
                                          <option key={op} value={op}>{op}</option>
                                        ))}
                                      </Form.Select>
                                    </div>
                                    <div>
                                      <Form.Label className="small mb-1">
                                        Motivo retiro <span className="text-danger">*</span>
                                      </Form.Label>
                                      <Form.Select
                                        size="sm"
                                        value={datosRenovacion.motivo_retiro || ""}
                                        onChange={(e) =>
                                          handleCampoIndividualChange(
                                            coberturaId,
                                            "motivo_retiro",
                                            e.target.value
                                          )
                                        }
                                      >
                                        <option value="">Seleccione...</option>
                                        {motivosCancelacion.map((motivo) => (
                                          <option key={`ret-${motivo}`} value={motivo}>{motivo}</option>
                                        ))}
                                      </Form.Select>
                                    </div>
                                    <div>
                                      <Form.Label className="small mb-1">
                                        Obs. retiro <span className="text-danger">*</span>
                                      </Form.Label>
                                      <Form.Control
                                        size="sm"
                                        value={datosRenovacion.nota_retiro || ""}
                                        onChange={(e) =>
                                          handleCampoIndividualChange(coberturaId, "nota_retiro", e.target.value)
                                        }
                                        placeholder="Notas de retiro..."
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

            {error && (
              <Alert variant="danger" className="mt-2 mb-0 py-2 small">
                {error}
              </Alert>
            )}
            {success && (
              <Alert variant="success" className="mt-2 mb-0 py-2 small">
                Operación completada correctamente.
              </Alert>
            )}
          </>
        )}
        </Form>
      </Modal.Body>
      <Modal.Footer className="py-2 px-3 d-flex justify-content-between flex-wrap gap-2">
        <span className="text-muted small">
          {soloActualizarLocal
            ? "Los cambios se aplican localmente hasta guardar el grupo."
            : "Se registrará en el historial del grupo familiar."}
        </span>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="cvc-cancelacion-form"
            disabled={loading || coberturasSeleccionadas.size === 0}
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-1" />
                Procesando...
              </>
            ) : (
              soloActualizarLocal ? "Aplicar cambios" : "Confirmar operación"
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
    </>
  );
};

export default CambioVidaCancelacionModal;

