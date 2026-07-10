import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal, Button, Spinner, Alert } from "react-bootstrap";
import apiRequest, { apiRequestFormData } from "../../services/api";
import systemConfigService from "../../services/SystemConfigService";
import useAppSettings from "../../hooks/useAppSettings";
import FolderList from "./FolderList";
import FilesList from "./FilesList";
import TrashList from "./TrashList";
import DocumentoPreviewModal from "./DocumentoPreviewModal";
import SuperAdminPasswordModal from "./SuperAdminPasswordModal";
import useCanManageDocumentTrash from "../../hooks/useCanManageDocumentTrash";
import {
  getCurrentYear,
  requiresSuperPasswordForFolder,
  validarNombreCarpetaRaiz,
  isValidYearName,
} from "./documentFolderYearUtils";
import {
  clasificarArchivosSubida,
  obtenerRutasCarpetasUnicas,
  obtenerSegmentosCarpeta,
} from "./folderUploadUtils";
import {
  calcularPausaTrasSubida,
  calcularTimeoutSubida,
  ejecutarConReintentos,
  formatearErrorApi,
  formatearResumenErroresSubida,
  validarArchivoAntesDeSubir,
} from "./uploadErrorUtils";

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Componente principal para gestionar documentos y carpetas de un Grupo Familiar
 * @param {boolean} show - Controla la visibilidad del modal
 * @param {function} onHide - Función para cerrar el modal
 * @param {number|string} grupoFamiliarId - ID del grupo familiar
 */
