// pages/ConciliacionComisionesPage.jsx – Conciliación de Comisiones por Compañía
import React, { useState, useMemo, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Badge,
  Alert,
  Spinner,
  Form,
  InputGroup,
  Row,
  Col,
} from "react-bootstrap";
import {
  FaUpload,
  FaSyncAlt,
  FaFileDownload,
  FaSearch,
  FaFilter,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaQuestionCircle,
  FaFileCsv,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { compareCommissions } from "../services/commissionsService";
import useCompanies from "../hooks/useCompanies";

const MESES = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const STATUS_CONFIG = {
  OK_MATCH: {
    label: "OK",
    variant: "success",
    icon: FaCheckCircle,
  },
  DIFF_MEMBERS: {
    label: "Diferencias",
    variant: "warning",
    icon: FaExclamationTriangle,
  },
  POLICY_NOT_FOUND: {
    label: "No encontradas",
    variant: "danger",
    icon: FaTimesCircle,
  },
  ERP_NOT_IN_FILE: {
    label: "ERP no reportadas",
    variant: "info",
    icon: FaQuestionCircle,
  },
};

const getStatusConfig = (status) => {
  const key = (status || "").toUpperCase().replace(/\s/g, "_");
  return STATUS_CONFIG[key] || { label: status || "—", variant: "secondary", icon: FaQuestionCircle };
};

const formatDate = (value) => {
  if (value == null || value === "") return "—";
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return value;
  }
};

const TABLE_COLUMNS = [
  { key: "policy_number", label: "Nº Póliza" },
  { key: "codigo_poliza", label: "Código póliza" },
  { key: "grupo_familiar_id", label: "Grupo familiar" },
  { key: "company_name", label: "Compañía" },
  { key: "tomador_nombre", label: "Tomador" },
  { key: "tomador_nombre_csv", label: "Tomador (archivo)" },
  { key: "fecha_activacion", label: "Fecha activación" },
  { key: "members_reported", label: "Miembros reportados" },
  { key: "members_erp", label: "Miembros ERP" },
  { key: "difference", label: "Diferencia" },
  { key: "status", label: "Estado" },
  { key: "statement_date", label: "Fecha estado" },
  { key: "commission_date", label: "Fecha comisión" },
];

// Alias de columnas: clave interna -> posibles nombres en API/CSV (headers del archivo)
const COLUMN_ALIASES = {
  members_reported: [
    "members_reported",
    "membersReported",
    "number_of_member",
    "number_of_members",
    "Number of Member",
    "numberOfMember",
    "MIEMBROS REPORTADOS",
    "Miembros Reportados",
    "miembros reportados",
    "miembros_reportados",
    "file_members",
    "members_in_file",
    "csv_members",
  ],
  members_erp: ["members_erp", "membersErp", "members_erp_count", "MIEMBROS ERP", "Miembros Erp", "miembros_erp"],
  difference: [
    "difference",
    "diff",
    "member_difference",
    "difference_count",
    "diferencia",
    "members_diff",
  ],
  statement_date: [
    "statement_date",
    "statementDate",
    "status_date",
    "fecha_estado",
    "date",
  ],
  commission_date: [
    "commission_date",
    "commissionDate",
    "fecha_comision",
    "fecha_comisión",
  ],
  tomador_nombre_csv: [
    "tomador_nombre_csv",
    "tomadorNombreCsv",
    "titular_csv",
    "titular_archivo",
    "holder_name_csv",
    "policyholder_csv",
  ],
};

// Objetos anidados donde el backend puede enviar datos del archivo CSV (ej. para "ERP no reportadas")
const NESTED_ROW_KEYS = ["file_row", "csv_data", "file_data", "reported", "csv_row", "file"];

