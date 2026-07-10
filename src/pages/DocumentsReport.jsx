import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Badge,
  Form,
  InputGroup,
  Spinner,
  Row,
  Col,
  Nav,
  Pagination,
} from "react-bootstrap";
import { FaEye, FaPenFancy, FaDownload, FaLink, FaFileAlt } from "react-icons/fa";
import { getDocuments, downloadDocument } from "../services/documentsService";
import DocumentModal from "../components/DocumentModal";
import useToast from "../hooks/useToast";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "completed", label: "Completados" },
];

function DocumentsReport() {
  const toast = useToast();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "all",
    email: "",
    page: 1,
    date_from: "",
    date_to: "",
  });
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const loadDocuments = async (overrideFilters) => {
    const f = overrideFilters ?? filters;
    setLoading(true);
    try {
      const result = await getDocuments(f);
      let list = [];
      if (Array.isArray(result)) {
        list = result;
      } else if (Array.isArray(result?.data)) {
        list = result.data;
      } else if (result?.data && typeof result.data === "object") {
        // Backend: { data: { data: [...], pagination: { page, limit, total, next, prev } } }
        list = Array.isArray(result.data.data)
          ? result.data.data
          : Array.isArray(result.data.submissions)
          ? result.data.submissions
          : Array.isArray(result.data.list)
          ? result.data.list
          : Array.isArray(result.data.items)
          ? result.data.items
          : [];
      } else if (result?.submissions && Array.isArray(result.submissions)) {
        list = result.submissions;
      }
      setDocuments(list);

      // Paginación: puede estar en result.data.pagination (page, limit, total) o result.meta
      const pag = result?.data?.pagination ?? result?.meta ?? result?.pagination;
      if (pag) {
        const total = pag.total ?? list.length;
        const limit = Math.max(1, Number(pag.limit) || 10);
        const lastPage = total > 0 ? Math.ceil(total / limit) : 1;
        setPagination({
          current_page: pag.current_page ?? pag.page ?? 1,
          last_page: pag.last_page ?? pag.total_pages ?? lastPage,
          total,
        });
      } else {
        setPagination({ current_page: 1, last_page: 1, total: list.length });
      }
    } catch (err) {
      console.error("Error al cargar documentos:", err);
      toast.showError(err?.message || "Error al cargar documentos");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [filters.status, filters.page]);

  const handleSearch = (e) => {
    e?.preventDefault();
    const next = { ...filters, page: 1 };
    setFilters(next);
    loadDocuments(next);
  };

  const handleViewDocument = (doc) => {
    setSelectedDoc(doc);
    setShowModal(true);
  };

  const handleComplete = () => {
    loadDocuments();
    setShowModal(false);
    setSelectedDoc(null);
  };

  const copyEmbedLink = (doc) => {
    const url = doc?.embed_url ?? doc?.embed_src ?? "";
    if (!url) {
      toast.showWarning("No hay enlace disponible");
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => toast.showSuccess("Enlace copiado al portapapeles"),
      () => toast.showError("No se pudo copiar")
    );
  };

  const handleDownloadDirect = async (doc) => {
    if (!doc?.id) return;
    if (doc?.status !== "completed" && doc?.status !== "completado") {
      toast.showWarning("Solo se puede descargar cuando el documento está completado");
      return;
    }
    setDownloadingId(doc.id);
    try {
      const { url } = await downloadDocument(doc.id);
      if (url) window.open(url, "_blank");
      else toast.showError("No se pudo obtener el enlace de descarga");
    } catch (err) {
      toast.showError(err?.message || "Error al descargar");
    } finally {
      setDownloadingId(null);
    }
  };

  const isPending = (doc) => {
    const s = (doc?.status ?? "").toLowerCase();
    return s === "pending" || s === "pendiente" || s === "sent" || s === "awaiting" || s === "opened";
  };
  const isCompleted = (doc) => {
    const s = (doc?.status ?? "").toLowerCase();
    return s === "completed" || s === "completado";
  };

  const statusBadge = (doc) => {
    if (isCompleted(doc)) {
      return <Badge bg="success">Completado</Badge>;
    }
    if (isPending(doc)) {
      return <Badge bg="warning" text="dark">Pendiente</Badge>;
    }
    return <Badge bg="secondary">{doc?.status || "—"}</Badge>;
  };

  const signersDisplay = (doc) => {
    const submitters = doc?.submitters ?? doc?.signers ?? [];
    if (Array.isArray(submitters) && submitters.length) {
      return submitters.map((s) => s.email || s.name).filter(Boolean).join(", ");
    }
    return doc?.client_email ?? doc?.email ?? "—";
  };

  const dateDisplay = (doc) => {
    const d = doc?.created_at ?? doc?.sent_at ?? doc?.fecha_envio;
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(d);
    }
  };

  return (
    <div className="documents-report p-3">
      <Card className="mb-3">
        <Card.Header>
          <h5 className="mb-0">
            <FaFileAlt className="me-2" />
            Informes de Documentos
          </h5>
        </Card.Header>
        <Card.Body>
          {/* Filtros */}
          <Nav variant="tabs" className="mb-3">
            {STATUS_OPTIONS.map((opt) => (
              <Nav.Item key={opt.value}>
                <Nav.Link
                  active={filters.status === opt.value}
                  onClick={() => setFilters((f) => ({ ...f, status: opt.value, page: 1 }))}
                  style={{ cursor: "pointer" }}
                >
                  {opt.label}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>

          <Form onSubmit={handleSearch} className="mb-3">
            <Row className="g-2">
              <Col md={4}>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder="Buscar por email"
                    value={filters.email}
                    onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))}
                  />
                  <Button type="submit" variant="outline-secondary">
                    Buscar
                  </Button>
                </InputGroup>
              </Col>
              <Col md={2}>
                <Form.Control
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                  placeholder="Desde"
                />
              </Col>
              <Col md={2}>
                <Form.Control
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                  placeholder="Hasta"
                />
              </Col>
            </Row>
          </Form>

          {/* Tabla / Lista */}
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <p className="mt-2 text-muted">Cargando documentos…</p>
            </div>
          ) : !Array.isArray(documents) || documents.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <FaFileAlt size={48} className="mb-2" />
              <p className="mb-0">No hay documentos enviados</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table hover responsive>
                  <thead className="table-light">
                    <tr>
                      <th>ID / Folio</th>
                      <th>Documento</th>
                      <th>Estado</th>
                      <th>Firmante(s)</th>
                      <th>Fecha envío</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(documents) ? documents : []).map((doc) => (
                      <tr key={doc.id ?? doc.submission_id ?? doc.uuid ?? Math.random()}>
                        <td>{doc.id ?? doc.submission_id ?? "—"}</td>
                        <td>{doc.template_name ?? doc.name ?? "Documento"}</td>
                        <td>{statusBadge(doc)}</td>
                        <td className="small">{signersDisplay(doc)}</td>
                        <td>{dateDisplay(doc)}</td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="me-1"
                            onClick={() => handleViewDocument(doc)}
                            title="Ver"
                          >
                            <FaEye />
                          </Button>
                          {isPending(doc) && (
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="me-1"
                              onClick={() => handleViewDocument(doc)}
                              title="Firmar"
                            >
                              <FaPenFancy />
                            </Button>
                          )}
                          {isCompleted(doc) && (
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="me-1"
                              onClick={() => handleDownloadDirect(doc)}
                              disabled={downloadingId === doc.id}
                              title="Descargar"
                            >
                              {downloadingId === doc.id ? <Spinner animation="border" size="sm" /> : <FaDownload />}
                            </Button>
                          )}
                          <Button
                            variant="outline-dark"
                            size="sm"
                            onClick={() => copyEmbedLink(doc)}
                            title="Copiar enlace"
                          >
                            <FaLink />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {pagination.last_page > 1 && (
                <Pagination className="mb-0 mt-3 justify-content-center">
                  <Pagination.Prev
                    disabled={pagination.current_page <= 1}
                    onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                  />
                  <Pagination.Item disabled>
                    {pagination.current_page} / {pagination.last_page}
                  </Pagination.Item>
                  <Pagination.Next
                    disabled={pagination.current_page >= pagination.last_page}
                    onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                  />
                </Pagination>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      <DocumentModal
        show={showModal}
        onHide={() => { setShowModal(false); setSelectedDoc(null); }}
        document={selectedDoc}
        onComplete={handleComplete}
      />
    </div>
  );
}

export default DocumentsReport;
