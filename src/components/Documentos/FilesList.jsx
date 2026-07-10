import React, { useRef, useState } from "react";
import { Alert, Button, Table, Spinner, ProgressBar } from "react-bootstrap";
import { getFilesFromDataTransfer } from "./folderUploadUtils";
import { TEXTO_LIMITE_SUBIDA } from "./uploadErrorUtils";
import { puedeVisualizarseEnNavegador } from "./archivoPreviewUtils";

/**
 * Componente para listar y gestionar archivos de una carpeta con drag and drop
 */
const obtenerTextoProgreso = (progresoSubida) => {
  if (!progresoSubida) return "Subiendo archivos...";

  const { fase, archivoActual, carpetaActual, completados, total, esCarpetaCompleta } =
    progresoSubida;

  if (fase === "preparando_carpetas") {
    return esCarpetaCompleta
      ? `Preparando estructura de carpetas${carpetaActual ? `: ${carpetaActual}` : ""}...`
      : "Preparando carpetas...";
  }

  if (fase === "reintentando") {
    return `Reintentando archivos que fallaron${archivoActual ? `: ${archivoActual}` : ""}...`;
  }

  if (fase === "finalizando") {
    return "Finalizando subida...";
  }

  const contador = total > 0 ? ` (${completados + 1} de ${total})` : "";
  const nombre = archivoActual ? `: ${archivoActual}` : "";
  const ruta = carpetaActual ? ` → ${carpetaActual}` : "";

  return `Subiendo archivo${nombre}${ruta}${contador}`;
};

