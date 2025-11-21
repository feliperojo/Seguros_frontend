// src/components/GrupoFamiliar/HistorialRenovacionesModal.jsx
import React, { useEffect, useState } from "react";
import apiRequest from "../../services/api"; // misma ruta que usas en otros componentes

const HistorialRenovacionesModal = ({ show, onHide, grupoFamiliarId }) => {
  const [versiones, setVersiones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (show && grupoFamiliarId) {
      cargarVersiones();
    }
  }, [show, grupoFamiliarId]);

  const cargarVersiones = async () => {
    try {
      setLoading(true);
      setSelectedVersion(null);
      setDeleteError("");

      const response = await apiRequest(
        `/grupo_familiar/${grupoFamiliarId}/versiones-historial`,
        "GET"
      );

      console.log("📌 Versiones recibidas:", response);

      let lista = [];

      // Soporta respuesta paginada de Laravel: { data: [ ... ] }
      if (Array.isArray(response)) {
        lista = response;
      } else if (Array.isArray(response?.data?.data)) {
        lista = response.data.data;
      } else if (Array.isArray(response?.data)) {
        lista = response.data;
      }

      setVersiones(lista);
    } catch (err) {
      console.error("❌ Error cargando historial:", err);
      setVersiones([]);
      setDeleteError("No se pudo cargar el historial de renovaciones.");
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  // -------- Helpers para el snapshot bonito --------
  const getSnapshot = () => {
    const raw =
      selectedVersion?.version ??
      selectedVersion?.json_snapshot ??
      null;

    if (!raw) return null;

    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.warn("No se pudo parsear json_snapshot:", e);
        return null;
      }
    }

    // Si ya viene como objeto desde Laravel (cast json), lo usamos tal cual
    return raw;
  };

  const snapshot = getSnapshot();
  const coberturas = Array.isArray(snapshot?.coberturas)
    ? snapshot.coberturas
    : [];

  const clientesSnapshot = Array.isArray(snapshot?.clientes)
    ? snapshot.clientes
    : [];

  const formatMoney = (value) => {
    if (value == null || value === "") return "—";
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatClienteLabel = (key) => {
    const map = {
      nombre_completo: "Nombre completo",
      nombre: "Nombre",
      tipo_documento: "Tipo de documento",
      numero_documento: "Número de documento",
      documento: "Documento",
      fecha_nacimiento: "Fecha de nacimiento",
      telefono: "Teléfono",
      telefono_1: "Teléfono 1",
      telefono_2: "Teléfono 2",
      email: "Correo electrónico",
      correo: "Correo electrónico",
      ciudad: "Ciudad",
      ciudad_residencia: "Ciudad de residencia",
      direccion: "Dirección",
      cod_tel_1: "Código Teléfono 1",
      cod_tel_2: "Código Teléfono 2",
      ingreso_anual: "Ingreso anual",
      ingreso_por_periodo: "Ingreso por período",
      periodo_ingreso: "Periodo de ingreso",
    };

    if (map[key]) return map[key];

    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatClienteValue = (key, value) => {
    if (value === null || value === undefined || value === "") return "—";

    if (
      typeof value === "string" &&
      key.toLowerCase().includes("fecha") &&
      (value.includes("T") || value.includes("Z"))
    ) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString();
      }
    }

    return String(value);
  };

  const anioOrigen = selectedVersion?.anio_origen ?? selectedVersion?.anio;
  const anioDestino =
    selectedVersion?.anio_destino ??
    (selectedVersion?.anio != null ? selectedVersion.anio + 1 : undefined);

  /* ========= ELIMINAR VERSIÓN ========= */
  const handleDeleteVersion = async (version) => {
    if (!version) return;

    const anio = version.anio_origen ?? version.anio ?? "¿?";
    const versionId = version.id; // 👈 ahora EXIGIMOS que venga el id real

    if (!versionId) {
      setDeleteError(
        `No se pudo identificar la versión del año ${anio} para eliminarla (no se recibió el ID).`
      );
      return;
    }

    const ok = window.confirm(
      `¿Seguro que quieres eliminar la versión de renovación del año ${anio}? ` +
        `Solo se elimina el historial, las coberturas actuales NO se tocan.`
    );
    if (!ok) return;

    try {
      setDeleteError("");

      await apiRequest(
        `/grupo_familiar/${grupoFamiliarId}/versiones-historial/${versionId}`,
        "DELETE"
      );

      // Quitarla de la lista en el UI
      setVersiones((prev) => prev.filter((v) => v.id !== versionId));

      if (selectedVersion && selectedVersion.id === versionId) {
        setSelectedVersion(null);
      }
    } catch (err) {
      console.error("Error eliminando versión:", err);

      const status = err?.response?.status;
      const msg = err?.response?.data?.message;

      if (status === 404) {
        setDeleteError(
          msg ||
            `La versión del año ${anio} ya no existe (probablemente ya fue eliminada).`
        );
        // Por si acaso, recargamos la lista desde el backend
        await cargarVersiones();
      } else {
        setDeleteError(
          msg || "Ocurrió un error al intentar eliminar la versión."
        );
      }
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1">
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Historial de renovaciones del grupo</h5>
            <button className="btn-close" onClick={onHide}></button>
          </div>

          <div className="modal-body d-flex">
            {/* IZQUIERDA: LISTA DE VERSIONES */}
            <div className="border-end pe-3" style={{ width: "30%" }}>
              <h6>Versiones / años disponibles</h6>

              {deleteError && (
                <div className="alert alert-danger small py-2">
                  {deleteError}
                </div>
              )}

              {loading && <p className="text-muted">Cargando historial…</p>}

              {!loading && versiones.length === 0 && (
                <p className="text-muted mb-0">
                  Aún no hay renovaciones registradas para este grupo.
                </p>
              )}

              {!loading &&
                versiones.length > 0 &&
                versiones.map((v) => {
                  const aOrigen = v.anio_origen ?? v.anio;
                  const isSelected = selectedVersion?.id === v.id;

                  return (
                    <div className="d-flex mb-2" key={v.id ?? `${aOrigen}-${Math.random()}`}>
                      <button
                        className={
                          "btn flex-grow-1 text-start " +
                          (isSelected ? "btn-primary" : "btn-outline-primary")
                        }
                        onClick={() => setSelectedVersion(v)}
                      >
                        {aOrigen ?? "¿?"}
                      </button>
                      {/* Botón de eliminar */}
                      <button
                        type="button"
                        className="btn btn-outline-danger ms-1"
                        title="Eliminar esta versión de renovación"
                        onClick={() => handleDeleteVersion(v)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
            </div>

            {/* DERECHA: DETALLE DE LA VERSIÓN */}
            <div className="ps-3 flex-grow-1">
              {!selectedVersion && (
                <div className="alert alert-info mb-0">
                  Selecciona un año en la lista de la izquierda para ver cómo
                  estaba conformado el grupo en ese momento.
                </div>
              )}

              {selectedVersion && (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h5 className="mb-1">
                        Renovación año{" "}
                        <strong>{anioOrigen ?? "¿?"}</strong>
                      </h5>
                      {anioDestino && (
                        <p className="mb-0">
                          <small className="text-muted">
                            Renovó hacia {anioDestino}
                          </small>
                        </p>
                      )}
                      <p className="mb-0">
                        <strong>Estado:</strong>{" "}
                        {selectedVersion.estado ?? "—"}
                      </p>
                      {selectedVersion.created_at && (
                        <small className="text-muted">
                          Creada:{" "}
                          {new Date(
                            selectedVersion.created_at
                          ).toLocaleString()}
                        </small>
                      )}
                    </div>
                  </div>

                  {snapshot ? (
                    <>
                      <div className="row mb-3">
                        <div className="col-md-12">
                          <div className="card h-100">
                            <div className="card-body py-2">
                              <h6 className="card-title mb-1">
                                Resumen general
                              </h6>
                              <p className="mb-1">
                                <strong>Personas en cobertura:</strong>{" "}
                                {snapshot.personas_cobertura ?? "—"}
                              </p>
                              <p className="mb-1">
                                <strong>Personas en taxes:</strong>{" "}
                                {snapshot.personas_taxes ?? "—"}
                              </p>
                              <p className="mb-1">
                                <strong>Ingreso familiar anual:</strong>{" "}
                                {formatMoney(snapshot.ingreso_familiar_anual)}
                              </p>
                              <p className="mb-1">
                                <strong>Responsable:</strong>{" "}
                                {snapshot.responsable ?? "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <h6 className="mb-3 mt-4">Coberturas en este año</h6>

                      {coberturas.length === 0 && (
                        <p className="text-muted">
                          No se encontraron coberturas asociadas en el snapshot.
                        </p>
                      )}

                      {coberturas.length > 0 && (
                        <div className="accordion" id="accordionCoberturas">
                          {coberturas.map((c, idx) => {
                            const itemId = `cov-${idx}`;

                            const cliente = clientesSnapshot.find((cli) => {
                              return (
                                cli.id === c.cliente_id ||
                                cli.cliente_id === c.cliente_id
                              );
                            });

                            return (
                              <div className="accordion-item mb-2" key={itemId}>
                                <h2
                                  className="accordion-header"
                                  id={`heading-${itemId}`}
                                >
                                  <button
                                    className="accordion-button collapsed"
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target={`#collapse-${itemId}`}
                                  >
                                    <strong>#{idx + 1}</strong> &nbsp; — &nbsp;
                                    {c.cliente_nombre ??
                                      c.cliente?.nombre_completo ??
                                      cliente?.nombre_completo ??
                                      cliente?.nombre ??
                                      `ID ${c.cliente_id ?? "—"}`}
                                    &nbsp; | Año:{" "}
                                    {c.ano_cobertura ?? c.anio ?? "—"}
                                  </button>
                                </h2>

                                <div
                                  id={`collapse-${itemId}`}
                                  className="accordion-collapse collapse"
                                  data-bs-parent="#accordionCoberturas"
                                >
                                  <div className="accordion-body">
                                    <div className="row">
                                      <div className="col-md-4">
                                        <p>
                                          <strong>Cliente ID:</strong>{" "}
                                          {c.cliente_id ?? "—"}
                                        </p>
                                        <p>
                                          <strong>Parentesco:</strong>{" "}
                                          {c.parentezco ?? "—"}
                                        </p>
                                        <p>
                                          <strong>Tipo cobertura:</strong>{" "}
                                          {c.cobertura_tipo ?? "—"}
                                        </p>
                                        <p>
                                          <strong>Año cobertura:</strong>{" "}
                                          {c.ano_cobertura ?? "—"}
                                        </p>
                                        <p>
                                          <strong>Fecha activación:</strong>{" "}
                                          {c.fecha_activacion ?? "—"}
                                        </p>
                                        <p>
                                          <strong>Fecha cancelación:</strong>{" "}
                                          {c.fecha_cancelacion ?? "—"}
                                        </p>
                                      </div>

                                      <div className="col-md-4">
                                        <p>
                                          <strong>Compañía:</strong>{" "}
                                          {c.compania_nombre ??
                                            c.compania_id ??
                                            "—"}
                                        </p>
                                        <p>
                                          <strong>Plan:</strong>{" "}
                                          {c.plan ?? "—"}
                                        </p>
                                        <p>
                                          <strong>Metal:</strong>{" "}
                                          {c.metal ?? "—"}
                                        </p>
                                        <p>
                                          <strong>Red:</strong>{" "}
                                          {c.red ?? "—"}
                                        </p>
                                        <p>
                                          <strong>Elegibilidad:</strong>{" "}
                                          {c.elegibilidad_carta ??
                                            c.elegibilidad ??
                                            "—"}
                                        </p>
                                        <p>
                                          <strong>Pagador ID:</strong>{" "}
                                          {c.pagador_id ?? "—"}
                                        </p>
                                      </div>

                                      <div className="col-md-4">
                                        <p>
                                          <strong>Precio:</strong>{" "}
                                          {formatMoney(c.precio)}
                                        </p>
                                        <p>
                                          <strong>Código póliza:</strong>{" "}
                                          {c.codigo_poliza ?? "—"}
                                        </p>
                                        <p>
                                          <strong>Cobertura ID:</strong>{" "}
                                          {c.id ?? "—"}
                                        </p>
                                        <p>
                                          <strong>Resultado:</strong>{" "}
                                          {c.resultado ?? "—"}
                                        </p>
                                        <p>
                                          <strong>Status:</strong>{" "}
                                          {c.activo ? "Activo" : "Inactivo"}
                                        </p>
                                        <p>
                                          <strong>Notas:</strong>{" "}
                                          {c.nota ?? "—"}
                                        </p>
                                      </div>
                                    </div>

                                    {cliente && (
                                      <>
                                        <hr />
                                        <button
                                          className="btn btn-sm btn-outline-secondary mb-2"
                                          type="button"
                                          data-bs-toggle="collapse"
                                          data-bs-target={`#cliente-${itemId}`}
                                        >
                                          Ver datos del cliente
                                        </button>

                                        <div
                                          className="collapse"
                                          id={`cliente-${itemId}`}
                                        >
                                          <div className="table-responsive">
                                            <table className="table table-sm mb-0">
                                              <tbody>
                                                {Object.entries(
                                                  cliente
                                                ).map(([key, value]) => (
                                                  <tr key={key}>
                                                    <th
                                                      style={{ width: "35%" }}
                                                    >
                                                      {formatClienteLabel(key)}
                                                    </th>
                                                    <td>
                                                      {formatClienteValue(
                                                        key,
                                                        value
                                                      )}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted">
                      No se encontró información detallada (snapshot) para esta
                      versión. Puedes seguir usando esta pantalla solo como
                      referencia de los años de renovación.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onHide}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistorialRenovacionesModal;
