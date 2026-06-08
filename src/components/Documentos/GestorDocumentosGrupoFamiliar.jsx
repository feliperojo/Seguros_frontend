import React, { useState, useEffect } from "react";
import { Modal, Button, Spinner, Alert } from "react-bootstrap";
import apiRequest, { apiRequestFormData } from "../../services/api";
import FolderList from "./FolderList";
import FilesList from "./FilesList";
import {
  clasificarArchivosSubida,
  obtenerRutasCarpetasUnicas,
  obtenerSegmentosCarpeta,
} from "./folderUploadUtils";

/**
 * Componente principal para gestionar documentos y carpetas de un Grupo Familiar
 * @param {boolean} show - Controla la visibilidad del modal
 * @param {function} onHide - Función para cerrar el modal
 * @param {number|string} grupoFamiliarId - ID del grupo familiar
 */
const GestorDocumentosGrupoFamiliar = ({ show, onHide, grupoFamiliarId }) => {
  const [carpetas, setCarpetas] = useState([]);
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [loadingCarpetas, setLoadingCarpetas] = useState(false);
  const [loadingArchivos, setLoadingArchivos] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Cargar carpetas al montar el componente o cuando cambia el grupo familiar
  useEffect(() => {
    if (show && grupoFamiliarId) {
      cargarCarpetas();
    } else {
      // Limpiar estado al cerrar
      setCarpetas([]);
      setCarpetaSeleccionada(null);
      setArchivos([]);
      setError("");
      setSuccess("");
    }
  }, [show, grupoFamiliarId]);

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
  const handleCrearCarpeta = async (nombre, tipo = "general", parentId = null) => {
    if (!grupoFamiliarId || !nombre?.trim()) {
      setError("El nombre de la carpeta es requerido");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const payload = {
        grupo_familiar_id: Number(grupoFamiliarId),
        nombre: nombre.trim(),
        tipo: tipo || "general",
      };

      // Si se proporciona parentId, agregarlo al payload
      if (parentId) {
        payload.parent_id = Number(parentId);
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
      setError(err?.message || "No se pudo crear la carpeta");
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
      `¿Eliminar la carpeta${nombre ? ` "${nombre}"` : ""} y TODO su contenido?\n\n` +
        "Se eliminarán permanentemente:\n" +
        "• Todos los archivos de la carpeta\n" +
        "• Todas las subcarpetas y sus archivos\n\n" +
        "Esta acción no se puede deshacer."
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

      setSuccess(`Carpeta eliminada exitosamente${detalle}`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Error al eliminar carpeta:", err);
      setError(err?.message || "No se pudo eliminar la carpeta");
    }
  };

  /**
   * Sube un archivo a una carpeta específica.
   */
  const subirArchivoACarpeta = async (file, carpetaId) => {
    const formData = new FormData();
    formData.append("archivo", file);
    formData.append("entidad_tipo", "grupo_familiar");
    formData.append("entidad_id", String(grupoFamiliarId));
    formData.append("grupo_familiar_id", String(grupoFamiliarId));
    formData.append("carpeta_id", String(carpetaId));
    formData.append("categoria", "general");

    return apiRequestFormData("documentos-adjuntos/entity-upload", "POST", formData);
  };

  /**
   * Crea la jerarquía de subcarpetas bajo la carpeta seleccionada.
   */
  const asegurarJerarquiaCarpetas = async (files, carpetaBaseId) => {
    const rutas = obtenerRutasCarpetasUnicas(files);
    const mapaRutas = {};

    for (const ruta of rutas) {
      const segmentos = ruta.split("/").filter(Boolean);
      const response = await apiRequest("document-folders/resolve-path", "POST", {
        grupo_familiar_id: Number(grupoFamiliarId),
        parent_id: Number(carpetaBaseId),
        segmentos,
      });

      const carpetaId = response?.carpeta_id || response?.carpeta?.id || response?.data?.carpeta_id;
      if (carpetaId) {
        mapaRutas[ruta] = carpetaId;
      }
    }

    return mapaRutas;
  };

  /**
   * Sube archivos respetando la estructura de carpetas anidadas.
   */
  const subirArchivosConJerarquia = async (files, carpetaBaseId) => {
    const mapaRutas = await asegurarJerarquiaCarpetas(files, carpetaBaseId);
    let subidos = 0;

    for (const file of files) {
      const segmentos = obtenerSegmentosCarpeta(file.webkitRelativePath || "");
      const ruta = segmentos.join("/");
      const carpetaDestino = ruta ? mapaRutas[ruta] : carpetaBaseId;

      if (!carpetaDestino) {
        throw new Error(`No se pudo resolver la carpeta destino para "${file.name}"`);
      }

      await subirArchivoACarpeta(file, carpetaDestino);
      subidos += 1;
    }

    return subidos;
  };

  /**
   * Sube uno o más archivos a la carpeta seleccionada.
   * Soporta carpetas completas con subcarpetas (drag & drop o adjuntar).
   */
  const handleSubirArchivos = async (files) => {
    if (!carpetaSeleccionada || !grupoFamiliarId || !files || files.length === 0) {
      setError("Selecciona una carpeta y al menos un archivo");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const { conEstructura, planos } = clasificarArchivosSubida(files);
      let totalSubidos = 0;

      if (planos.length > 0) {
        for (const file of planos) {
          await subirArchivoACarpeta(file, carpetaSeleccionada.id);
          totalSubidos += 1;
        }
      }

      if (conEstructura.length > 0) {
        const subidosJerarquia = await subirArchivosConJerarquia(
          conEstructura,
          carpetaSeleccionada.id
        );
        totalSubidos += subidosJerarquia;
        await cargarCarpetas();
      }

      setTimeout(async () => {
        await cargarArchivos();
      }, 500);

      const mensajeCarpetas = conEstructura.length > 0 ? " con su estructura de carpetas" : "";
      setSuccess(`${totalSubidos} archivo(s) subido(s) exitosamente${mensajeCarpetas}`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error al subir archivos:", err);
      const errorMessage = err?.message || "No se pudieron subir los archivos";
      setError(errorMessage);
      setTimeout(() => setError(""), 5000);
    }
  };

  /**
   * Descarga un archivo usando el endpoint: GET api/documentos-adjuntos/{id}/descargar
   * El backend devuelve la URL del archivo en S3 (usando el accessor 'url')
   */
  const handleDescargarArchivo = async (archivoId, archivo = null) => {
    try {
      // Si ya tenemos el objeto archivo con la URL, usarla directamente
      if (archivo?.url) {
        window.open(archivo.url, "_blank");
        return;
      }

      // Si no, obtener la URL desde el endpoint de descarga
      const response = await apiRequest(`documentos-adjuntos/${archivoId}/descargar`, "GET");
      
      // El backend devuelve la URL del archivo en S3
      const url = response?.url || response?.data?.url || response?.ruta_archivo;
      
      if (url) {
        // La URL ya viene completa desde S3 (Storage::disk('s3')->url(...))
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
      `¿Estás seguro de que deseas eliminar "${nombreArchivo}"?`
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

      setSuccess("Archivo eliminado exitosamente");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error al eliminar archivo:", err);
      setError(err?.message || "No se pudo eliminar el archivo");
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
        {/* Mensajes de error y éxito */}
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" dismissible onClose={() => setSuccess("")}>
            {success}
          </Alert>
        )}

        {/* Layout de dos columnas */}
        <div className="row g-3">
          {/* Columna izquierda: Lista de carpetas */}
          <div className="col-md-4 border-end">
            <FolderList
              carpetas={carpetas}
              carpetaSeleccionada={carpetaSeleccionada}
              loading={loadingCarpetas}
              onSelectCarpeta={setCarpetaSeleccionada}
              onCrearCarpeta={handleCrearCarpeta}
              onRenombrarCarpeta={handleRenombrarCarpeta}
              onEliminarCarpeta={handleEliminarCarpeta}
              grupoFamiliarId={grupoFamiliarId}
            />
          </div>

          {/* Columna derecha: Lista de archivos */}
          <div className="col-md-8">
            {carpetaSeleccionada ? (
              <FilesList
                archivos={archivos}
                loading={loadingArchivos}
                carpetaSeleccionada={carpetaSeleccionada}
                onSubirArchivos={handleSubirArchivos}
                onDescargarArchivo={handleDescargarArchivo}
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
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GestorDocumentosGrupoFamiliar;