const FilesList = ({
  archivos = [],
  loading,
  subiendo = false,
  progresoSubida = null,
  carpetaSeleccionada,
  onSubirArchivos,
  onDescargarArchivo,
  onVisualizarArchivo,
  onEliminarArchivo,
}) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef(null);
  const dragCounterRef = useRef(0);

  /**
   * Maneja la selección de archivos para subir
   */
  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onSubirArchivos(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetDragState = () => {
    dragCounterRef.current = 0;
    setIsDragging(false);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.types?.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      resetDragState();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  /**
   * Maneja el drop (soltar archivos o carpetas completas)
   */
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetDragState();

    if (subiendo) return;

    try {
      const files = await getFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) {
        onSubirArchivos(files);
      }
    } catch (err) {
      console.error("Error al leer archivos arrastrados:", err);
    }
  };

  /**
   * Formatea la fecha para mostrar
   */
  const formatearFecha = (fecha) => {
    if (!fecha) return "—";
    try {
      const d = new Date(fecha);
      return d.toLocaleDateString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return fecha;
    }
  };

  /**
   * Obtiene el icono según el tipo de archivo
   */
  const obtenerIcono = (tipoMime, nombre) => {
    if (!tipoMime && !nombre) return "fa-file";

    const tipo = tipoMime?.toLowerCase() || "";
    const ext = nombre?.split(".").pop()?.toLowerCase() || "";

    if (tipo.includes("pdf") || ext === "pdf") return "fa-file-pdf text-danger";
    if (tipo.includes("image") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext))
      return "fa-file-image text-info";
    if (tipo.includes("word") || ext === "doc" || ext === "docx")
      return "fa-file-word text-primary";
    if (tipo.includes("excel") || ext === "xls" || ext === "xlsx")
      return "fa-file-excel text-success";
    if (tipo.includes("zip") || ext === "zip" || ext === "rar")
      return "fa-file-archive text-warning";

    return "fa-file text-secondary";
  };

  return (
    <div
      ref={dropZoneRef}
      className="position-relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div
          className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            backgroundColor: "rgba(13, 110, 253, 0.1)",
            border: "2px dashed #0d6efd",
            borderRadius: "8px",
            zIndex: 1000,
            minHeight: "200px",
          }}
        >
          <div className="text-center">
            <i className="fas fa-cloud-upload-alt fa-3x text-primary mb-3"></i>
            <h5 className="text-primary">Suelta archivos o carpetas aquí</h5>
          </div>
        </div>
      )}

      <div
        style={{ pointerEvents: isDragging ? "none" : "auto" }}
      >
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">
          <i className="fas fa-file me-2"></i>
          Archivos en "{carpetaSeleccionada?.nombre || "Carpeta"}"
        </h6>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            webkitdirectory=""
            directory=""
            style={{ display: "none" }}
            onChange={handleFileSelect}
            accept="*/*"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={subiendo}
          >
            {subiendo ? (
              <>
                <Spinner animation="border" size="sm" className="me-1" />
                Subiendo...
              </>
            ) : (
              <>
                <i className="fas fa-upload me-1"></i>
                Subir archivo
              </>
            )}
          </Button>
        </div>
      </div>

      <Alert variant="info" className="py-2 px-3 mb-3 small">
        <i className="fas fa-info-circle me-2" />
        {TEXTO_LIMITE_SUBIDA}
      </Alert>

      {subiendo && (
        <div className="mb-3 p-3 border rounded bg-light">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <small className="fw-semibold text-primary">
              <i className="fas fa-cloud-upload-alt me-1"></i>
              {obtenerTextoProgreso(progresoSubida)}
            </small>
            <small className="text-muted">{progresoSubida?.porcentaje ?? 0}%</small>
          </div>
          <ProgressBar
            now={progresoSubida?.porcentaje ?? 0}
            animated
            striped
            variant="primary"
            style={{ height: "8px" }}
          />
        </div>
      )}

      {!isDragging && !subiendo && archivos.length === 0 && !loading && (
        <div className="text-center py-3 mb-3 border rounded bg-light">
          <i className="fas fa-hand-pointer fa-2x text-muted mb-2"></i>
          <p className="small text-muted mb-0">
            Arrastra archivos o carpetas aquí, o usa el botón "Subir archivo"
          </p>
        </div>
      )}

      {loading && !subiendo ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="text-muted small mt-2">Cargando archivos...</p>
        </div>
      ) : archivos.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="fas fa-file fa-3x mb-3 opacity-50"></i>
          <p>Esta carpeta no tiene archivos</p>
          <p className="small">Arrastra archivos aquí o usa el botón "Subir archivo"</p>
        </div>
      ) : (
        <div className="table-responsive">
          <Table striped bordered hover size="sm">
            <thead>
              <tr>
                <th style={{ width: "40px" }}></th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Fecha</th>
                <th style={{ width: "150px" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {archivos.map((archivo) => (
                <tr key={archivo.id}>
                  <td className="text-center">
                    <i
                      className={`fas ${obtenerIcono(
                        archivo.tipo_mime,
                        archivo.nombre_original
                      )}`}
                    ></i>
                  </td>
                  <td>
                    <div
                      className="text-truncate"
                      style={{ maxWidth: "300px" }}
                      title={archivo.nombre_original}
                    >
                      {archivo.nombre_original || "Sin nombre"}
                    </div>
                  </td>
                  <td>
                    <span className="badge bg-secondary">
                      {archivo.categoria || "general"}
                    </span>
                  </td>
                  <td>
                    <small className="text-muted">
                      {formatearFecha(archivo.created_at || archivo.createdAt)}
                    </small>
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      {puedeVisualizarseEnNavegador(
                        archivo.tipo_mime,
                        archivo.nombre_original
                      ) && (
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => onVisualizarArchivo(archivo.id, archivo)}
                          title="Visualizar"
                        >
                          <i className="fas fa-eye"></i>
                        </Button>
                      )}
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => onDescargarArchivo(archivo.id, archivo)}
                        title="Descargar"
                      >
                        <i className="fas fa-download"></i>
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() =>
                          onEliminarArchivo(
                            archivo.id,
                            archivo.nombre_original || "archivo"
                          )
                        }
                        title="Eliminar"
                      >
                        <i className="fas fa-trash"></i>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      </div>
    </div>
  );
};

export default FilesList;
