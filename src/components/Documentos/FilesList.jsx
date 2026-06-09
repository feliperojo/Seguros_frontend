import React, { useRef, useState } from "react";
import { Button, Table, Spinner, ProgressBar } from "react-bootstrap";
import { getFilesFromDataTransfer } from "./folderUploadUtils";

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
    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetDragState = () => {
    dragCounterRef.current = 0;
    setIsDragging(false);
  };

  /**
   * Maneja el drag enter (entrar al área de soltado)
   */
  const handleDragEnter = (e) => {
    if (subiendo) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };

  /**
   * Maneja el drag over (arrastrar sobre)
   */
  const handleDragOver = (e) => {
    if (subiendo) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  /**
   * Maneja el drag leave (salir del área de soltado).
   * Evita parpadeo: no ocultar si el cursor pasó a un elemento hijo.
   */
  const handleDragLeave = (e) => {
    if (subiendo) return;
    e.preventDefault();
    e.stopPropagation();

    const { currentTarget, relatedTarget } = e;
    if (relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
      return;
    }

    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  /**
   * Maneja el drop (soltar archivos o carpetas completas)
   */
  const handleDrop = async (e) => {
    if (subiendo) return;
    e.preventDefault();
    e.stopPropagation();
    resetDragState();

    try {
      const files = await getFilesFromDataTransfer(e.dataTransfer);
      if (files && files.length > 0) {
        onSubirArchivos(files);
      }
    } catch (err) {
      console.error("Error al leer archivos arrastrados:", err);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        onSubirArchivos(files);
      }
    }
  };

  /**
   * Formatea el tamaño del archivo
   */
  const formatearTamaño = (bytes) => {
    if (!bytes || bytes === 0) return "—";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  /**
   * Formatea la fecha para mostrar
   */
  const formatearFecha = (fecha) => {
    if (!fecha) return "";
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
      return "fa-file-image text-primary";
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
      className="h-100"
      ref={dropZoneRef}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: "relative",
        minHeight: "400px",
      }}
    >
      {/* Overlay de subida en progreso */}
      {subiendo && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255, 255, 255, 0.88)",
            borderRadius: "8px",
            zIndex: 1001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div className="w-100" style={{ maxWidth: "480px" }}>
            <div className="text-center mb-3">
              <Spinner animation="border" variant="primary" className="mb-2" />
              <p className="mb-1 fw-semibold text-primary">
                {obtenerTextoProgreso(progresoSubida)}
              </p>
              {progresoSubida?.total > 0 && (
                <small className="text-muted">
                  {progresoSubida.completados} de {progresoSubida.total} elementos procesados
                </small>
              )}
            </div>
            <ProgressBar
              now={progresoSubida?.porcentaje ?? 0}
              label={`${progresoSubida?.porcentaje ?? 0}%`}
              animated
              striped
              variant="primary"
            />
          </div>
        </div>
      )}

      {/* Overlay de drag and drop */}
      {isDragging && !subiendo && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 123, 255, 0.1)",
            border: "3px dashed #007bff",
            borderRadius: "8px",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div className="text-center">
            <i className="fas fa-cloud-upload-alt fa-4x text-primary mb-3"></i>
            <h5 className="text-primary">Suelta archivos o carpetas aquí</h5>
            <p className="text-muted">Se subirán a esta carpeta respetando su estructura</p>
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

      {/* Mensaje de ayuda para drag and drop */}
      {!isDragging && !subiendo && archivos.length === 0 && !loading && (
        <div className="text-center py-3 mb-3 border rounded bg-light">
          <i className="fas fa-hand-pointer fa-2x text-muted mb-2"></i>
          <p className="small text-muted mb-0">
            Arrastra y suelta archivos aquí o usa el botón "Subir archivo"
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
                <th style={{ width: "120px" }}>Acciones</th>
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
                    <div className="text-truncate" style={{ maxWidth: "300px" }} title={archivo.nombre_original}>
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
