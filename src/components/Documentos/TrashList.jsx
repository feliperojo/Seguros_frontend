import React from "react";
import { Alert, Button, Spinner, Table } from "react-bootstrap";

const formatearFecha = (fecha) => {
  if (!fecha) return "—";
  try {
    return new Date(fecha).toLocaleDateString("es-ES", {
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

const obtenerIcono = (tipoMime, nombre) => {
  const tipo = tipoMime?.toLowerCase() || "";
  const ext = nombre?.split(".").pop()?.toLowerCase() || "";

  if (tipo.includes("pdf") || ext === "pdf") return "fa-file-pdf text-danger";
  if (tipo.includes("image") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
    return "fa-file-image text-info";
  }

  return "fa-file text-secondary";
};

const TrashList = ({
  carpetas = [],
  archivos = [],
  loading = false,
  procesandoId = null,
  onRestaurarArchivo,
  onRestaurarCarpeta,
  onEliminarArchivoPermanente,
  onEliminarCarpetaPermanente,
}) => {
  const total = carpetas.length + archivos.length;

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <p className="text-muted small mt-2">Cargando papelera...</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="fas fa-trash-restore fa-3x mb-3 opacity-50"></i>
        <p>No hay documentos ni carpetas eliminados en este grupo familiar.</p>
      </div>
    );
  }

  return (
    <div>
      <Alert variant="warning" className="py-2 px-3 small">
        <i className="fas fa-exclamation-triangle me-2"></i>
        Los elementos aquí pueden restaurarse a su ubicación original o eliminarse
        definitivamente del sistema.
      </Alert>

      {carpetas.length > 0 && (
        <div className="mb-4">
          <h6 className="mb-2">
            <i className="fas fa-folder me-2 text-warning"></i>
            Carpetas eliminadas ({carpetas.length})
          </h6>
          <div className="table-responsive">
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Eliminado el</th>
                  <th style={{ width: "180px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {carpetas.map((carpeta) => (
                  <tr key={`carpeta-${carpeta.id}`}>
                    <td>{carpeta.nombre || "Sin nombre"}</td>
                    <td>
                      <small className="text-muted">
                        {formatearFecha(carpeta.deleted_at)}
                      </small>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <Button
                          variant="outline-success"
                          size="sm"
                          disabled={procesandoId === `carpeta-${carpeta.id}`}
                          onClick={() => onRestaurarCarpeta(carpeta)}
                          title="Restaurar carpeta"
                        >
                          <i className="fas fa-undo"></i>
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          disabled={procesandoId === `carpeta-${carpeta.id}`}
                          onClick={() => onEliminarCarpetaPermanente(carpeta)}
                          title="Eliminar definitivamente"
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
        </div>
      )}

      {archivos.length > 0 && (
        <div>
          <h6 className="mb-2">
            <i className="fas fa-file me-2 text-secondary"></i>
            Archivos eliminados ({archivos.length})
          </h6>
          <div className="table-responsive">
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}></th>
                  <th>Nombre</th>
                  <th>Eliminado el</th>
                  <th style={{ width: "180px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {archivos.map((archivo) => (
                  <tr key={`archivo-${archivo.id}`}>
                    <td className="text-center">
                      <i
                        className={`fas ${obtenerIcono(
                          archivo.tipo_mime,
                          archivo.nombre_original
                        )}`}
                      ></i>
                    </td>
                    <td>{archivo.nombre_original || "Sin nombre"}</td>
                    <td>
                      <small className="text-muted">
                        {formatearFecha(archivo.deleted_at)}
                      </small>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <Button
                          variant="outline-success"
                          size="sm"
                          disabled={procesandoId === `archivo-${archivo.id}`}
                          onClick={() => onRestaurarArchivo(archivo)}
                          title="Restaurar archivo"
                        >
                          <i className="fas fa-undo"></i>
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          disabled={procesandoId === `archivo-${archivo.id}`}
                          onClick={() => onEliminarArchivoPermanente(archivo)}
                          title="Eliminar definitivamente"
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
        </div>
      )}
    </div>
  );
};

export default TrashList;
