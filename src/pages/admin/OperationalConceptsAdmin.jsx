import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Form,
  InputGroup,
  Button,
  Badge,
  Spinner,
  Modal,
  Alert,
  Row,
  Col,
} from "react-bootstrap";
import {
  FaSearch,
  FaEdit,
  FaTrashAlt,
  FaPlus,
  FaFolder,
  FaFolderOpen,
  FaChevronRight,
  FaChevronDown,
  FaFilter,
} from "react-icons/fa";
import { toast } from "react-toastify";
import OperationalConceptsService from "../../services/OperationalConceptsService";

const OperationalConceptsAdmin = () => {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "general",
    is_active: true,
    parent_id: null,
  });
  const [formErrors, setFormErrors] = useState({});
  const [parentConcepts, setParentConcepts] = useState([]);
  const [showOnlyParents, setShowOnlyParents] = useState(false);

  useEffect(() => {
    loadConcepts();
    loadParentConcepts();
  }, [showOnlyParents]);

  const loadConcepts = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        with_children: true,
        ...(showOnlyParents && { only_parents: true }),
      };

      const response = await OperationalConceptsService.list(params);
      const conceptsData = Array.isArray(response) ? response : response.data || [];
      setConcepts(conceptsData);
    } catch (err) {
      const errorMessage = err.message || "Error al cargar conceptos";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadParentConcepts = async () => {
    try {
      const response = await OperationalConceptsService.list({ only_parents: true });
      const parents = Array.isArray(response) ? response : response.data || [];
      setParentConcepts(parents);
    } catch (err) {
      console.error("Error cargando conceptos padres:", err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadConcepts();
  };

  const toggleParent = (parentId) => {
    const newExpanded = new Set(expandedParents);
    if (newExpanded.has(parentId)) {
      newExpanded.delete(parentId);
    } else {
      newExpanded.add(parentId);
    }
    setExpandedParents(newExpanded);
  };

  const handleCreate = (parentId = null) => {
    setSelectedConcept(null);
    setFormData({
      name: "",
      description: "",
      category: "general",
      is_active: true,
      parent_id: parentId,
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleEdit = (concept) => {
    setSelectedConcept(concept);
    setFormData({
      name: concept.name || "",
      description: concept.description || "",
      category: concept.category || "general",
      is_active: concept.is_active !== undefined ? concept.is_active : true,
      parent_id: concept.parent_id || null,
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleDelete = async (concept) => {
    if (
      !window.confirm(
        `¿Estás seguro de eliminar el concepto "${concept.name}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(concept.id);
      await OperationalConceptsService.delete(concept.id);
      toast.success("Concepto eliminado correctamente");
      loadConcepts();
      loadParentConcepts();
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Error al eliminar concepto";
      toast.error(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    try {
      const dataToSend = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category: formData.category || "general",
        is_active: formData.is_active,
        parent_id: formData.parent_id || null,
      };

      if (selectedConcept) {
        await OperationalConceptsService.update(selectedConcept.id, dataToSend);
        toast.success("Concepto actualizado correctamente");
      } else {
        await OperationalConceptsService.create(dataToSend);
        toast.success("Concepto creado correctamente");
      }
      setShowForm(false);
      loadConcepts();
      loadParentConcepts();
    } catch (err) {
      console.error("Error al guardar concepto:", err);
      
      if (err.response?.status === 422) {
        const backendErrors = err.response?.errors || err.response?.data?.errors;
        const errorMessage = err.response?.data?.message;
        
        if (backendErrors) {
          setFormErrors(backendErrors);
          const firstError = Object.values(backendErrors).flat()[0];
          if (firstError) {
            toast.error(firstError);
          } else if (errorMessage) {
            toast.error(errorMessage);
          }
        } else if (errorMessage) {
          toast.error(errorMessage);
          setFormErrors({ general: errorMessage });
        } else {
          toast.error("Error de validación. Verifica los datos ingresados.");
        }
      } else {
        const errorMessage = err.response?.data?.message || err.message || "Error al guardar concepto";
        toast.error(errorMessage);
        setFormErrors({ general: errorMessage });
      }
    }
  };

  const filteredConcepts = concepts.filter((concept) => {
    const matchesSearch = !searchTerm || 
      concept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (concept.description && concept.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = !categoryFilter || concept.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const parentConceptsList = filteredConcepts.filter((c) => !c.parent_id);
  const categories = [...new Set(concepts.map((c) => c.category).filter(Boolean))];

  const renderChildren = (parentId) => {
    const children = filteredConcepts.filter((c) => c.parent_id === parentId);
    if (children.length === 0) return null;

    return (
      <tbody>
        {children.map((child) => (
          <tr key={child.id} className="table-light">
            <td>
              <span className="ms-4">
                <FaChevronRight className="me-2" />
                {child.id}
              </span>
            </td>
            <td>
              <span className="ms-4">{child.name}</span>
            </td>
            <td>
              <span className="ms-4">{child.description || "—"}</span>
            </td>
            <td>
              <span className="ms-4">
                <Badge bg="secondary">{child.category || "general"}</Badge>
              </span>
            </td>
            <td>
              <span className="ms-4">
                <Badge bg={child.is_active ? "success" : "secondary"}>
                  {child.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </span>
            </td>
            <td>
              <div className="d-flex gap-2 ms-4">
                <Button
                  variant="warning"
                  size="sm"
                  onClick={() => handleEdit(child)}
                  title="Editar"
                >
                  <FaEdit />
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(child)}
                  title="Eliminar"
                  disabled={actionLoading === child.id}
                >
                  {actionLoading === child.id ? (
                    <Spinner size="sm" />
                  ) : (
                    <FaTrashAlt />
                  )}
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    );
  };

  return (
    <div className="container-fluid py-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">
            <FaFolder className="me-2" />
            Administración de Conceptos Operativos
          </h4>
          <div className="d-flex gap-2">
            <Button
              variant="success"
              onClick={() => handleCreate()}
              title="Crear Concepto Padre"
            >
              <FaPlus className="me-2" />
              Crear Concepto
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSearch} className="mb-4">
            <Row className="g-3">
              <Col md={4}>
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Buscar por nombre o descripción..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </Col>
              <Col md={3}>
                <Form.Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Check
                  type="switch"
                  id="show-only-parents"
                  label="Solo padres"
                  checked={showOnlyParents}
                  onChange={(e) => {
                    setShowOnlyParents(e.target.checked);
                    setExpandedParents(new Set());
                  }}
                />
              </Col>
              <Col md={3}>
                <Button type="submit" variant="outline-primary" className="w-100">
                  Buscar
                </Button>
              </Col>
            </Row>
          </Form>

          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Cargando...</span>
              </Spinner>
            </div>
          ) : parentConceptsList.length === 0 ? (
            <Alert variant="info" className="text-center">
              No se encontraron conceptos
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>ID</th>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                {parentConceptsList.map((parent) => {
                  const hasChildren = filteredConcepts.some((c) => c.parent_id === parent.id);
                  const isExpanded = expandedParents.has(parent.id);

                  return (
                    <React.Fragment key={parent.id}>
                      <tbody>
                        <tr>
                          <td>
                            {hasChildren && (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 me-2"
                                onClick={() => toggleParent(parent.id)}
                                style={{ textDecoration: "none" }}
                              >
                                {isExpanded ? (
                                  <FaChevronDown />
                                ) : (
                                  <FaChevronRight />
                                )}
                              </Button>
                            )}
                            {parent.id}
                          </td>
                          <td>
                            <FaFolder className="me-2" />
                            <strong>{parent.name}</strong>
                          </td>
                          <td>{parent.description || "—"}</td>
                          <td>
                            <Badge bg="primary">{parent.category || "general"}</Badge>
                          </td>
                          <td>
                            <Badge bg={parent.is_active ? "success" : "secondary"}>
                              {parent.is_active ? "Activo" : "Inactivo"}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button
                                variant="info"
                                size="sm"
                                onClick={() => handleCreate(parent.id)}
                                title="Crear concepto hijo"
                              >
                                <FaPlus />
                              </Button>
                              <Button
                                variant="warning"
                                size="sm"
                                onClick={() => handleEdit(parent)}
                                title="Editar"
                              >
                                <FaEdit />
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(parent)}
                                title="Eliminar"
                                disabled={actionLoading === parent.id}
                              >
                                {actionLoading === parent.id ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <FaTrashAlt />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                      {isExpanded && hasChildren && renderChildren(parent.id)}
                    </React.Fragment>
                  );
                })}
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal de formulario */}
      <Modal show={showForm} onHide={() => setShowForm(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedConcept ? "Editar Concepto" : "Crear Concepto"}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleFormSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>
                Nombre <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                isInvalid={!!formErrors.name}
                required
                placeholder="Ej: Clientes Nuevos, Creación Nuevo Cliente"
              />
              <Form.Control.Feedback type="invalid">
                {Array.isArray(formErrors.name) ? formErrors.name[0] : formErrors.name}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                isInvalid={!!formErrors.description}
                placeholder="Descripción opcional del concepto"
              />
              <Form.Control.Feedback type="invalid">
                {Array.isArray(formErrors.description) ? formErrors.description[0] : formErrors.description}
              </Form.Control.Feedback>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Categoría</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    isInvalid={!!formErrors.category}
                    placeholder="general"
                  />
                  <Form.Control.Feedback type="invalid">
                    {Array.isArray(formErrors.category) ? formErrors.category[0] : formErrors.category}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    Categoría para agrupar conceptos (opcional)
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Estado</Form.Label>
                  <Form.Select
                    value={formData.is_active ? "true" : "false"}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.value === "true" })
                    }
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Concepto Padre</Form.Label>
              <Form.Select
                value={formData.parent_id || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    parent_id: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                isInvalid={!!formErrors.parent_id}
              >
                <option value="">Ninguno (Concepto Padre)</option>
                {parentConcepts
                  .filter((p) => !selectedConcept || p.id !== selectedConcept.id)
                  .map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {Array.isArray(formErrors.parent_id) ? formErrors.parent_id[0] : formErrors.parent_id}
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                Selecciona un concepto padre para crear un subconcepto, o déjalo vacío para crear un concepto principal
              </Form.Text>
            </Form.Group>

            {Object.keys(formErrors).length > 0 && formErrors.general && (
              <Alert variant="danger">
                <strong>Error:</strong> {formErrors.general}
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {selectedConcept ? "Actualizar" : "Crear"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default OperationalConceptsAdmin;

