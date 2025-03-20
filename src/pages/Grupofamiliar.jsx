import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Grupofamiliar.css";
import apiRequest from "../services/api";
import { Modal, Button } from "react-bootstrap";
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
    estado_cobertura: ""
  };

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

  // Initialize the first coverage group if none exists
  useEffect(() => {
    if (coverageGroups.length === 0) {
      setCoverageGroups([{
        id: 1,
        policyData: { ...INITIAL_POLICY_STATE },
        members: []
      }]);
    }
  }, []);

  // Fetch available clients and companies when component mounts
  useEffect(() => {
    fetchCompanies();
  }, []);

  // Function to fetch companies
  const fetchCompanies = async () => {
    try {
      const companiesResponse = await apiRequest("compania/", "GET");
      console.log("Companies API Response:", companiesResponse);

      if (Array.isArray(companiesResponse)) {
        setAvailableCompanies(companiesResponse);
      } else {
        console.error("Unexpected companies API response format:", companiesResponse);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  // Fetch available parentesco
  useEffect(() => {
    const fetchDataparentesco = async () => {
      try {
        const parentecoResponse = await apiRequest("parentesco/", "GET");
        console.log("Parentesco API Response:", parentecoResponse);

        if (Array.isArray(parentecoResponse)) {
          setAvailableParentes(parentecoResponse);
        } else {
          console.error("Unexpected parentesco API response format:", parentecoResponse);
        }
      } catch (error) {
        console.error("Error fetching parentesco:", error);
      }
    };

    fetchDataparentesco();
  }, []);

  // Handle policy form changes
  const handlePolicyChange = (e) => {
    const { name, value } = e.target;
    setPolicyData(prev => ({
      ...prev,
      [name]: value
    }));
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
      
      // ❌ NO CERRAR EL MODAL AQUÍ (Eliminar setShowModal(false))
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
          policyData: { ...INITIAL_POLICY_STATE },
          members: []
        }]);
        setCurrentStep(1);

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
      <div className="d-flex justify-content-between">
        <div style={{ width: '100%', backgroundColor: '#e9ecef', height: '10px', borderRadius: '5px' }}>
          <div
            style={{
              width: `${(currentStep / totalSteps) * 100}%`,
              backgroundColor: '#0d6efd',
              height: '10px',
              borderRadius: '5px',
              transition: 'width 0.3s ease-in-out'
            }}
          />
        </div>
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
          <>
            <div className="content mt-4 label-custom">
              <h4 className="mb-3">Datos de la Póliza</h4>
              <hr />
              
              {/* Policy Details Inputs */}
              <div className="row">
                <div className="row">
                  <div className="col-md-4">
                    <label># Personas en Taxes</label>
                    <input type="text" name="personas_en_taxes" className="form-control" value={policyData.personas_en_taxes} onChange={handlePolicyChange}/>
                  </div>

                  <div className="col-md-4">
                    <label># Personas en Cobertura</label>
                    <input type="text" name="personas_cobertura" className="form-control" value={policyData.personas_cobertura} onChange={handlePolicyChange}/>
                  </div>

                  <div className="col-md-4">
                    <label>Ingreso Familiar Anual $</label>
                    <input type="text" name="ingreso_familiar" className="form-control" value={policyData.ingreso_familiar} onChange={handlePolicyChange}/>
                  </div>        
                </div>
              </div>

              <h4 className="mt-4">Datos de Contacto</h4>
              <hr />
              <div className="row mb-3">
                <div className="col-md-6">
                  <label>Persona de contacto en la poliza</label>
                  <input type="text" name="persona_contacto" className="form-control" value={policyData.persona_contacto} onChange={handlePolicyChange}/>
                </div>
                <div className="col-md-6">
                  <label>Medio de Contacto</label>
                  <input type="text" name="medio_contacto" className="form-control" value={policyData.medio_contacto} onChange={handlePolicyChange}/>
                </div>
              </div>
              <div className="row mb-3">
                <div className="col-md-3">
                  <label>Telefono 1</label>
                  <input type="text" name="telefono1" className="form-control" value={policyData.telefono1} onChange={handlePolicyChange}/>
                </div>
                <div className="col-md-3">
                  <label>Telefono 2</label>
                  <input type="text" name="telefono2" className="form-control" value={policyData.telefono2} onChange={handlePolicyChange}/>
                </div>
                <div className="col-md-6">
                  <label>Nombre de Referencia</label>
                  <input type="text" name="referido" className="form-control" value={policyData.referido} onChange={handlePolicyChange}/>
                </div>
              </div>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <div className="content mt-4 label-custom">
              <h4 className="mb-3">Personas con Cobertura</h4>
              <hr />
              {/* Button to add new client */}
              <Button variant="primary" onClick={() => setShowModal(true)} className="mb-3">
                Agregar Miembro
              </Button>

              {/* Family Members Table */}
              {coverageGroups.map((group) => (
                <div key={group.id} className="mb-4">
                  <h5>Cobertura # {group.id}</h5>
                  <div className="table-responsive" style={{ overflowX: "auto", maxHeight: "400px" }}>
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th style={{ minWidth: "120px" }}>ID Poliza</th>
                          <th style={{ minWidth: "200px" }}>Nombre</th>
                          <th style={{ minWidth: "125px" }}>Parentesco</th>
                          <th>Fecha Activación</th>
                          <th>Fecha Cancelacion</th>
                          <th>Año Cobertura</th>
                          <th style={{ minWidth: "150px" }}>Compañia</th>
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
                        {group.members.map(member => (
                          <tr key={member.id}>
                            <td><input 
                                type="text" 
                                className="form-control form-control-sm"
                                value={member.codigo_poliza || ""}
                                onChange={(e) => updateMemberData(group.id, member.id, "codigo_poliza", e.target.value)}
                                placeholder="ID Poliza"
                              /></td>
                            <td>{member.nombre}</td>
                            <td>
                              <select 
                                className="form-select form-select-sm" 
                                value={member.parentesco_id || ""}
                                onChange={(e) => updateMemberData(group.id, member.id, "parentesco_id", e.target.value)}
                              >
                                <option value="">Seleccione</option>
                                {availablePrentes.map(parentescos => (
                                  <option key={parentescos.id} value={parentescos.id}>
                                    {parentescos.descripcion}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input 
                                type="date" 
                                className="form-control form-control-sm"
                                value={member.fecha_activacion || ""}
                                onChange={(e) => updateMemberData(group.id, member.id, "fecha_activacion", e.target.value)}
                              />
                            </td>
                            <td>
                              <input 
                                type="date" 
                                className="form-control form-control-sm"
                                value={member.fecha_cancelacion || ""}
                                onChange={(e) => updateMemberData(group.id, member.id, "fecha_cancelacion", e.target.value)}
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm"
                                value={member.ano || ""}
                                onChange={(e) => updateMemberData(group.id, member.id, "ano", e.target.value)}
                                placeholder="Año"
                              />
                            </td>
                            <td>
                              <select 
                                className="form-select form-select-sm" 
                                value={member.compania_id || ""}
                                onChange={(e) => updateMemberData(group.id, member.id, "compania_id", e.target.value)}
                              >
                                <option value="">Seleccione</option>
                                {availableCompanies.map(company => (
                                  <option key={company.id} value={company.id}>
                                    {company.nombre}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm"
                                value={member.plan || ""}
                                onChange={(e) => updateMemberData(group.id, member.id, "plan", e.target.value)}
                                placeholder="Plan"
                              />
                            </td>
                            <td>
                              <select 
                                name="metal" 
                                className="form-select form-select-sm"  
                                value={member.metal || ""} 
                                onChange={(e) => updateMemberData(group.id, member.id, "metal", e.target.value)}
                              >
                                <option value="">Seleccione</option>
                                <option value="BRONCE">BRONCE</option>
                                <option value="GOLD">GOLD</option>
                                <option value="SILVER">SILVER</option>
                              </select>
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm"
                                value={member.elegibilidad || ""}
                                onChange={(e) => updateMemberData(group.id, member.id, "elegibilidad", e.target.value)}
                                placeholder="Elegibilidad"
                              />
                            </td>
                            <td>       
                              <select 
                                name="estado_cobertura" 
                                className="form-select form-select-sm"  
                                value={member.estado_cobertura || ""} 
                                onChange={(e) => updateMemberData(group.id, member.id, "estado_cobertura", e.target.value)}
                              >
                                <option value="">Seleccione</option>
                                <option value="Si">Si</option>
                                <option value="No">No</option>
                                <option value="MEDICARE">MEDICARE</option>
                                <option value="MEDICAID">MEDICAID</option>
                              </select>
                            </td>
                            <td>       
                              <select 
                                name="Red" 
                                className="form-select form-select-sm"  
                                value={member.red || ""} 
                                onChange={(e) => updateMemberData(group.id, member.id, "red", e.target.value)}
                              >
                                <option value="">Seleccione</option>
                                <option value="HMO">HMO</option>
                                <option value="EPO">EPO</option>
                                <option value="PPO">PPO</option>
                              </select>
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm"
                                value={member.pagador || ""}
                                onChange={(e) => updateMemberData(group.id, member.id, "pagador", e.target.value)}
                                placeholder="Pagador"
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm"
                                value={member.precio || ""}
                                onChange={(e) => updateMemberData(group.id, member.id, "precio", e.target.value)}
                                placeholder="Precio"
                              />
                            </td>
                            <td>
                              <button 
                                type="button" 
                                className="btn btn-danger btn-sm"
                                onClick={() => removeMemberFromGroup(group.id, member.id)}
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Add coverage button */}
              <div className="mb-3">
                <Button variant="btn btn-light" onClick={addCoverageGroup}>
                  + Agregar nueva cobertura
                </Button>
              </div>
            </div>
          </>
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
        <div className="d-flex justify-content-center mt-2 mb-3"> 
          <div className={`alert alert-${alert.type} d-flex align-items-center w-75 shadow-sm`} 
              role="alert"
              style={{ borderRadius: "8px", fontSize: "16px", textAlign: "center" }}>
            <span className="me-2">{alert.type === "success" ? "✅" : "⚠️"}</span>
            <span>{alert.message}</span>
          </div>
        </div>
      )}
      
      {/* Contenido del formulario (sin etiqueta form) */}
      {renderStepContent()}

      {/* Navigation Buttons */}
      <div className="d-flex justify-content-between mt-4 mb-4">
        {currentStep > 1 && (
          <button type="button" className="btn btn-secondary" onClick={prevStep}>
            Anterior
          </button>
        )}
        
        {currentStep < totalSteps ? (
          <button type="button" className="btn btn-primary ms-auto" onClick={nextStep}>
            Siguiente
          </button>
        ) : (
          <button type="button" className="btn btn-success ms-auto" onClick={handleSubmit}>
            Guardar Póliza de Grupo Familiar
          </button>
        )}
      </div>
      
      {/* Modal for adding new client */}
      <Modal 
        show={showModal} 
        onHide={() => setShowModal(false)}
        size="xl"
      >
        <Modal.Header closeButton>
          <Modal.Title>Agregar Miembro</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Clientes onClienteCreado={handleClienteCreated} />
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Grupofamiliar;