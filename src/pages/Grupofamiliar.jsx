import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Grupofamiliar.css";
import apiRequest from "../services/api";

const Grupofamiliar = () => {
  // Initial form state for policy
  const INITIAL_POLICY_STATE = {
    compania: "",
    plan_id: "",
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
    fecha_cancelacion:"",
    compania_id:"",
    codigo_poliza:"",
    referido:""
  };

  // State for policy details
  const [policyData, setPolicyData] = useState(INITIAL_POLICY_STATE);
  
  // State for family members
  const [familyMembers, setFamilyMembers] = useState([]);
  
  // State for selecting existing clients
  const [availableClients, setAvailableClients] = useState([]);
  
  // State for available companies
  const [availableCompanies, setAvailableCompanies] = useState([]);

  // State for available companies
  const [availablePlan, setAvailablePlan] = useState([]);
  
  // Alert state
  const [alert, setAlert] = useState({ type: "", message: "", visible: false });

  // Fetch available clients and companies when component mounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch clients
        const clientsResponse = await apiRequest("cliente/", "GET");
        console.log("Clients API Response:", clientsResponse); // Debugging log

        if (Array.isArray(clientsResponse)) {
          setAvailableClients(clientsResponse);
        } else {
          console.error("Unexpected clients API response format:", clientsResponse);
        }

        // Fetch companies
        const companiesResponse = await apiRequest("compania/", "GET");
        console.log("Companies API Response:", companiesResponse); // Debugging log

        if (Array.isArray(companiesResponse)) {
          setAvailableCompanies(companiesResponse);
        } else {
          console.error("Unexpected companies API response format:", companiesResponse);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    
    fetchData();
  }, []);

  // Fetch available clients and planes
  useEffect(() => {
    const fetchDataplan = async () => {
      try {

   // Fetch plan
   const planResponse = await apiRequest("plan/", "GET");
   console.log("Companies API Response:", planResponse); // Debugging log

   if (Array.isArray(planResponse)) {
     setAvailablePlan(planResponse);
   } else {
     console.error("Unexpected companies API response format:", planResponse);
   }
 } catch (error) {
   console.error("Error fetching data:", error);
 }
};

fetchDataplan();
}, []);
  

  // Handle policy form changes
  const handlePolicyChange = (e) => {
    const { name, value } = e.target;
    setPolicyData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add family member from existing clients
  const addFamilyMember = (client) => {
    // Check if client is already in family members
    if (!familyMembers.some(member => member.id === client.id)) {
      setFamilyMembers(prev => [...prev, {
        id: client.id,
        nombre: client.nombre_completo,
        parentesco: "", // User can specify relationship
        fecha_activacion: new Date().toISOString().split('T')[0]
      }]);
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

  return (
    <div className="container mt-4 label-custom">
      <h2 className="text-center mb-4">Registro Grupo Familiar</h2>
      
      <form onSubmit={handleSubmit} className="p-4 shadow bg-white rounded">
        <h4 className="mb-3">Datos de la Póliza</h4>
        <hr />
        
        {/* Policy Details Inputs */}
        <div className="row">
          <div className="col-md-10 mb-3">
            <label>Compañía</label>
            <select 
              name="compania" 
              className="form-select" 
              value={policyData.compania}
              onChange={handlePolicyChange}
            >
              <option value="">Seleccione</option>
              {availableCompanies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.nombre}
                </option>
              ))}
            </select>
          </div> 
          

        <div className="row">
          <div className="col-md-6 mb-3">
              <label>Plan</label>
              <select 
                name="plan_id" 
                className="form-select" 
                value={policyData.plan_id}
                onChange={handlePolicyChange}
              >
                <option value="">Seleccione</option>
              {availablePlan.map(plans => (
                <option key={plans.id} value={plans.id}>
                  {plans.nombre}
                </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
            <label>Metal</label>
            <input type="text" name="metal" className="form-control" value={policyData.metal} onChange={handlePolicyChange}/>
          </div>  
          <div className="col-md-3">
            <label>Precio $</label>
            <input type="text" name="precio" className="form-control" value={policyData.precio} onChange={handlePolicyChange} />
          </div>
          <div className="col-md-3">
            <label>Elegibilidad</label>
            <input type="text" name="elegibilidad" className="form-control" value={policyData.elegibilidad} onChange={handlePolicyChange}/>
          </div>
        
          <div className="col-md-3">
            <label># Personas en Taxes</label>
            <input type="text" name="personas_en_taxes" className="form-control" value={policyData.personas_en_taxes} onChange={handlePolicyChange}/>
          </div>

          <div className="col-md-3">
            <label># Personas en Cobertura</label>
            <input type="text" name="personas_cobertura" className="form-control" value={policyData.personas_cobertura} onChange={handlePolicyChange}/>
          </div>

            <div className="col-md-3">
              <label>Ingreso Familiar Anual $</label>
              <input type="text" name="ingreso_familiar" className="form-control" value={policyData.ingreso_familiar} onChange={handlePolicyChange}/>
            </div>        
      </div>

    </div>

    <h4 className="mt-4">Datos de Contacto</h4>
    <hr />
    <div className="row">
        <div className="col-md-3">
          <label>Persona de contacto en la poliza</label>
          <input type="text" name="persona_contacto" className="form-control" value={policyData.persona_contacto} onChange={handlePolicyChange}/>
        </div>
        <div className="col-md-3">
          <label>Medio de Contacto</label>
          <input type="text" name="medio_contacto" className="form-control" value={policyData.medio_contacto} onChange={handlePolicyChange}/>
        </div>
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
        <h4 className="mt-4">Personas con Cobertura</h4>
        <hr />
     
        {/* Client Selection Dropdown */}
        <div className="mb-3 col-md-10">
          <label>Agregar Miembro Familiar</label>
          <select 
            className="form-select" 
            onChange={(e) => {
              const selectedClient = availableClients.find(
                client => client.id === parseInt(e.target.value) // Ensure the ID is treated as a number
              );
              if (selectedClient) addFamilyMember(selectedClient);
            }}
              >
                  <option value="">Seleccionar Cliente</option>
                  {availableClients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.nombre_completo}
                    </option>
                  ))}
                </select>

        </div>
                  
        {/* Family Members Table */}
        <table className="table table-striped">
          <thead>
            <tr>
              <th>ID Poliza</th>
              <th>Nombre</th>
              <th>Parentesco</th>
              <th>Fecha Activación</th>
              <th>Fecha Cancelacion</th>
              <th>Compañia</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {familyMembers.map(member => (
              <tr key={member.id}>
                <td><input 
                    type="text" 
                    className="form-control form-control-sm"
                    value={member.codigo_poliza}
                    onChange={(e) => updateFamilyMember(
                      member.id, 
                      'codigo_poliza', 
                      e.target.value
                    )}
                    placeholder="ID Poliza"
                  /></td>
                <td>{member.nombre}</td>
                <td>
                  <input 
                    type="text" 
                    className="form-control form-control-sm"
                    value={member.parentesco}
                    onChange={(e) => updateFamilyMember(
                      member.id, 
                      'parentesco', 
                      e.target.value
                    )}
                    placeholder="Ej. Esposo, Hijo"
                  />
                </td>
                <td>
                  <input 
                    type="date" 
                    className="form-control form-control-sm"
                    value={member.fecha_activacion}
                    onChange={(e) => updateFamilyMember(
                      member.id, 
                      'fecha_activacion', 
                      e.target.value
                    )}
                  />
                </td>
                <td>
                  <input 
                    type="date" 
                    className="form-control form-control-sm"
                    value={member.fecha_cancelacion}
                    onChange={(e) => updateFamilyMember(
                      member.id, 
                      'fecha_cancelacion', 
                      e.target.value
                    )}
                  />
                </td>
                <td>
                  <select 
                    className="form-select form-select-sm" 
                    value={member.compania_id || ""}
                    onChange={(e) => updateFamilyMember(
                      member.id, 
                      'compania_id', 
                      e.target.value
                    )}
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
                  <button 
                    type="button" 
                    className="btn btn-danger btn-sm"
                    onClick={() => removeFamilyMember(member.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Alerts */}
        {alert.visible && (
          <div className="d-flex justify-content-center mt-4"> 
            <div className={`alert alert-${alert.type} d-flex align-items-center w-75 shadow-sm`} 
                 role="alert"
                 style={{ borderRadius: "8px", fontSize: "16px", textAlign: "center" }}>
              <span className="me-2">{alert.type === "success" ? "✅" : "⚠️"}</span>
              <span>{alert.message}</span>
            </div>
          </div>
        )}

        <div className="mt-4">
          <button type="submit" className="btn btn-primary">
            Guardar Póliza de Grupo Familiar
          </button>
        </div>
      </form>
    </div>
  );
};

export default Grupofamiliar;