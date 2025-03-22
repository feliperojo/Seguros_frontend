import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Grupofamiliar.css";
import apiRequest from "../services/api";
import { Modal, Button, Card, Form, Row, Col, Table, Alert } from "react-bootstrap";
import Clientes from "./Clientes";

const Grupofamiliar = () => {
  // Initial form state for policy
  const INITIAL_POLICY_STATE = {
    compania: "",
    plan: "",
    metal: "",
    precio: "",
    elegibilidad: "",
    personas_en_taxes: "",
    personas_cobertura: "",
    ingreso_familiar: "",
    persona_contacto: "",
    medio_contacto: "",
    telefono1: "",
    telefono2: "",
    notas_telefonos: "",
    fecha_cancelacion: "",
    compania_id: "",
    codigo_poliza: "",
    referido: "",
    parentesco_id: "",
    estado_cobertura: "",
    pertenece_grupo_familiar: false
  };

  // Lista de tipos de productos disponibles
  const TIPOS_PRODUCTOS = [
    { id: "SEGURO MEDICO  OBAMA", nombre: "SEGURO MEDICO  OBAMA" },
    { id: "SEGURO  MEDICO SHORT TERM", nombre: "SEGURO  MEDICO SHORT TERM" },
    { id: "VISION", nombre: "VISION" },
    { id: "DENTAL", nombre: "DENTAL" },
    { id: "VISION/DENTAL", nombre: "VISION/DENTAL" },
    { id: "SEGURO DE VIDA", nombre: "SEGURO DE VIDA" },
    { id: "PLAN DE DESCUENTO", nombre: "PLAN DE DESCUENTO" },
    { id: "otro", nombre: "Otro" }
  ];

  // Step control
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2;

  const [coverageGroups, setCoverageGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [policyData, setPolicyData] = useState(INITIAL_POLICY_STATE);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [availablePrentes, setAvailableParentes] = useState([]);
  const [alert, setAlert] = useState({ type: "", message: "", visible: false });
  const [contactMethods, setContactMethods] = useState({
    whatsapp: false,
    telegram: false,
    texto_sms: false
  });

  // Initialize the first coverage group if none exists
  useEffect(() => {
    if (coverageGroups.length === 0) {
      setCoverageGroups([{
        id: 1,
        tipoProducto: "SEGURO MEDICO  OBAMA", // Valor por defecto
        policyData: { ...INITIAL_POLICY_STATE },
        members: []
      }]);
    }
  }, []);

  // Fetch available clients and companies when component mounts
  useEffect(() => {
    fetchCompanies();
    fetchDataparentesco();
  }, []);

  // Function to fetch companies
  const fetchCompanies = async () => {
    try {
      const companiesResponse = await apiRequest("compania/", "GET");
      if (Array.isArray(companiesResponse)) {
        setAvailableCompanies(companiesResponse);
      } else {
        console.error("Unexpected companies API response format:", companiesResponse);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
      setAlert({
        type: "danger",
        message: "Error al cargar las compañías",
        visible: true
      });
    }
  };

  // Fetch available parentesco
  const fetchDataparentesco = async () => {
    try {
      const parentecoResponse = await apiRequest("parentesco/", "GET");
      if (Array.isArray(parentecoResponse)) {
        setAvailableParentes(parentecoResponse);
      } else {
        console.error("Unexpected parentesco API response format:", parentecoResponse);
      }
    } catch (error) {
      console.error("Error fetching parentesco:", error);
      setAlert({
        type: "danger",
        message: "Error al cargar los tipos de parentesco",
        visible: true
      });
    }
  };

  // Handle policy form changes
  const handlePolicyChange = (e) => {
    const { name, value } = e.target;
    setPolicyData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle contact method changes
  const handleContactMethodChange = (e) => {
    const { name, checked } = e.target;
    setContactMethods(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  // Manejar cambio en el tipo de producto de una cobertura
  const handleProductTypeChange = (groupId, newProductType) => {
    setCoverageGroups(prevGroups =>
      prevGroups.map(group =>
        group.id === groupId
          ? { ...group, tipoProducto: newProductType }
          : group
      )
    );
  };

  const addFamilyMember = (client) => {
    if (!client || !client.id) return;

    setFamilyMembers((prev) => [...prev, {
      id: client.id,
      nombre: client.nombre_completo,
      fecha_activacion: new Date().toISOString().split("T")[0]
    }]);

    setCoverageGroups((prevGroups) => {
      return prevGroups.map((group, index) => {
        if (index === 0) { // Solo afecta la primera tabla
          return {
            ...group,
            members: [...group.members, {
              id: client.id,
              nombre: client.nombre_completo,
              parentesco: "",
              fecha_activacion: new Date().toISOString().split("T")[0]
            }]
          };
        }
        return group;
      });
    });
  };

  const handleClienteCreated = async (newClient) => {
    if (newClient && newClient.id) {
      addFamilyMember(newClient);
      console.log("Cliente agregado a la tabla en GrupoFamiliar.");
    }
  };
  
  // Remove family member
  const removeFamilyMember = (clientId) => {
    setFamilyMembers(prev =>
      prev.filter(member => member.id !== clientId)
    );
  };

  // Update family member details
  const updateFamilyMember = (clientId, field, value) => {
    setFamilyMembers(prev =>
      prev.map(member =>
        member.id === clientId
          ? { ...member, [field]: value }
          : member
      )
    );
  };

  const addCoverageGroup = () => {
    let newMembers = [];

    if (coverageGroups.length > 0) {
      // Solo copiamos el ID y el nombre, dejando los demás datos en blanco
      newMembers = coverageGroups[0].members.map(member => ({
        id: member.id,
        nombre: member.nombre,
        parentesco: "",
        fecha_activacion: "",
        fecha_cancelacion: "",
        compania_id: "",
        plan: "",
        metal: "",
        elegibilidad: "",
        estado_cobertura: "",
        codigo_poliza: "",
        precio: ""
      }));
    }

    const newGroup = {
      id: coverageGroups.length + 1,
      tipoProducto: "SEGURO MEDICO  OBAMA", // Por defecto nueva cobertura es Seguro Médico
      policyData: { ...INITIAL_POLICY_STATE }, // Datos de póliza independientes
      members: newMembers, // Se copian solo ID y nombre de los miembros
    };

    setCoverageGroups([...coverageGroups, newGroup]);
  };

  // Eliminar un miembro solo de la tabla en la que se encuentra
  const removeMemberFromGroup = (groupId, memberId) => {
    setCoverageGroups((prevGroups) =>
      prevGroups.map((group) =>
        group.id === groupId
          ? { ...group, members: group.members.filter((m) => m.id !== memberId) }
          : group
      )
    );
  };

  const updateMemberData = (groupId, memberId, field, value) => {
    setCoverageGroups((prevGroups) =>
      prevGroups.map((group) =>
        group.id === groupId
          ? {
            ...group,
            members: group.members.map((member) =>
              member.id === memberId ? { ...member, [field]: value } : member
            ),
          }
          : group
      )
    );
  };

  // Navigation between steps
  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Submit policy and family group
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prepare submission data
    const submissionData = {
      ...policyData,
      familia: familyMembers
    };

    try {
      const response = await apiRequest("grupo_familiar/create", "POST", submissionData);

      if (response?.message && response.message.toLowerCase().includes("poliza creada exitosamente")) {
        // Reset form
        setPolicyData(INITIAL_POLICY_STATE);
        setFamilyMembers([]);
        setCoverageGroups([{
          id: 1,
          tipoProducto: "SEGURO MEDICO  OBAMA",
          policyData: { ...INITIAL_POLICY_STATE },
          members: []
        }]);
        setCurrentStep(1);
        setContactMethods({
          whatsapp: false,
          telegram: false,
          texto_sms: false
        });

        // Show success alert
        setAlert({
          type: "success",
          message: "Póliza de Grupo Familiar creada exitosamente",
          visible: true
        });

        // Hide alert after 5 seconds
        setTimeout(() => {
          setAlert({ type: "", message: "", visible: false });
        }, 5000);
      } else {
        throw new Error(response?.message || "Error desconocido");
      }
    } catch (err) {
      console.error("Error creating policy:", err);
      setAlert({
        type: "danger",
        message: "Error al crear la póliza: " + err.message,
        visible: true
      });
    }
  };

  // Render step progress bar
  const renderStepProgressBar = () => (
    <div className="mb-4">
      <div className="progress" style={{ height: '10px', borderRadius: '5px' }}>
        <div
          className="progress-bar bg-primary"
          role="progressbar"
          style={{
            width: `${(currentStep / totalSteps) * 100}%`,
            transition: 'width 0.3s ease-in-out'
          }}
          aria-valuenow={(currentStep / totalSteps) * 100}
          aria-valuemin="0"
          aria-valuemax="100"
        ></div>
      </div>
      <div className="d-flex justify-content-between mt-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <div key={step} className="text-center" style={{ width: '100%' }}>
            <div
              className={`d-flex align-items-center justify-content-center rounded-circle mx-auto mb-2 ${
                step <= currentStep ? 'bg-primary text-white' : 'bg-light'
              }`}
              style={{ width: '32px', height: '32px' }}
            >
              {step}
            </div>
            <div className={step <= currentStep ? 'fw-bold' : ''}>
              {step === 1 ? 'Datos Principales' : 'Coberturas'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render form based on current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="shadow-sm border-0 mb-4">
            <Card.Body>
              <h4 className="mb-3 text-primary">Datos de la Póliza</h4>
              <hr />
              
              <Row className="mb-4">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Personas en Taxes</Form.Label>
                    <Form.Control 
                      type="text" 
                      name="personas_en_taxes" 
                      value={policyData.personas_en_taxes}
                      onChange={handlePolicyChange}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Personas en Cobertura</Form.Label>
                    <Form.Control 
                      type="text" 
                      name="personas_cobertura" 
                      value={policyData.personas_cobertura}
                      onChange={handlePolicyChange}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Ingreso Familiar Anual ($)</Form.Label>
                    <Form.Control 
                      type="text" 
                      name="ingreso_familiar"
                      value={policyData.ingreso_familiar}
                      onChange={handlePolicyChange}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <h4 className="mt-4 mb-3 text-primary">Datos de Contacto</h4>
              <hr />
              
              <Row className="mb-4">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Persona de contacto en la póliza</Form.Label>
                    <Form.Control 
                      type="text" 
                      name="persona_contacto" 
                      value={policyData.persona_contacto}
                      onChange={handlePolicyChange}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={2}>
                  <Form.Group>
                    <Form.Label className="fw-medium d-block">¿Pertenece al grupo familiar?</Form.Label>
                    <Button 
                      variant={policyData.pertenece_grupo_familiar ? "primary" : "outline-primary"}
                      onClick={() => {
                        setPolicyData({
                          ...policyData,
                          pertenece_grupo_familiar: !policyData.pertenece_grupo_familiar
                        });
                      }}
                      className="w-100"
                    >
                      {policyData.pertenece_grupo_familiar ? 'Sí' : 'No'}
                    </Button>
                  </Form.Group>
                </Col>
                
                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Teléfono 1</Form.Label>
                    <Form.Control 
                      type="text" 
                      name="telefono1" 
                      value={policyData.telefono1}
                      onChange={handlePolicyChange}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Teléfono 2</Form.Label>
                    <Form.Control 
                      type="text" 
                      name="telefono2" 
                      value={policyData.telefono2}
                      onChange={handlePolicyChange}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-4">
                <Col xs={12}>
                  <Form.Label className="fw-medium mb-2">Medios de contacto preferidos</Form.Label>
                  <div className="d-flex flex-row flex-wrap gap-4">
                    <Form.Check 
                      type="checkbox"
                      id="whatsapp"
                      name="whatsapp"
                      label="WhatsApp"
                      checked={contactMethods.whatsapp}
                      onChange={handleContactMethodChange}
                      className="d-flex align-items-center gap-2"
                    />
                    <Form.Check 
                      type="checkbox"
                      id="telegram"
                      name="telegram"
                      label="Telegram"
                      checked={contactMethods.telegram}
                      onChange={handleContactMethodChange}
                      className="d-flex align-items-center gap-2"
                    />
                    <Form.Check 
                      type="checkbox"
                      id="texto_sms"
                      name="texto_sms"
                      label="Texto SMS"
                      checked={contactMethods.texto_sms}
                      onChange={handleContactMethodChange}
                      className="d-flex align-items-center gap-2"
                    />
                  </div>
                </Col>
              </Row>

              <Row className="mb-4">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-medium" title="Selecciona el medio por el cual fue conocido el grupo familiar">
                      Captado por
                    </Form.Label>
                    <Form.Select name="captado_por" onChange={handlePolicyChange}>
                      <option value="">Seleccione</option>
                      <option value="Referido">Referido</option>
                      <option value="Google">Google</option>
                      <option value="Redes sociales">Redes sociales</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Cuál</Form.Label>
                    <Form.Control 
                      type="text" 
                      name="referido" 
                      value={policyData.referido}
                      onChange={handlePolicyChange}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Nota</Form.Label>
                    <Form.Control 
                      type="text" 
                      name="notas_contacto" 
                      value={policyData.notas_contacto}
                      onChange={handlePolicyChange}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        );
      case 2:
        return (
          <Card className="shadow-sm border-0 mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="mb-0 text-primary">Personas con Cobertura</h4>
                <Button variant="primary" onClick={() => setShowModal(true)}>
                  <i className="bi bi-plus-circle me-2"></i>Agregar Miembro
                </Button>
              </div>
              <hr />

              {coverageGroups.map((group) => (
                <div key={group.id} className="mb-4">
                  <div className="d-flex align-items-center mb-3">
                    <h5 className="me-3 mb-0">Cobertura {group.id}:</h5>
                    <Form.Select 
                      style={{ width: "auto", maxWidth: "300px" }}
                      value={group.tipoProducto}
                      onChange={(e) => handleProductTypeChange(group.id, e.target.value)}
                      className="form-select-sm"
                    >
                      {TIPOS_PRODUCTOS.map(producto => (
                        <option key={producto.id} value={producto.id}>
                          {producto.nombre}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                  
                  <div className="table-responsive border rounded">
                    <Table striped hover className="mb-0" size="sm">
                      <thead className="bg-light">
                        <tr>
                          <th style={{ minWidth: "120px" }}>ID Póliza</th>
                          <th style={{ minWidth: "200px" }}>Nombre</th>
                          <th style={{ minWidth: "125px" }}>Parentesco</th>
                          <th>Fecha Activación</th>
                          <th>Fecha Cancelación</th>
                          <th>Año Cobertura</th>
                          <th style={{ minWidth: "150px" }}>Compañía</th>
                          <th style={{ minWidth: "150px" }}>Plan</th>
                          <th style={{ minWidth: "120px" }}>Metal</th>
                          <th style={{ minWidth: "120px" }}>Elegibilidad</th>
                          <th style={{ minWidth: "125px" }}>Cobertura</th>
                          <th style={{ minWidth: "95px" }}>Red</th>
                          <th>Pagador</th>
                          <th>Precio</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.members.length > 0 ? (
                          group.members.map(member => (
                            <tr key={member.id}>
                              <td>
                                <Form.Control 
                                  size="sm"
                                  type="text" 
                                  value={member.codigo_poliza || ""}
                                  onChange={(e) => updateMemberData(group.id, member.id, "codigo_poliza", e.target.value)}
                                  placeholder="ID Póliza"
                                />
                              </td>
                              <td>{member.nombre}</td>
                              <td>
                                <Form.Select 
                                  size="sm"
                                  value={member.parentesco_id || ""}
                                  onChange={(e) => updateMemberData(group.id, member.id, "parentesco_id", e.target.value)}
                                >
                                  <option value="">Seleccione</option>
                                  {availablePrentes.map(parentesco => (
                                    <option key={parentesco.id} value={parentesco.id}>
                                      {parentesco.descripcion}
                                    </option>
                                  ))}
                                </Form.Select>
                              </td>
                              <td>
                                <Form.Control 
                                  size="sm"
                                  type="date" 
                                  value={member.fecha_activacion || ""}
                                  onChange={(e) => updateMemberData(group.id, member.id, "fecha_activacion", e.target.value)}
                                />
                              </td>
                              <td>
                                <Form.Control 
                                  size="sm"
                                  type="date" 
                                  value={member.fecha_cancelacion || ""}
                                  onChange={(e) => updateMemberData(group.id, member.id, "fecha_cancelacion", e.target.value)}
                                />
                              </td>
                              <td>
                                <Form.Control 
                                  size="sm"
                                  type="text" 
                                  value={member.ano || ""}
                                  onChange={(e) => updateMemberData(group.id, member.id, "ano", e.target.value)}
                                  placeholder="Año"
                                />
                              </td>
                              <td>
                                <Form.Select 
                                  size="sm"
                                  value={member.compania_id || ""}
                                  onChange={(e) => updateMemberData(group.id, member.id, "compania_id", e.target.value)}
                                >
                                  <option value="">Seleccione</option>
                                  {availableCompanies.map(company => (
                                    <option key={company.id} value={company.id}>
                                      {company.nombre}
                                    </option>
                                  ))}
                                </Form.Select>
                              </td>
                              <td>
                                <Form.Control 
                                  size="sm"
                                  type="text" 
                                  value={member.plan || ""}
                                  onChange={(e) => updateMemberData(group.id, member.id, "plan", e.target.value)}
                                  placeholder="Plan"
                                />
                              </td>
                              <td>
                                <Form.Select 
                                  size="sm"
                                  value={member.metal || ""} 
                                  onChange={(e) => updateMemberData(group.id, member.id, "metal", e.target.value)}
                                >
                                  <option value="">Seleccione</option>
                                  <option value="BRONCE">BRONCE</option>
                                  <option value="GOLD">GOLD</option>
                                  <option value="SILVER">SILVER</option>
                                </Form.Select>
                              </td>
                              <td>
                                <Form.Control 
                                  size="sm"
                                  type="text" 
                                  value={member.elegibilidad || ""}
                                  onChange={(e) => updateMemberData(group.id, member.id, "elegibilidad", e.target.value)}
                                  placeholder="Elegibilidad"
                                />
                              </td>
                              <td>       
                                <Form.Select 
                                  size="sm"
                                  value={member.estado_cobertura || ""} 
                                  onChange={(e) => updateMemberData(group.id, member.id, "estado_cobertura", e.target.value)}
                                >
                                  <option value="">Seleccione</option>
                                  <option value="Si">Si</option>
                                  <option value="No">No</option>
                                  <option value="MEDICARE">MEDICARE</option>
                                  <option value="MEDICAID">MEDICAID</option>
                                </Form.Select>
                              </td>
                              <td>       
                                <Form.Select 
                                  size="sm"
                                  value={member.red || ""} 
                                  onChange={(e) => updateMemberData(group.id, member.id, "red", e.target.value)}
                                >
                                  <option value="">Seleccione</option>
                                  <option value="HMO">HMO</option>
                                  <option value="EPO">EPO</option>
                                  <option value="PPO">PPO</option>
                                </Form.Select>
                              </td>
                              <td>
                                <Form.Control 
                                  size="sm"
                                  type="text" 
                                  value={member.pagador || ""}
                                  onChange={(e) => updateMemberData(group.id, member.id, "pagador", e.target.value)}
                                  placeholder="Pagador"
                                />
                              </td>
                              <td>
                                <Form.Control 
                                  size="sm"
                                  type="text" 
                                  value={member.precio || ""}
                                  onChange={(e) => updateMemberData(group.id, member.id, "precio", e.target.value)}
                                  placeholder="Precio"
                                />
                              </td>
                              <td>
                                <Button 
                                  variant="outline-danger" 
                                  size="sm"
                                  onClick={() => removeMemberFromGroup(group.id, member.id)}
                                >
                                  <i className="bi bi-trash"></i>
                                </Button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="15" className="text-center py-3">
                              No hay miembros agregados. Haga clic en "Agregar Miembro" para comenzar.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                </div>
              ))}

              <div className="mt-4">
                <Button variant="outline-primary" onClick={addCoverageGroup} className="d-flex align-items-center">
                  <i className="bi bi-plus-circle me-2"></i> Agregar nueva cobertura
                </Button>
              </div>
            </Card.Body>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container-fluid py-4">
      {/* Progress Bar */}
      {renderStepProgressBar()}
      
      {/* Alert Messages */}
      {alert.visible && (
        <Alert 
          variant={alert.type} 
          className="d-flex align-items-center shadow-sm mb-4"
          dismissible
          onClose={() => setAlert({...alert, visible: false})}
        >
          <i className={`bi ${alert.type === "success" ? "bi-check-circle" : "bi-exclamation-triangle"} me-2`}></i>
          {alert.message}
        </Alert>
      )}
      
      {/* Form Content */}
      {renderStepContent()}

      {/* Navigation Buttons */}
      <div className="d-flex justify-content-between mb-4">
        {currentStep > 1 && (
          <Button variant="secondary" onClick={prevStep}>
            <i className="bi bi-arrow-left me-2"></i>
            Anterior
          </Button>
        )}
        
        {currentStep < totalSteps ? (
          <Button variant="primary" className="ms-auto" onClick={nextStep}>
            Siguiente
            <i className="bi bi-arrow-right ms-2"></i>
          </Button>
        ) : (
          <Button variant="success" className="ms-auto" onClick={handleSubmit}>
            <i className="bi bi-save me-2"></i>
            Guardar Póliza de Grupo Familiar
          </Button>
        )}
      </div>
      
      {/* Modal for adding new client */}
      <Modal 
        show={showModal} 
        onHide={() => setShowModal(false)}
        size="xl"
        centered
      >
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            <i className="bi bi-person-plus me-2"></i>
            Agregar Miembro
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
                  <Clientes onClienteCreado={handleClienteCreated} />
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Grupofamiliar;