const GestorDocumentosGrupoFamiliar = ({ show, onHide, grupoFamiliarId }) => {
  const canManageTrash = useCanManageDocumentTrash();
  const { refreshAppSettings } = useAppSettings();
  const [carpetas, setCarpetas] = useState([]);
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [vistaPapelera, setVistaPapelera] = useState(false);
  const [eliminados, setEliminados] = useState({ carpetas: [], archivos: [] });
  const [loadingEliminados, setLoadingEliminados] = useState(false);
  const [procesandoPapeleraId, setProcesandoPapeleraId] = useState(null);
  const [loadingCarpetas, setLoadingCarpetas] = useState(false);
  const [loadingArchivos, setLoadingArchivos] = useState(false);
  const [subiendoArchivos, setSubiendoArchivos] = useState(false);
  const [progresoSubida, setProgresoSubida] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [preview, setPreview] = useState({
    show: false,
    archivo: null,
    url: "",
    loading: false,
  });
  const [modoTransicionAnios, setModoTransicionAnios] = useState(false);
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  const superPasswordRef = useRef(null);
  const superModalResolverRef = useRef(null);

  const solicitarSuperPassword = useCallback(() => {
    return new Promise((resolve) => {
      superModalResolverRef.current = resolve;
      setShowSuperAdminModal(true);
    });
  }, []);

  const handleSuperAdminSuccess = (password) => {
    superPasswordRef.current = password;
    if (superModalResolverRef.current) {
      superModalResolverRef.current(password);
      superModalResolverRef.current = null;
    }
    setShowSuperAdminModal(false);
  };

  const handleSuperAdminCancel = () => {
    if (superModalResolverRef.current) {
      superModalResolverRef.current(null);
      superModalResolverRef.current = null;
    }
    setShowSuperAdminModal(false);
  };

  const obtenerSuperPasswordSiAplica = async (carpeta) => {
    if (!requiresSuperPasswordForFolder(carpeta, carpetas, modoTransicionAnios)) {
      return null;
    }

    if (superPasswordRef.current) {
      return superPasswordRef.current;
    }

    const password = await solicitarSuperPassword();
    if (!password) {
      return null;
    }

    superPasswordRef.current = password;
    return password;
  };

  // Cargar carpetas al montar el componente o cuando cambia el grupo familiar
  useEffect(() => {
    if (show && grupoFamiliarId) {
      cargarCarpetas();
      refreshAppSettings().catch(() => {});
      systemConfigService
        .getRuntime()
        .then((runtime) => {
          setModoTransicionAnios(!!runtime?.allow_family_document_archive_folders);
        })
        .catch(() => setModoTransicionAnios(false));
    } else {
      // Limpiar estado al cerrar
      setCarpetas([]);
      setCarpetaSeleccionada(null);
      setArchivos([]);
      setError("");
      setSuccess("");
      setSubiendoArchivos(false);
      setProgresoSubida(null);
      setModoTransicionAnios(false);
      setVistaPapelera(false);
      setEliminados({ carpetas: [], archivos: [] });
      setProcesandoPapeleraId(null);
      superPasswordRef.current = null;
      setPreview({ show: false, archivo: null, url: "", loading: false });
    }
  }, [show, grupoFamiliarId]);

  useEffect(() => {
    if (show && grupoFamiliarId && vistaPapelera && canManageTrash) {
      cargarEliminados();
    }
  }, [show, grupoFamiliarId, vistaPapelera, canManageTrash]);

  // Cargar archivos cuando se selecciona una carpeta
  useEffect(() => {
    if (carpetaSeleccionada && grupoFamiliarId) {
      // Solo intentar cargar si hay una carpeta seleccionada
      cargarArchivos();
    } else {
      setArchivos([]);
      setError(""); // Limpiar errores al deseleccionar
    }
  }, [carpetaSeleccionada, grupoFamiliarId]);

  /**
   * Carga las carpetas del grupo familiar desde el backend
   * Usa el endpoint: GET /api/document-folders/grupo-familiar/{grupoFamiliarId}
   * Retorna un array de DocumentFolder con: id, nombre, slug, parent_id, tipo, grupo_familiar_id, etc.
   */
  const cargarCarpetas = async () => {
    if (!grupoFamiliarId) return;

    setLoadingCarpetas(true);
    setError("");

    try {
      const response = await apiRequest(
        `document-folders/grupo-familiar/${grupoFamiliarId}`,
        "GET"
      );
      
      // El backend devuelve un array de DocumentFolder
      // Campos: id, grupo_familiar_id, nombre, slug, parent_id, tipo, path_s3, created_at, updated_at
      const data = response?.data || response || [];
      setCarpetas(Array.isArray(data) ? data : []);
      
      console.log("Carpetas cargadas:", Array.isArray(data) ? data.length : 0);
    } catch (err) {
      console.error("Error al cargar carpetas:", err);
      setError(err?.message || "No se pudieron cargar las carpetas");
      setCarpetas([]);
    } finally {
      setLoadingCarpetas(false);
    }
  };

  const cargarEliminados = async () => {
    if (!grupoFamiliarId || !canManageTrash) return;

    setLoadingEliminados(true);
    setError("");

    try {
      const response = await apiRequest(
        `document-folders/grupo-familiar/${grupoFamiliarId}/eliminados`,
        "GET"
      );

      const data = response?.data || response || {};
      setEliminados({
        carpetas: Array.isArray(data.carpetas) ? data.carpetas : [],
        archivos: Array.isArray(data.archivos) ? data.archivos : [],
      });
    } catch (err) {
      console.error("Error al cargar papelera:", err);
      setError(err?.message || "No se pudo cargar la papelera de documentos");
      setEliminados({ carpetas: [], archivos: [] });
    } finally {
      setLoadingEliminados(false);
    }
  };

  const cambiarVista = (mostrarPapelera) => {
    setVistaPapelera(mostrarPapelera);
    setError("");
    setSuccess("");

    if (!mostrarPapelera) {
      setCarpetaSeleccionada(null);
      setArchivos([]);
    }
  };

  /**
   * Carga los archivos de la carpeta seleccionada
   * Usa el endpoint: GET /api/documentos-adjuntos/carpeta/{carpetaId}
   */
  const cargarArchivos = async () => {
    if (!carpetaSeleccionada || !grupoFamiliarId) {
      setArchivos([]);
      return;
    }

    setLoadingArchivos(true);
    setError("");

    try {
      console.log("Cargando archivos para carpeta:", carpetaSeleccionada.id);
      
      // Usar el endpoint específico para listar archivos por carpeta
      const response = await apiRequest(
        `documentos-adjuntos/carpeta/${carpetaSeleccionada.id}`,
        "GET"
      );
      
      console.log("Respuesta del endpoint:", response);
      
      // El backend devuelve directamente un array de DocumentoAdjunto
      // con campos: id, nombre_original, ruta_archivo, tipo_mime, carpeta_id, 
      // grupo_familiar_id, cliente_id, cobertura_id, categoria, url (accessor)
      let archivosList = [];
      
      if (Array.isArray(response)) {
        archivosList = response;
      } else if (response?.data && Array.isArray(response.data)) {
        archivosList = response.data;
      } else {
        archivosList = [];
      }

      // Ordenar por fecha de creación (más reciente primero)
      archivosList = archivosList.sort((a, b) => {
        const fechaA = new Date(a.created_at || a.createdAt || 0);
        const fechaB = new Date(b.created_at || b.createdAt || 0);
        return fechaB - fechaA;
      });

      console.log("Archivos cargados:", archivosList.length);
      setArchivos(archivosList);
      
    } catch (err) {
      console.error("Error al cargar archivos:", err);
      const errorMessage = err?.message || "Error desconocido al cargar archivos";
      
      // Si es un 404, el endpoint puede no existir aún
      if (errorMessage.toLowerCase().includes("not found") || 
          errorMessage.toLowerCase().includes("could not be found") ||
          errorMessage.toLowerCase().includes("404")) {
        console.log("Endpoint no encontrado, intentando fallback...");
        // Fallback: intentar con query params
        try {
          const fallbackResponse = await apiRequest(
            `documentos-adjuntos?grupo_familiar_id=${grupoFamiliarId}&carpeta_id=${carpetaSeleccionada.id}`,
            "GET"
          );
          const fallbackData = Array.isArray(fallbackResponse) 
            ? fallbackResponse 
            : (fallbackResponse?.data || []);
          setArchivos(Array.isArray(fallbackData) ? fallbackData : []);
        } catch (fallbackErr) {
          setError(`No se pudieron cargar los archivos. Verifica que el endpoint esté disponible.`);
          setArchivos([]);
        }
      } else {
        setError(`No se pudieron cargar los archivos: ${errorMessage}`);
        setArchivos([]);
      }
    } finally {
      setLoadingArchivos(false);
    }
  };

  /**
   * Crea una nueva carpeta (puede ser subcarpeta si se proporciona parentId)
   * Usa el endpoint: POST /api/document-folders
   * Payload: { grupo_familiar_id, nombre, tipo, parent_id? }
   */
  const handleSelectCarpeta = async (carpeta) => {
    if (!carpeta) {
      setCarpetaSeleccionada(null);
      return;
    }

    const password = await obtenerSuperPasswordSiAplica(carpeta);
    if (
      requiresSuperPasswordForFolder(carpeta, carpetas, modoTransicionAnios) &&
      !password
    ) {
      return;
    }

    setCarpetaSeleccionada(carpeta);
  };

  const handleCrearCarpeta = async (nombre, tipo = "general", parentId = null) => {
    if (!grupoFamiliarId || !nombre?.trim()) {
      setError("El nombre de la carpeta es requerido");
      return;
    }

    setError("");
    setSuccess("");

    let superPassword = null;

    if (!parentId) {
      const validacion = validarNombreCarpetaRaiz(nombre, modoTransicionAnios);
      if (typeof validacion === "string") {
        setError(validacion);
        return;
      }
      if (validacion?.needsSuperPassword) {
        superPassword = await solicitarSuperPassword();
        if (!superPassword) return;
        superPasswordRef.current = superPassword;
      }
    }

    try {
      const nombreTrim = nombre.trim();
      const payload = {
        grupo_familiar_id: Number(grupoFamiliarId),
        nombre: nombreTrim,
        tipo: !parentId
          ? (isValidYearName(nombreTrim) ? "anio" : "general")
          : tipo || "general",
      };

      if (parentId) {
        payload.parent_id = Number(parentId);
      }

      if (superPassword) {
        payload.super_password = superPassword;
      }

      const response = await apiRequest("document-folders", "POST", payload);

      // El backend devuelve el DocumentFolder creado
      const nuevaCarpeta = response?.data || response;
      
      // Refrescar lista de carpetas
      await cargarCarpetas();
      
      // Seleccionar la nueva carpeta automáticamente
      if (nuevaCarpeta?.id) {
        setCarpetaSeleccionada(nuevaCarpeta);
      }

      setSuccess(parentId ? "Subcarpeta creada exitosamente" : "Carpeta creada exitosamente");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error al crear carpeta:", err);
      const mensaje = err?.message || "No se pudo crear la carpeta";
      if (mensaje.toLowerCase().includes("eliminados") && mensaje.toLowerCase().includes("reservado")) {
        setError(
          canManageTrash
            ? "La carpeta «Eliminados» la crea el sistema automáticamente. Use la pestaña «Eliminados» (arriba a la derecha) para ver la papelera."
            : "El nombre «Eliminados» está reservado por el sistema. Solo el super usuario configurado en Vantun puede ver la papelera."
        );
      } else {
        setError(mensaje);
      }
    }
  };

  const handleRenombrarCarpeta = async (carpetaId, nuevoNombre) => {
    if (!nuevoNombre?.trim()) {
      setError("El nombre de la carpeta es requerido");
      return;
    }

    setError("");
    setSuccess("");

    try {
      // Backend expone: PUT /api/document-folders/{id}
      // apiRequest ya se encarga de anteponer el prefijo /api
      await apiRequest(`document-folders/${carpetaId}`, "PUT", {
        nombre: nuevoNombre.trim(),
      });

      // Refrescar lista de carpetas
      await cargarCarpetas();
      
      // Si la carpeta renombrada estaba seleccionada, actualizar su referencia
      if (carpetaSeleccionada?.id === carpetaId) {
        setCarpetaSeleccionada((prev) => ({
          ...prev,
          nombre: nuevoNombre.trim(),
        }));
      }

      setSuccess("Carpeta renombrada exitosamente");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error al renombrar carpeta:", err);
      setError(err?.message || "No se pudo renombrar la carpeta. Verifica que el endpoint esté disponible.");
    }
  };

  /**
   * Verifica si una carpeta es descendiente de otra.
   */
  const esDescendienteDe = (carpetaId, posibleAncestroId, listaCarpetas) => {
    let actual = listaCarpetas.find((c) => c.id === carpetaId);

    while (actual) {
      const parentId = actual.parent_id ?? actual.parentId ?? null;
      if (parentId === posibleAncestroId) return true;
      if (!parentId) return false;
      actual = listaCarpetas.find((c) => c.id === parentId);
    }

    return false;
  };

  /**
   * Elimina una carpeta con todo su contenido (archivos y subcarpetas).
   * Backend: DELETE /api/document-folders/{id}?recursive=true
   */
  const handleEliminarCarpeta = async (carpeta) => {
    const carpetaId = carpeta?.id ?? carpeta;
    const nombre = typeof carpeta === "object" ? carpeta?.nombre : "";

    if (!carpetaId) return;

    const confirmar = window.confirm(
      `¿Eliminar la carpeta${nombre ? ` "${nombre}"` : ""} y su contenido?\n\n` +
        "Se moverá a la papelera y podrá restaurarse después.\n" +
        "Solo el super usuario configurado en Vantun podrá verla en Eliminados."
    );
    if (!confirmar) return;

    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `document-folders/${carpetaId}?recursive=true`,
        "DELETE"
      );

      if (
        carpetaSeleccionada &&
        (carpetaSeleccionada.id === carpetaId ||
          esDescendienteDe(carpetaSeleccionada.id, carpetaId, carpetas))
      ) {
        setCarpetaSeleccionada(null);
        setArchivos([]);
      }

      await cargarCarpetas();

      const archivosEliminados = response?.archivos_eliminados ?? 0;
      const carpetasEliminadas = response?.carpetas_eliminadas ?? 1;
      const detalle =
        archivosEliminados > 0
          ? ` (${archivosEliminados} archivo(s) y ${carpetasEliminadas} carpeta(s))`
          : "";

      setSuccess(`Carpeta movida a la papelera${detalle}`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Error al eliminar carpeta:", err);
      setError(err?.message || "No se pudo eliminar la carpeta");
    }
  };

  /**
   * Sube un archivo a una carpeta específica (con reintentos ante fallos de red).
   */
  const subirArchivoACarpeta = async (file, carpetaId, opciones = {}) => {
    const maxIntentos = opciones.maxIntentos ?? 5;
    const pausaMs = opciones.pausaMs ?? 2000;
    const timeoutMs = opciones.timeoutMs ?? calcularTimeoutSubida(file?.size);
    const carpetaDestino =
      opciones.carpetaDestino ||
      carpetas.find((c) => c.id === carpetaId) ||
      carpetaSeleccionada;

    const superPassword = carpetaDestino
      ? await obtenerSuperPasswordSiAplica(carpetaDestino)
      : null;

    if (
      carpetaDestino &&
      requiresSuperPasswordForFolder(carpetaDestino, carpetas, modoTransicionAnios) &&
      !superPassword
    ) {
      throw new Error(
        "Se requiere la clave del super administrador para subir archivos a este año."
      );
    }

    return ejecutarConReintentos(
      async () => {
        const formData = new FormData();
        formData.append("archivo", file, file.name);
        formData.append("entidad_tipo", "grupo_familiar");
        formData.append("entidad_id", String(grupoFamiliarId));
        formData.append("grupo_familiar_id", String(grupoFamiliarId));
        formData.append("carpeta_id", String(carpetaId));
        formData.append("categoria", "general");

        if (superPassword) {
          formData.append("super_password", superPassword);
        }

        return apiRequestFormData(
          "documentos-adjuntos/entity-upload",
          "POST",
          formData,
          { timeoutMs }
        );
      },
      { maxIntentos, pausaMs }
    );
  };

  /**
   * Crea la jerarquía de subcarpetas bajo la carpeta seleccionada.
   */
  const asegurarJerarquiaCarpetas = async (files, carpetaBaseId, onProgreso) => {
    const rutas = obtenerRutasCarpetasUnicas(files);
    const mapaRutas = {};
    const errores = [];

    for (let i = 0; i < rutas.length; i++) {
      const ruta = rutas[i];
      const segmentos = ruta.split("/").filter(Boolean);

      onProgreso?.({
        fase: "preparando_carpetas",
        carpetaActual: ruta,
        completados: i,
        total: rutas.length,
        porcentaje: Math.round((i / Math.max(rutas.length, 1)) * 100),
      });

      try {
        const response = await ejecutarConReintentos(() =>
          apiRequest("document-folders/resolve-path", "POST", {
            grupo_familiar_id: Number(grupoFamiliarId),
            parent_id: Number(carpetaBaseId),
            segmentos,
          })
        );

        const carpetaId =
          response?.carpeta_id || response?.carpeta?.id || response?.data?.carpeta_id;

        if (carpetaId) {
          mapaRutas[ruta] = carpetaId;
        } else {
          errores.push({
            ruta,
            mensaje: `No se pudo crear la subcarpeta "${ruta}".`,
          });
        }
      } catch (err) {
        errores.push({
          ruta,
          mensaje: formatearErrorApi(err),
        });
      }
    }

    return { mapaRutas, errores };
  };

  const actualizarProgresoSubida = (datos) => {
    setProgresoSubida((prev) => ({
      ...prev,
      ...datos,
    }));
  };

  /**
   * Sube uno o más archivos a la carpeta seleccionada.
   * Soporta carpetas completas con subcarpetas (drag & drop o adjuntar).
   */
  const handleSubirArchivos = async (files) => {
    if (!carpetaSeleccionada || !grupoFamiliarId || !files || files.length === 0) {
      setError("Selecciona una carpeta del panel izquierdo y al menos un archivo o carpeta para subir.");
      return;
    }

    setError("");
    setSuccess("");
    setSubiendoArchivos(true);

    const { conEstructura, planos } = clasificarArchivosSubida(files);
    const esCarpetaCompleta = conEstructura.length > 0;
    const colaSubida = [
      ...planos.map((file) => ({
        file,
        carpetaId: carpetaSeleccionada.id,
        ruta: file.name,
      })),
      ...conEstructura.map((file) => {
        const segmentos = obtenerSegmentosCarpeta(file.webkitRelativePath || "");
        return {
          file,
          carpetaId: null,
          ruta: file.webkitRelativePath || file.name,
          segmentos,
        };
      }),
    ].sort((a, b) => (a.file?.size || 0) - (b.file?.size || 0));

    setProgresoSubida({
      fase: esCarpetaCompleta ? "preparando_carpetas" : "subiendo",
      total: colaSubida.length,
      completados: 0,
      porcentaje: 0,
      archivoActual: "",
      carpetaActual: "",
      esCarpetaCompleta,
    });

    const errores = [];
    const fallidosRecuperables = [];
    let totalSubidos = 0;

    const procesarColaSubida = async (cola, opciones = {}) => {
      const esRecuperacion = opciones.esRecuperacion ?? false;

      for (let i = 0; i < cola.length; i++) {
        const item = cola[i];
        const { file } = item;

        let carpetaDestino = item.carpetaId;
        if (item.segmentos) {
          const rutaCarpeta = item.segmentos.join("/");
          carpetaDestino = rutaCarpeta ? mapaRutas[rutaCarpeta] : carpetaSeleccionada.id;
        }

        const errorValidacion = validarArchivoAntesDeSubir(file);
        if (errorValidacion) {
          errores.push({
            archivo: file.name,
            ruta: item.ruta,
            mensaje: errorValidacion,
          });
          continue;
        }

        if (!carpetaDestino) {
          errores.push({
            archivo: file.name,
            ruta: item.ruta,
            mensaje: `No se encontró la carpeta destino para "${file.name}".`,
          });
          continue;
        }

        actualizarProgresoSubida({
          fase: esRecuperacion ? "reintentando" : "subiendo",
          total: colaSubida.length,
          completados: i,
          porcentaje: Math.round((i / Math.max(cola.length, 1)) * 100),
          archivoActual: file.name,
          carpetaActual: item.ruta !== file.name ? item.ruta : "",
          esCarpetaCompleta,
        });

        try {
          await subirArchivoACarpeta(file, carpetaDestino, {
            maxIntentos: opciones.maxIntentos,
            pausaMs: opciones.pausaMs,
            timeoutMs: opciones.timeoutMs ?? calcularTimeoutSubida(file?.size),
          });
          totalSubidos += 1;

          const errorIdx = errores.findIndex(
            (e) => e.archivo === file.name && e.ruta === item.ruta
          );
          if (errorIdx >= 0) {
            errores.splice(errorIdx, 1);
          }

          if (!esRecuperacion) {
            const indiceGlobal = colaSubida.findIndex(
              (c) => c.file === file && c.ruta === item.ruta
            );
            if (i < cola.length - 1) {
              await esperar(calcularPausaTrasSubida(file.size, indiceGlobal));
            }
          }
        } catch (err) {
          const detalleError = {
            archivo: file.name,
            ruta: item.ruta,
            mensaje: formatearErrorApi(err, file),
          };

          if (!esRecuperacion) {
            fallidosRecuperables.push({
              file,
              carpetaId: carpetaDestino,
              ruta: item.ruta,
              segmentos: item.segmentos,
            });
          }

          const existente = errores.findIndex(
            (e) => e.archivo === file.name && e.ruta === item.ruta
          );
          if (existente >= 0) {
            errores[existente] = detalleError;
          } else {
            errores.push(detalleError);
          }
        }
      }
    };

    let mapaRutas = {};

    try {
      if (conEstructura.length > 0) {
        const resultadoJerarquia = await asegurarJerarquiaCarpetas(
          conEstructura,
          carpetaSeleccionada.id,
          actualizarProgresoSubida
        );
        mapaRutas = resultadoJerarquia.mapaRutas;
        errores.push(...resultadoJerarquia.errores);
      }

      await procesarColaSubida(colaSubida);

      if (fallidosRecuperables.length > 0) {
        actualizarProgresoSubida({
          fase: "reintentando",
          total: fallidosRecuperables.length,
          completados: 0,
          porcentaje: 0,
          archivoActual: "",
          esCarpetaCompleta,
        });

        await esperar(4000);

        await procesarColaSubida(
          fallidosRecuperables.map((item) => ({
            file: item.file,
            carpetaId: item.carpetaId,
            ruta: item.ruta,
            segmentos: item.segmentos,
          })),
          {
            esRecuperacion: true,
            maxIntentos: 4,
            pausaMs: 3000,
            timeoutMs: 300000,
          }
        );
      }

      actualizarProgresoSubida({
        fase: "finalizando",
        completados: colaSubida.length,
        porcentaje: 100,
      });

      if (conEstructura.length > 0) {
        await cargarCarpetas();
      }
      await cargarArchivos();

      if (errores.length > 0 && totalSubidos > 0) {
        setError(formatearResumenErroresSubida(errores, totalSubidos));
        const mensajeCarpetas = esCarpetaCompleta ? " (carpeta con estructura)" : "";
        setSuccess(`${totalSubidos} archivo(s) subido(s) correctamente${mensajeCarpetas}. Revisa los errores indicados.`);
        setTimeout(() => setSuccess(""), 5000);
      } else if (errores.length > 0) {
        setError(formatearResumenErroresSubida(errores, 0));
      } else {
        const mensajeCarpetas = esCarpetaCompleta ? " con su estructura de carpetas" : "";
        setSuccess(`${totalSubidos} archivo(s) subido(s) exitosamente${mensajeCarpetas}`);
        setTimeout(() => setSuccess(""), 4000);
      }
    } catch (err) {
      console.error("Error al subir archivos:", err);
      setError(
        `Error inesperado durante la subida: ${formatearErrorApi(err)}`
      );
    } finally {
      setSubiendoArchivos(false);
      setProgresoSubida(null);
    }
  };

  const obtenerUrlArchivo = async (archivoId, archivo = null) => {
    if (archivo?.url) {
      return archivo.url;
    }

    const response = await apiRequest(`documentos-adjuntos/${archivoId}/descargar`, "GET");
    return response?.url || response?.data?.url || response?.ruta_archivo || "";
  };

  /**
   * Abre el visualizador del documento (PDF, imágenes, etc.)
   */
  const handleVisualizarArchivo = async (archivoId, archivo = null) => {
    setPreview({
      show: true,
      archivo,
      url: "",
      loading: true,
    });

    try {
      const url = await obtenerUrlArchivo(archivoId, archivo);
      setPreview({
        show: true,
        archivo,
        url,
        loading: false,
      });
    } catch (err) {
      console.error("Error al visualizar archivo:", err);
      setPreview({ show: false, archivo: null, url: "", loading: false });
      setError("No se pudo abrir la vista previa del documento.");
    }
  };

  /**
   * Descarga un archivo usando el endpoint: GET api/documentos-adjuntos/{id}/descargar
   * El backend devuelve la URL del archivo en S3 (usando el accessor 'url')
   */
  const handleDescargarArchivo = async (archivoId, archivo = null) => {
    try {
      const url = await obtenerUrlArchivo(archivoId, archivo);

      if (url) {
        window.open(url, "_blank");
      } else {
        // Fallback: construir la URL del endpoint directamente
        const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
        const downloadUrl = `${API_BASE.replace(/\/+$/, "")}/documentos-adjuntos/${archivoId}/descargar`;
        window.open(downloadUrl, "_blank");
      }
    } catch (err) {
      console.error("Error al descargar archivo:", err);
      // Fallback: intentar abrir el endpoint directamente
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
        const downloadUrl = `${API_BASE.replace(/\/+$/, "")}/documentos-adjuntos/${archivoId}/descargar`;
        window.open(downloadUrl, "_blank");
      } catch (err2) {
        setError(err2?.message || "No se pudo descargar el archivo");
      }
    }
  };

  /**
   * Elimina un archivo usando el endpoint: DELETE api/documentos-adjuntos/{id}
   */
  const handleEliminarArchivo = async (archivoId, nombreArchivo) => {
    const confirmar = window.confirm(
      `¿Mover "${nombreArchivo}" a la papelera?\n\nPodrá restaurarse desde la sección Eliminados.`
    );

    if (!confirmar) return;

    setError("");
    setSuccess("");

    try {
      await apiRequest(`documentos-adjuntos/${archivoId}`, "DELETE");

      // Refrescar lista de archivos
      setTimeout(async () => {
        await cargarArchivos();
      }, 300);

      setSuccess("Archivo movido a la papelera");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error al eliminar archivo:", err);
      setError(err?.message || "No se pudo eliminar el archivo");
    }
  };

  const handleRestaurarArchivo = async (archivo) => {
    if (!archivo?.id) return;

    setError("");
    setSuccess("");
    setProcesandoPapeleraId(`archivo-${archivo.id}`);

    try {
      await apiRequest(`documentos-adjuntos/${archivo.id}/restaurar`, "POST");
      await cargarEliminados();
      await cargarCarpetas();
      setSuccess(`"${archivo.nombre_original || "Archivo"}" restaurado correctamente`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err?.message || "No se pudo restaurar el archivo");
    } finally {
      setProcesandoPapeleraId(null);
    }
  };

  const handleRestaurarCarpeta = async (carpeta) => {
    if (!carpeta?.id) return;

    setError("");
    setSuccess("");
    setProcesandoPapeleraId(`carpeta-${carpeta.id}`);

    try {
      await apiRequest(`document-folders/${carpeta.id}/restaurar`, "POST");
      await cargarEliminados();
      await cargarCarpetas();
      setSuccess(`Carpeta "${carpeta.nombre || ""}" restaurada correctamente`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err?.message || "No se pudo restaurar la carpeta");
    } finally {
      setProcesandoPapeleraId(null);
    }
  };

  const handleEliminarArchivoPermanente = async (archivo) => {
    if (!archivo?.id) return;

    const confirmar = window.confirm(
      `¿Eliminar definitivamente "${archivo.nombre_original || "este archivo"}"?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setError("");
    setSuccess("");
    setProcesandoPapeleraId(`archivo-${archivo.id}`);

    try {
      await apiRequest(`documentos-adjuntos/${archivo.id}/permanente`, "DELETE");
      await cargarEliminados();
      setSuccess("Archivo eliminado definitivamente");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err?.message || "No se pudo eliminar el archivo definitivamente");
    } finally {
      setProcesandoPapeleraId(null);
    }
  };

  const handleEliminarCarpetaPermanente = async (carpeta) => {
    if (!carpeta?.id) return;

    const confirmar = window.confirm(
      `¿Eliminar definitivamente la carpeta "${carpeta.nombre || ""}" y todo su contenido?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setError("");
    setSuccess("");
    setProcesandoPapeleraId(`carpeta-${carpeta.id}`);

    try {
      await apiRequest(`document-folders/${carpeta.id}/permanente?recursive=true`, "DELETE");
      await cargarEliminados();
      setSuccess("Carpeta eliminada definitivamente");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err?.message || "No se pudo eliminar la carpeta definitivamente");
    } finally {
      setProcesandoPapeleraId(null);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="fas fa-folder-open me-2"></i>
          Gestor de Documentos del Grupo Familiar
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ minHeight: "500px" }}>
        {canManageTrash && (
          <div className="d-flex justify-content-end mb-3">
            <div className="btn-group">
              <Button
                variant={!vistaPapelera ? "primary" : "outline-primary"}
                onClick={() => cambiarVista(false)}
              >
                <i className="fas fa-folder me-1"></i>
                Documentos
              </Button>
              <Button
                variant={vistaPapelera ? "warning" : "outline-warning"}
                onClick={() => cambiarVista(true)}
              >
                <i className="fas fa-trash-restore me-1"></i>
                Eliminados
              </Button>
            </div>
          </div>
        )}

        {/* Mensajes de error y éxito */}
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError("")}>
            <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
          </Alert>
        )}
        {success && (
          <Alert variant="success" dismissible onClose={() => setSuccess("")}>
            {success}
          </Alert>
        )}

        {/* Layout de dos columnas o papelera */}
        {vistaPapelera ? (
          <TrashList
            carpetas={eliminados.carpetas}
            archivos={eliminados.archivos}
            loading={loadingEliminados}
            procesandoId={procesandoPapeleraId}
            onRestaurarArchivo={handleRestaurarArchivo}
            onRestaurarCarpeta={handleRestaurarCarpeta}
            onEliminarArchivoPermanente={handleEliminarArchivoPermanente}
            onEliminarCarpetaPermanente={handleEliminarCarpetaPermanente}
          />
        ) : (
        <div className="row g-3">
          {/* Columna izquierda: Lista de carpetas */}
          <div className="col-md-4 border-end">
            <FolderList
              carpetas={carpetas}
              carpetaSeleccionada={carpetaSeleccionada}
              loading={loadingCarpetas}
              onSelectCarpeta={handleSelectCarpeta}
              onCrearCarpeta={handleCrearCarpeta}
              onRenombrarCarpeta={handleRenombrarCarpeta}
              onEliminarCarpeta={handleEliminarCarpeta}
              grupoFamiliarId={grupoFamiliarId}
              modoTransicionAnios={modoTransicionAnios}
              anioActual={getCurrentYear()}
            />
          </div>

          {/* Columna derecha: Lista de archivos */}
          <div className="col-md-8">
            {carpetaSeleccionada ? (
              <FilesList
                archivos={archivos}
                loading={loadingArchivos}
                subiendo={subiendoArchivos}
                progresoSubida={progresoSubida}
                carpetaSeleccionada={carpetaSeleccionada}
                onSubirArchivos={handleSubirArchivos}
                onDescargarArchivo={handleDescargarArchivo}
                onVisualizarArchivo={handleVisualizarArchivo}
                onEliminarArchivo={handleEliminarArchivo}
              />
            ) : (
              <div className="text-center text-muted py-5">
                <i className="fas fa-folder-open fa-3x mb-3 opacity-50"></i>
                <p>Selecciona una carpeta para ver sus archivos</p>
              </div>
            )}
          </div>
        </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>

      <DocumentoPreviewModal
        key={preview.archivo?.id || "documento-preview"}
        show={preview.show}
        archivo={preview.archivo}
        url={preview.url}
        loading={preview.loading}
        onHide={() => setPreview({ show: false, archivo: null, url: "", loading: false })}
      />

      <SuperAdminPasswordModal
        show={showSuperAdminModal}
        onHide={handleSuperAdminCancel}
        onSuccess={handleSuperAdminSuccess}
        message="Para crear o acceder a carpetas de años anteriores debe ingresar la contraseña del super administrador configurado en el sistema."
      />
    </Modal>
  );
};

export default GestorDocumentosGrupoFamiliar;