const findInRow = (row, normalizer) => {
  for (const k of Object.keys(row)) {
    if (k == null) continue;
    const normalized = String(k).toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
    if (normalizer(normalized)) {
      const v = row[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return undefined;
};

const findMembersReportedInRow = (row) => {
  const val = findInRow(row, (n) =>
    n === "membersreported" || n === "numberofmember" || n === "numberofmembers"
  );
  if (val !== undefined) return val;
  for (const nestKey of NESTED_ROW_KEYS) {
    const nested = row[nestKey];
    if (nested && typeof nested === "object") {
      const inNested = findInRow(nested, (n) =>
        n === "membersreported" || n === "numberofmember" || n === "numberofmembers"
      );
      if (inNested !== undefined) return inNested;
      if (nested.number_of_member !== undefined && nested.number_of_member !== null) return nested.number_of_member;
      if (nested.number_of_members !== undefined && nested.number_of_members !== null) return nested.number_of_members;
      if (nested.members_reported !== undefined && nested.members_reported !== null) return nested.members_reported;
      if (nested["Number of Member"] !== undefined && nested["Number of Member"] !== null) return nested["Number of Member"];
      if (nested["MIEMBROS REPORTADOS"] !== undefined && nested["MIEMBROS REPORTADOS"] !== null) return nested["MIEMBROS REPORTADOS"];
    }
  }
  return undefined;
};

const getRowValue = (row, key) => {
  let val = row[key] ?? row[key.replace(/_/g, "")];
  const aliases = COLUMN_ALIASES[key];
  if ((val === undefined || val === null || val === "") && aliases) {
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null && row[alias] !== "") {
        val = row[alias];
        break;
      }
    }
  }
  if (key === "members_reported" && (val === undefined || val === null || val === "")) {
    val = findMembersReportedInRow(row);
  }
  if (key === "difference" && (val === undefined || val === null || val === "") && aliases) {
    for (const nestKey of NESTED_ROW_KEYS) {
      const nested = row[nestKey];
      if (nested && typeof nested === "object") {
        for (const alias of COLUMN_ALIASES.difference) {
          if (nested[alias] !== undefined && nested[alias] !== null && nested[alias] !== "") {
            val = nested[alias];
            break;
          }
        }
        if (val !== undefined && val !== null && val !== "") break;
      }
    }
  }
  if (key === "statement_date" && (val === undefined || val === null || val === "")) {
    for (const nestKey of NESTED_ROW_KEYS) {
      const nested = row[nestKey];
      if (nested && typeof nested === "object") {
        const d = nested.statement_date ?? nested.statementDate ?? nested.status_date ?? nested.fecha_estado ?? nested.date;
        if (d !== undefined && d !== null && d !== "") {
          val = d;
          break;
        }
      }
    }
  }
  if (key === "fecha_activacion" || key === "statement_date" || key === "commission_date") return formatDate(val);
  if (key === "status") return null;
  return val !== undefined && val !== null ? val : "—";
};

// Claves posibles del backend para las tarjetas de resumen
const getSummaryCount = (summary, ...keys) => {
  for (const k of keys) {
    const v = summary[k];
    if (v !== undefined && v !== null) return Number(v);
  }
  return 0;
};

const SUMMARY_CARDS = [
  {
    key: "total",
    label: "Total procesadas",
    variant: "primary",
    keys: ["total", "total_processed", "total_procesadas"],
  },
  {
    key: "ok",
    label: "OK",
    variant: "success",
    keys: ["ok", "ok_match", "OK_MATCH", "ok_match_count"],
  },
  {
    key: "diferencias",
    label: "Diferencias",
    variant: "warning",
    keys: ["diferencias", "diff_members", "DIFF_MEMBERS", "diff_members_count"],
  },
  {
    key: "no_encontradas",
    label: "No encontradas",
    variant: "danger",
    keys: ["no_encontradas", "policy_not_found", "POLICY_NOT_FOUND", "policy_not_found_count"],
  },
  {
    key: "erp_no_reportadas",
    label: "ERP no reportadas",
    variant: "info",
    keys: ["erp_no_reportadas", "erp_not_in_file", "ERP_NOT_IN_FILE", "erp_not_in_file_count"],
  },
];

const ConciliacionComisionesPage = () => {
  const { companies, loading: loadingCompanies } = useCompanies();
  const [companyId, setCompanyId] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchText, setSearchText] = useState("");

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => currentYear - i), [currentYear]);

  useEffect(() => {
    if (!month && !year) {
      const now = new Date();
      setMonth(String(now.getMonth() + 1));
      setYear(String(now.getFullYear()));
    }
  }, []);

  // Detalle: aceptar data en distintas claves de respuesta del API
  const rawData = useMemo(() => {
    if (!result) return [];
    const arr = result.data ?? result.results ?? result.detail ?? result.comparison ?? result.rows ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [result]);
  const summary = result?.summary ?? {};

  const filteredData = useMemo(() => {
    let list = Array.isArray(rawData) ? [...rawData] : [];
    if (statusFilter) {
      const statusNorm = statusFilter.toUpperCase().replace(/\s/g, "_");
      list = list.filter((row) => (row.status || "").toUpperCase().replace(/\s/g, "_") === statusNorm);
    }
    if (searchText.trim()) {
      const term = searchText.trim().toLowerCase();
      const policyKeys = ["policy_number", "codigo_poliza"];
      list = list.filter((row) =>
        policyKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(term)) ||
        TABLE_COLUMNS.some((col) => String(getRowValue(row, col.key)).toLowerCase().includes(term))
      );
    }
    return list;
  }, [rawData, statusFilter, searchText]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!companyId) {
      setError("Seleccione una compañía.");
      return;
    }
    if (!month || !year) {
      setError("Seleccione mes y año.");
      return;
    }
    if (!file) {
      setError("Seleccione un archivo CSV.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await compareCommissions({
        file,
        company_id: companyId,
        month,
        year,
      });
      setResult(data);
    } catch (err) {
      setError(err?.message || "Error al procesar la conciliación.");
    } finally {
      setLoading(false);
    }
  };

  const handleNuevaConciliacion = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setStatusFilter("");
    setSearchText("");
    const input = document.getElementById("conciliacion-csv-input");
    if (input) input.value = "";
  };

  const handleDescargarReporte = () => {
    const dataToExport = filteredData.length > 0 ? filteredData : rawData;
    if (dataToExport.length === 0) return;
    const headers = TABLE_COLUMNS.map((c) => c.label);
    const rows = dataToExport.map((row) =>
      TABLE_COLUMNS.map((c) => (c.key === "status" ? getStatusConfig(row.status).label : getRowValue(row, c.key)))
    );
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Conciliación");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `conciliacion-comisiones-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportCsv = () => {
    const dataToExport = filteredData.length > 0 ? filteredData : rawData;
    if (dataToExport.length === 0) return;
    const headerLine = TABLE_COLUMNS.map((c) => c.label).join(",");
    const rows = dataToExport.map((row) =>
      TABLE_COLUMNS.map((c) => {
        const v = c.key === "status" ? getStatusConfig(row.status).label : getRowValue(row, c.key);
        const str = String(v ?? "");
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    );
    const blob = new Blob(["\uFEFF" + [headerLine, ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `conciliacion-comisiones-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const statusOptions = Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
    <option key={value} value={value}>{label}</option>
  ));

  return (
    <div className="content">
      <Helmet>
        <title>Conciliación de comisiones por compañía</title>
      </Helmet>

      <h1 className="mb-4">Conciliación de comisiones por compañía</h1>

      {/* Formulario */}
      <Card className="mb-4">
        <Card.Header as="h5">Datos de la conciliación</Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Row className="g-3">
            <Col md={6} lg={3}>
              <Form.Group>
                <Form.Label>Compañía</Form.Label>
                <Form.Select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  disabled={loadingCompanies || loading}
                >
                  <option value="">Seleccione compañía</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6} lg={2}>
              <Form.Group>
                <Form.Label>Mes</Form.Label>
                <Form.Select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Mes</option>
                  {MESES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6} lg={2}>
              <Form.Group>
                <Form.Label>Año</Form.Label>
                <Form.Select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Año</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={12} lg={5}>
              <Form.Group>
                <Form.Label>Archivo CSV</Form.Label>
                <Form.Control
                  id="conciliacion-csv-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={loading}
                />
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={loading || !file || !companyId || !month || !year}
              >
                {loading ? <Spinner animation="border" size="sm" className="me-2" /> : <FaUpload className="me-2" />}
                Procesar conciliación
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tarjetas resumen */}
      {result && (
        <Row className="mb-4 g-3">
          {SUMMARY_CARDS.map((card) => (
            <Col key={card.key} xs={6} md={4} lg>
              <Card className="h-100 border-0 shadow-sm">
                <Card.Body className="py-3 d-flex align-items-center justify-content-between">
                  <span className="small text-muted">{card.label}</span>
                  <Badge bg={card.variant} className="fs-6">
                    {getSummaryCount(summary, ...card.keys)}
                  </Badge>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Detalle de la conciliación: resultado por póliza (siempre visible cuando hay result) */}
      {result && (
        <Card>
          <Card.Header as="h5" className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span>Detalle de la conciliación</span>
            <div className="d-flex gap-2 flex-wrap">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={handleDescargarReporte}
                disabled={rawData.length === 0}
              >
                <FaFileDownload className="me-1" /> Descargar reporte
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={exportCsv}
                disabled={rawData.length === 0}
              >
                <FaFileCsv className="me-1" /> CSV
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={handleNuevaConciliacion}>
                <FaSyncAlt className="me-1" /> Nueva conciliación
              </Button>
            </div>
          </Card.Header>
          <Card.Body>
            {rawData.length > 0 ? (
              <>
                <Row className="mb-3 g-2">
                  <Col md={4}>
                    <InputGroup size="sm">
                      <InputGroup.Text><FaSearch /></InputGroup.Text>
                      <Form.Control
                        placeholder="Buscar por póliza..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                      />
                    </InputGroup>
                  </Col>
                  <Col md={4}>
                    <InputGroup size="sm">
                      <InputGroup.Text><FaFilter /></InputGroup.Text>
                      <Form.Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="">Todos los estados</option>
                        {statusOptions}
                      </Form.Select>
                    </InputGroup>
                  </Col>
                </Row>
                <div className="table-responsive">
                  <Table bordered hover size="sm">
                    <thead className="table-light">
                      <tr>
                        {TABLE_COLUMNS.map((c) => (
                          <th key={c.key}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row, idx) => {
                        const StatusIcon = getStatusConfig(row.status).icon;
                        const grupoFamiliarId = row.grupo_familiar_id ?? row.grupoFamiliarId;
                        const clienteId = row.cliente_id ?? row.client_id ?? row.tomador_id ?? row.responsable_id;
                        const renderCell = (colKey) => {
                          if (colKey === "status") {
                            return (
                              <Badge bg={getStatusConfig(row.status).variant} className="d-inline-flex align-items-center gap-1">
                                <StatusIcon size={12} /> {getStatusConfig(row.status).label}
                              </Badge>
                            );
                          }
                          const value = getRowValue(row, colKey);
                          if (colKey === "grupo_familiar_id" && value !== "—" && grupoFamiliarId != null && String(grupoFamiliarId).trim() !== "") {
                            return (
                              <Link
                                to={`/grupo_familiar/${grupoFamiliarId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-decoration-none fw-semibold"
                                title="Abrir ficha del grupo familiar"
                              >
                                {value}
                              </Link>
                            );
                          }
                          if (colKey === "tomador_nombre" && value !== "—" && clienteId != null && String(clienteId).trim() !== "") {
                            return (
                              <Link
                                to={`/clientes/${clienteId}/ficha`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-decoration-none"
                                title="Abrir ficha del cliente"
                              >
                                {value}
                              </Link>
                            );
                          }
                          return value;
                        };
                        return (
                          <tr key={row.id ?? idx}>
                            {TABLE_COLUMNS.map((col) => (
                              <td key={col.key}>{renderCell(col.key)}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
                {filteredData.length === 0 && (
                  <Alert variant="light" className="mb-0">
                    No hay registros que coincidan con los filtros.
                  </Alert>
                )}
              </>
            ) : (
              <Alert variant="info" className="mb-0">
                No se encontraron registros en el resultado de la conciliación.
              </Alert>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default ConciliacionComisionesPage;
