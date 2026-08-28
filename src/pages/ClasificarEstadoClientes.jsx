import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Form,
  InputGroup,
  Pagination,
  Spinner,
  Table,
  Toast,
  ToastContainer,
} from "react-bootstrap";
import {
  FaSearch,
  FaTimes,
  FaLock,
  FaSave,
  FaInfoCircle,
  FaCheckSquare,
  FaSquare,
  FaUsers,
  FaFilter,
  FaChartBar,
} from "react-icons/fa";
import apiRequest from "../services/api";
import { formatDateForDisplay } from "../utils/formatters";
import "../styles/ClasificarEstadoClientes.css";

const CLIENTE_FICHA_PATH = (id) => `/clientes/${id}/ficha`;

const ESTADOS_EDITABLES = [
  { value: "cliente", label: "Cliente" },
  { value: "contacto", label: "Contacto" },
  { value: "empresa", label: "Empresa" },
];

const badgeVariantEstado = (estado) => {
  switch (normEstado(estado)) {
    case "contacto":
      return "secondary";
    case "empresa":
      return "dark";
    case "prospecto":
      return "warning";
    case "descartado":
      return "danger";
    default:
      return "primary";
  }
};

const normEstado = (s) => (s ?? "").toString().trim().toLowerCase();

const normalizeSearch = (text) => {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const tieneGrupoFamiliar = (cliente) => {
  if (cliente?.grupos?.length > 0) return true;
  if (cliente?.grupo_familiar_id) return true;
  const coberturas = cliente?.coberturas || [];
  return coberturas.some((c) => Boolean(c?.grupo_familiar_id));
};

const labelEstado = (estado) => {
  const n = normEstado(estado);
  if (n === "contacto") return "Contacto";
  if (n === "cliente") return "Cliente";
  if (n === "empresa") return "Empresa";
  if (n === "prospecto") return "Prospecto";
  if (n === "descartado") return "Descartado";
  return estado || "Sin definir";
};

const ClasificarEstadoClientes = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("cliente");
  const [filtroProceso, setFiltroProceso] = useState("sin-proceso");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [savingIds, setSavingIds] = useState(() => new Set());
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkEstado, setBulkEstado] = useState("contacto");
  const [bulkSaving, setBulkSaving] = useState(false);

  const [toast, setToast] = useState({ show: false, message: "", variant: "success" });

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest("cliente/with-cobertura");
      const raw = Array.isArray(response?.data) ? response.data : response || [];
      const clientesArray = Array.isArray(raw) ? raw : Object.values(raw);

      const normalizados = clientesArray.map((c) => {
        const idsCob = (c.coberturas || [])
          .map((co) => co.grupo_familiar_id)
          .filter(Boolean);
        const baseId = c.grupo_familiar_id ? [c.grupo_familiar_id] : [];
        const grupoFamiliarIds = Array.from(new Set([...baseId, ...idsCob]));

        const estadosMap = new Map();
        (c.grupo_estados || []).forEach((g) => {
          if (g?.id) estadosMap.set(g.id, g.estado || "Sin estado");
        });
        (c.coberturas || []).forEach((co) => {
          const gid = co.grupo_familiar_id;
          const est = co.grupo_familiar?.estado_actual_catalogo?.estado_nombre;
          if (gid && est && !estadosMap.has(gid)) estadosMap.set(gid, est);
        });

        const grupos = grupoFamiliarIds.map((id) => ({
          id,
          estado: estadosMap.get(id) || "Sin estado",
        }));

        return {
          ...c,
          grupos,
          estado_cliente: normEstado(c.estado_cliente) || "cliente",
        };
      });

      setClientes(normalizados);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
      setError(
        "No se pudieron cargar los clientes. " +
          (err.message || "Intente nuevamente.")
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredClientes = useMemo(() => {
    let result = [...clientes];

    if (searchTerm) {
      const q = normalizeSearch(searchTerm);
      result = result.filter((cliente) => {
        const nombre = normalizeSearch(cliente.nombre_completo || "");
        const primer = normalizeSearch(cliente.primer_nombre || "");
        const segundo = normalizeSearch(cliente.segundo_nombre || "");
        const apellidos = normalizeSearch(cliente.apellidos || "");
        const email = normalizeSearch(cliente.email || "");
        const social = normalizeSearch(String(cliente.social || ""));
        const telefono = normalizeSearch(String(cliente.telefono || ""));
        return (
          nombre.includes(q) ||
          `${primer} ${apellidos}`.includes(q) ||
          `${primer} ${segundo} ${apellidos}`.includes(q) ||
          email.includes(q) ||
          social.includes(q) ||
          telefono.includes(q)
        );
      });
    }

    if (filtroEstado !== "all") {
      result = result.filter(
        (c) => normEstado(c.estado_cliente) === filtroEstado
      );
    }

    if (filtroProceso === "sin-proceso") {
      result = result.filter((c) => !tieneGrupoFamiliar(c));
    } else if (filtroProceso === "con-proceso") {
      result = result.filter((c) => tieneGrupoFamiliar(c));
    }

    result.sort((a, b) =>
      (a.nombre_completo || "").localeCompare(
        b.nombre_completo || "",
        undefined,
        { sensitivity: "base" }
      )
    );

    return result;
  }, [clientes, searchTerm, filtroEstado, filtroProceso]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [searchTerm, filtroEstado, filtroProceso]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredClientes.length / itemsPerPage)
  );
  const pageStart = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredClientes.slice(
    pageStart,
    pageStart + itemsPerPage
  );

  const editablesEnFiltro = useMemo(
    () => filteredClientes.filter((c) => !tieneGrupoFamiliar(c)),
    [filteredClientes]
  );

  const stats = useMemo(() => {
    const sinProceso = clientes.filter((c) => !tieneGrupoFamiliar(c)).length;
    const comoCliente = clientes.filter(
      (c) =>
        !tieneGrupoFamiliar(c) && normEstado(c.estado_cliente) === "cliente"
    ).length;
    return {
      total: clientes.length,
      sinProceso,
      comoCliente,
      filtrados: filteredClientes.length,
      editables: editablesEnFiltro.length,
    };
  }, [clientes, filteredClientes, editablesEnFiltro]);

  const showToast = (message, variant = "success") => {
    setToast({ show: true, message, variant });
  };

  const getTelefono = (cliente) => {
    const telefonos = Array.isArray(cliente.telefonos) ? cliente.telefonos : [];
    if (telefonos.length > 0) {
      const principal = telefonos.find((t) => t?.principal) || telefonos[0];
      return (
        principal?.numero ||
        principal?.telefono ||
        principal?.numero_e164 ||
        null
      );
    }
    return cliente.telefono || null;
  };

  const updateLocalEstado = (id, estado) => {
    setClientes((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, estado_cliente: normEstado(estado) } : c
      )
    );
  };

  const handleEstadoChange = async (cliente, nuevoEstado) => {
    const next = normEstado(nuevoEstado);
    const current = normEstado(cliente.estado_cliente);
    if (next === current) return;

    if (tieneGrupoFamiliar(cliente) && (next === "contacto" || next === "empresa")) {
      showToast(
        "No se puede marcar como Contacto/Empresa: está asociado a un grupo familiar.",
        "warning"
      );
      return;
    }

    setSavingIds((prev) => new Set(prev).add(cliente.id));
    try {
      await apiRequest(`cliente/${cliente.id}`, "PUT", {
        estado_cliente: next,
      });
      updateLocalEstado(cliente.id, next);
      showToast(
        `${cliente.nombre_completo || "Registro"} actualizado a ${labelEstado(next)}.`
      );
    } catch (err) {
      console.error(err);
      showToast(
        err.message || "No se pudo actualizar el estado.",
        "danger"
      );
    } finally {
      setSavingIds((prev) => {
        const copy = new Set(prev);
        copy.delete(cliente.id);
        return copy;
      });
    }
  };

  const toggleSelect = (id, editable) => {
    if (!editable) return;
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const toggleSelectAllPage = () => {
    const editablesPage = currentItems.filter((c) => !tieneGrupoFamiliar(c));
    const allSelected =
      editablesPage.length > 0 &&
      editablesPage.every((c) => selectedIds.has(c.id));

    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (allSelected) {
        editablesPage.forEach((c) => copy.delete(c.id));
      } else {
        editablesPage.forEach((c) => copy.add(c.id));
      }
      return copy;
    });
  };

  const handleBulkUpdate = async () => {
    const ids = Array.from(selectedIds).filter((id) => {
      const c = clientes.find((x) => x.id === id);
      return c && !tieneGrupoFamiliar(c);
    });

    if (ids.length === 0) {
      showToast("Selecciona al menos un registro editable.", "warning");
      return;
    }

    setBulkSaving(true);
    try {
      const response = await apiRequest("cliente/bulk-estado", "POST", {
        ids,
        estado_cliente: bulkEstado,
      });

      const actualizados = response?.actualizados || [];
      const rechazados = response?.rechazados || [];

      actualizados.forEach((item) => {
        updateLocalEstado(item.id, item.estado_cliente || bulkEstado);
      });

      setSelectedIds(new Set());

      if (rechazados.length === 0) {
        showToast(
          `${actualizados.length} registro(s) actualizados a ${labelEstado(bulkEstado)}.`
        );
      } else {
        showToast(
          `${actualizados.length} actualizados, ${rechazados.length} rechazados (grupo familiar u otro motivo).`,
          "warning"
        );
      }
    } catch (err) {
      console.error(err);
      // Fallback: actualizar uno a uno si el endpoint bulk no existe aún
      if (err?.response?.status === 404) {
        let ok = 0;
        let fail = 0;
        for (const id of ids) {
          const cliente = clientes.find((c) => c.id === id);
          if (!cliente) continue;
          try {
            await apiRequest(`cliente/${id}`, "PUT", {
              estado_cliente: bulkEstado,
            });
            updateLocalEstado(id, bulkEstado);
            ok += 1;
          } catch {
            fail += 1;
          }
        }
        setSelectedIds(new Set());
        showToast(
          fail === 0
            ? `${ok} registro(s) actualizados.`
            : `${ok} actualizados, ${fail} con error.`,
          fail === 0 ? "success" : "warning"
        );
      } else {
        showToast(err.message || "Error en actualización masiva.", "danger");
      }
    } finally {
      setBulkSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFiltroEstado("cliente");
    setFiltroProceso("sin-proceso");
  };

  const editablesPage = currentItems.filter((c) => !tieneGrupoFamiliar(c));
  const allPageSelected =
    editablesPage.length > 0 &&
    editablesPage.every((c) => selectedIds.has(c.id));

  return (
    <div className="clasificar-estado-container">
      <div className="cec">
        <div className="cec__header">
          <div className="cec__header-icon" aria-hidden="true">
            <FaUsers />
          </div>
          <div>
            <h1 className="cec__title">Clasificar estado de clientes</h1>
            <p className="cec__subtitle">
              Corrige el bautizo Cliente / Contacto / Empresa de forma ágil. Los
              asociados a un grupo familiar no pueden pasar a Contacto ni Empresa.
            </p>
          </div>
        </div>

        <div className="cec__body">
          <div className="cec__section">
            <div className="cec__notice">
              <FaInfoCircle />
              <div>
                Por defecto se muestran registros marcados como{" "}
                <strong>Cliente</strong> y <strong>sin proceso</strong> (sin
                grupo familiar), que son los editables tras la migración. Cambia
                el filtro si necesitas revisar otros.
              </div>
            </div>
          </div>

          <div className="cec__section">
            <div className="cec__section-title">
              <FaChartBar />
              Resumen
            </div>
            <div className="cec__kpis">
              <div className="cec__kpi">
                <span className="cec__kpi-label">Total</span>
                <span className="cec__kpi-value">{stats.total}</span>
              </div>
              <div className="cec__kpi">
                <span className="cec__kpi-label">Sin proceso</span>
                <span className="cec__kpi-value">{stats.sinProceso}</span>
              </div>
              <div className="cec__kpi">
                <span className="cec__kpi-label">Cliente sin GF</span>
                <span className="cec__kpi-value">{stats.comoCliente}</span>
              </div>
              <div className="cec__kpi">
                <span className="cec__kpi-label">En vista (editables)</span>
                <span className="cec__kpi-value">
                  {stats.filtrados} ({stats.editables})
                </span>
              </div>
            </div>
          </div>

          <div className="cec__section">
            <div className="cec__section-title">
              <FaFilter />
              Filtros
            </div>
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <div className="cec__label">Buscar</div>
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Nombre, email, teléfono, SSN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <Button
                      variant="outline-secondary"
                      className="cec__btn"
                      onClick={() => setSearchTerm("")}
                    >
                      <FaTimes />
                    </Button>
                  )}
                </InputGroup>
              </div>
              <div className="col-md-3">
                <div className="cec__label">Estado actual</div>
                <Form.Select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="cliente">Cliente</option>
                  <option value="contacto">Contacto</option>
                  <option value="empresa">Empresa</option>
                  <option value="prospecto">Prospecto</option>
                </Form.Select>
              </div>
              <div className="col-md-3">
                <div className="cec__label">Proceso</div>
                <Form.Select
                  value={filtroProceso}
                  onChange={(e) => setFiltroProceso(e.target.value)}
                >
                  <option value="sin-proceso">Sin proceso (editables)</option>
                  <option value="con-proceso">Con grupo familiar</option>
                  <option value="all">Todos</option>
                </Form.Select>
              </div>
              <div className="col-md-2">
                <Button
                  variant="outline-secondary"
                  className="w-100 cec__btn"
                  onClick={clearFilters}
                >
                  Restablecer
                </Button>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div className="bulk-bar mt-3">
                <span className="me-2">{selectedIds.size} seleccionado(s)</span>
                <Form.Select
                  size="sm"
                  className="bulk-select"
                  value={bulkEstado}
                  onChange={(e) => setBulkEstado(e.target.value)}
                >
                  {ESTADOS_EDITABLES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
                <Button
                  size="sm"
                  className="cec__btn-primary"
                  disabled={bulkSaving}
                  onClick={handleBulkUpdate}
                >
                  {bulkSaving ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-1" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <FaSave className="me-1" />
                      Aplicar a seleccionados
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="link"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Limpiar selección
                </Button>
              </div>
            )}
          </div>

          <div className="cec__section cec__section--table">
            <div className="cec__section-title">
              <FaUsers />
              Resultados
            </div>

            {loading ? (
              <div className="cec__loading">
                <Spinner animation="border" />
                <p className="mt-2 mb-0">Cargando clientes...</p>
              </div>
            ) : error ? (
              <Alert variant="danger" className="mb-0">
                {error}
                <div className="mt-2">
                  <Button size="sm" className="cec__btn-primary" onClick={fetchClientes}>
                    Reintentar
                  </Button>
                </div>
              </Alert>
            ) : (
              <>
                <div className="cec__table-wrap table-responsive">
                  <Table hover className="clasificar-estado-table mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>
                          <button
                            type="button"
                            className="btn btn-link p-0 text-secondary"
                            title="Seleccionar editables de la página"
                            onClick={toggleSelectAllPage}
                            disabled={editablesPage.length === 0}
                          >
                            {allPageSelected ? <FaCheckSquare /> : <FaSquare />}
                          </button>
                        </th>
                        <th style={{ width: 70 }}>ID</th>
                        <th>Nombre</th>
                        <th style={{ width: 130 }}>Fecha nac.</th>
                        <th>Teléfono</th>
                        <th>Proceso</th>
                        <th style={{ minWidth: 180 }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="cec__empty">
                            No hay registros con los filtros actuales.
                          </td>
                        </tr>
                      ) : (
                        currentItems.map((cliente) => {
                          const bloqueado = tieneGrupoFamiliar(cliente);
                          const saving = savingIds.has(cliente.id);
                          const selected = selectedIds.has(cliente.id);
                          const estadoVal = normEstado(cliente.estado_cliente);

                          return (
                            <tr
                              key={cliente.id}
                              className={
                                bloqueado
                                  ? "row-bloqueada"
                                  : selected
                                    ? "row-selected"
                                    : ""
                              }
                            >
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-link p-0"
                                  disabled={bloqueado}
                                  onClick={() =>
                                    toggleSelect(cliente.id, !bloqueado)
                                  }
                                  title={
                                    bloqueado
                                      ? "Bloqueado: tiene grupo familiar"
                                      : "Seleccionar"
                                  }
                                >
                                  {selected ? (
                                    <FaCheckSquare className="text-primary" />
                                  ) : (
                                    <FaSquare
                                      className={
                                        bloqueado
                                          ? "text-muted opacity-50"
                                          : "text-secondary"
                                      }
                                    />
                                  )}
                                </button>
                              </td>
                              <td className="text-muted">{cliente.id}</td>
                              <td>
                                <Link
                                  to={CLIENTE_FICHA_PATH(cliente.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="fw-semibold text-decoration-none"
                                >
                                  {cliente.nombre_completo || "Sin nombre"}
                                </Link>
                              </td>
                              <td className="text-nowrap">
                                {cliente.fecha_nacimiento
                                  ? formatDateForDisplay(cliente.fecha_nacimiento)
                                  : "—"}
                              </td>
                              <td>{getTelefono(cliente) || "—"}</td>
                              <td>
                                {bloqueado ? (
                                  <div className="d-flex flex-wrap gap-1">
                                    {(cliente.grupos || []).map((g) => (
                                      <Link
                                        key={g.id}
                                        to={`/grupo_familiar/${g.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-decoration-none"
                                      >
                                        <Badge bg="info" pill>
                                          GF #{g.id}
                                        </Badge>
                                      </Link>
                                    ))}
                                  </div>
                                ) : (
                                  <Badge bg="light" text="dark">
                                    Sin proceso
                                  </Badge>
                                )}
                              </td>
                              <td>
                                <div className="estado-cell">
                                  {bloqueado ? (
                                    <>
                                      <Badge bg={badgeVariantEstado(estadoVal)}>
                                        {labelEstado(cliente.estado_cliente)}
                                      </Badge>
                                      <span
                                        className="lock-hint"
                                        title="No se puede cambiar a Contacto/Empresa porque pertenece a un grupo familiar"
                                      >
                                        <FaLock /> Bloqueado
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Form.Select
                                        size="sm"
                                        value={estadoVal || "cliente"}
                                        disabled={saving}
                                        onChange={(e) =>
                                          handleEstadoChange(
                                            cliente,
                                            e.target.value
                                          )
                                        }
                                      >
                                        {ESTADOS_EDITABLES.map((opt) => (
                                          <option
                                            key={opt.value}
                                            value={opt.value}
                                          >
                                            {opt.label}
                                          </option>
                                        ))}
                                        {!ESTADOS_EDITABLES.some(
                                          (o) => o.value === estadoVal
                                        ) &&
                                          estadoVal && (
                                            <option value={estadoVal}>
                                              {labelEstado(estadoVal)}
                                            </option>
                                          )}
                                      </Form.Select>
                                      {saving && (
                                        <Spinner
                                          size="sm"
                                          animation="border"
                                          className="ms-2"
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </div>

                <div className="cec__pagination">
                  <div className="pagination-info">
                    Mostrando{" "}
                    {filteredClientes.length === 0 ? 0 : pageStart + 1} -{" "}
                    {Math.min(
                      pageStart + itemsPerPage,
                      filteredClientes.length
                    )}{" "}
                    de {filteredClientes.length}
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Form.Select
                      size="sm"
                      style={{ width: 90 }}
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      {[10, 25, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Form.Select>
                    <Pagination className="mb-0">
                      <Pagination.Prev
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                      />
                      <Pagination.Item active>{currentPage}</Pagination.Item>
                      <Pagination.Next
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                      />
                    </Pagination>
                    <span className="text-muted small">
                      de {totalPages} pág.
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ToastContainer position="bottom-end" className="p-3">
        <Toast
          bg={toast.variant}
          show={toast.show}
          onClose={() => setToast((t) => ({ ...t, show: false }))}
          delay={3500}
          autohide
        >
          <Toast.Body
            className={
              toast.variant === "warning" ? "text-dark" : "text-white"
            }
          >
            {toast.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
};

export default ClasificarEstadoClientes;
