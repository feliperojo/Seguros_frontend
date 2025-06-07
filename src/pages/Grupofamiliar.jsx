import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Grupofamiliar.css";
import apiRequest from "../services/api";
import { Modal, Button, Card, Form, Row, Col, Table, Alert, Dropdown, Accordion, Nav } from "react-bootstrap";
import Clientes from "./Clientes";
import ClienteExistente from "../components/ClienteExistente"; // Importamos el nuevo componente
import CountrySelectWithFlags from '../components/CountrySelect';
import countryCodes from '../services/countryCodes';
import Swal from 'sweetalert2';
import GrupoFamiliarService from '../services/GrupoFamiliarService';
import BitacoraModal from "../components/Tareas/BitacoraModal"; // Ajusta ruta si es necesario


const Grupofamiliar = ({ mode = "create", id = null, initialData = null }) => {
  // Estado para controlar la pestaña activa en el modal
  const [activeTab, setActiveTab] = useState("nuevo");

  const navigate = useNavigate();

  useEffect(() => {
    if (mode === "edit" && initialData) {

      setPolicyData(prev => ({
        ...prev,
        personas_en_taxes: initialData.personas_taxes || "",
        personas_cobertura: initialData.personas_cobertura || "",
        ingreso_familiar: initialData.ingreso_familiar_anual || 0,
        persona_contacto: initialData.persona_contacto || "",
        relacion: initialData.relacion || "",
        telefono_1: initialData.telefonos?.telefono_1?.replace(/^\+\d{1,4}/, "") || "",
        telefono_2: initialData.telefonos?.telefono_2?.replace(/^\+\d{1,4}/, "") || "",
        notas_telefonos: initialData.nota || "",
        pertenece_grupo_familiar: initialData.pertenece_grupo_familiar || false,
        captado_por: initialData.captado_por || "",
        referido: initialData.cual || "",
        responsable: initialData.responsable || ""
      }));

      setContactMethods({
        whatsapp: initialData.telefonos?.whatsapp || false,
        telegram: initialData.telefonos?.telegram || false,
        texto_sms: initialData.telefonos?.mensaje_sms || false
      });

      if (initialData.cod_tel_1) {
        const codeObj = countryCodes.find(c => c.code === initialData.cod_tel_1);
        if (codeObj) setSelectedCode(prev => ({ ...prev, telefono_1: codeObj.iso }));
      }
      if (initialData.cod_tel_2) {
        const codeObj = countryCodes.find(c => c.code === initialData.cod_tel_2);
        if (codeObj) setSelectedCode(prev => ({ ...prev, telefono_2: codeObj.iso }));
      }

      if (initialData.coberturas && Array.isArray(initialData.coberturas)) {
        setCoverageGroups(transformarCoberturasAcoverageGroups(initialData.coberturas || []));
      }
    }
  }, [mode, initialData]);






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
    relacion: "",
    medio_contacto: "",
    telefono_1: "",
    telefono_2: "",
    notas_telefonos: "",
    fecha_cancelacion: "",
    compania_id: "",
    cliente_id: "",
    codigo_poliza: "",
    referido: "",
    captado_por: "",
    parentesco: "",
    estado_cobertura: "",
    cobertura_tipo: "SEGURO MEDICO  OBAMA",
    pertenece_grupo_familiar: false,
    responsable: ""
  };

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

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2;

  const [conteoMiembros, setConteoMiembros] = useState(0);
  const [conteoCoberturaYes, setConteoCoberturaYes] = useState(0);

  const [totalMiembros, setTotalMiembros] = useState(0);
  const [totalYes, setTotalYes] = useState(0);
  const [showBitacoraModal, setShowBitacoraModal] = useState(false);
  const [bitacoraData, setBitacoraData] = useState(null);
  const [pendingSubmission, setPendingSubmission] = useState(false);
  const [shouldNavigateAfterSubmit, setShouldNavigateAfterSubmit] = useState(false);


  const [coverageGroups, setCoverageGroups] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentEditMember, setCurrentEditMember] = useState(null);
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

  const [selectedCode, setSelectedCode] = useState({
    telefono_1: "us",
    telefono_2: "us"
  });

  useEffect(() => {
    const totalMiembros = coverageGroups.reduce((sum, group) =>
      sum + group.members.filter(m => m.activo === true && !m.fecha_retiro).length,
      0
    );
        const totalYes = coverageGroups.reduce((sum, group) =>
      sum + group.members.filter(m => m.estado_cobertura === "Yes").length
      , 0);

    setConteoMiembros(totalMiembros);
    setConteoCoberturaYes(totalYes);
  }, [coverageGroups]);

  useEffect(() => {
    const miembros = coverageGroups.reduce((sum, group) =>
      sum + group.members.filter(m => m.activo === true && !m.fecha_retiro).length, 0
    );
    const conYes = coverageGroups.reduce((sum, group) =>
      sum + group.members.filter(m => m.estado_cobertura === "Yes" && m.activo === true && !m.fecha_retiro).length, 0
    );
  
    setTotalMiembros(miembros);
    setTotalYes(conYes);
  }, [coverageGroups]);
  
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

  const handleCountryCodeChange = (name, isoCode) => {
    setSelectedCode((prev) => ({
      ...prev,
      [name]: isoCode
    }));
  };

  const initializeEditData = (initialData) => {
    if (!initialData) return;

    // Inicializar los datos principales
    setPolicyData(prev => ({
      ...prev,
      personas_en_taxes: initialData.personas_taxes || "",
      personas_cobertura: initialData.personas_cobertura || "",
      ingreso_familiar: initialData.ingreso_familiar_anual || 0,
      persona_contacto: initialData.persona_contacto || "",
      relacion: initialData.relacion || "",
      telefono_1: initialData.telefonos?.telefono_1?.replace(/^\+\d{1,4}/, "") || "",
      telefono_2: initialData.telefonos?.telefono_2?.replace(/^\+\d{1,4}/, "") || "",
      notas_telefonos: initialData.nota || "",
      pertenece_grupo_familiar: initialData.pertenece_grupo_familiar || false,
      captado_por: initialData.captado_por || "",
      referido: initialData.cual || "",
      responsable: initialData.responsable || ""
    }));

    // Inicializar codigos de país
    if (initialData.cod_tel_1) {
      const codeObj = countryCodes.find(c => c.code === initialData.cod_tel_1);
      if (codeObj) setSelectedCode(prev => ({ ...prev, telefono_1: codeObj.iso }));
    }
    if (initialData.cod_tel_2) {
      const codeObj = countryCodes.find(c => c.code === initialData.cod_tel_2);
      if (codeObj) setSelectedCode(prev => ({ ...prev, telefono_2: codeObj.iso }));
    }

    // Inicializar medios de contacto
    setContactMethods({
      whatsapp: initialData.telefonos?.whatsapp || false,
      telegram: initialData.telefonos?.telegram || false,
      texto_sms: initialData.telefonos?.mensaje_sms || false
    });

    // Inicializar coverageGroups
    if (initialData.coberturas && Array.isArray(initialData.coberturas)) {
      const groups = transformarCoberturasAcoverageGroups(initialData.coberturas);
      if (groups.length > 0) {
        setCoverageGroups(groups);
      } else {
        // Si por alguna razón no hay coberturas, crear un grupo vacío
        setCoverageGroups([{
          id: 1,
          tipoProducto: "SEGURO MEDICO OBAMA",
          policyData: { ...INITIAL_POLICY_STATE },
          members: []
        }]);
      }
    }
  };

  useEffect(() => {
    if (mode === "edit" && initialData) {
      initializeEditData(initialData);
    }
  }, [mode, initialData]);


  const copiarDatosDelPrimero = (groupId, indexDestino) => {
    const grupo = coverageGroups.find(g => g.id === groupId);
    const miembroModelo = grupo.members[0]; // Siempre el primer miembro
    const miembroDestino = grupo.members[indexDestino];

    const camposACopiar = [
      'ano_cobertura',
      'plan',
      'elegibilidad',
      'red',
      'compania_id',
      'metal',
      'fecha_activacion'
    ];
    const updatedGroups = coverageGroups.map(group => {
      if (group.id !== groupId) return group;

      return {
        ...group,
        members: group.members.map((member, idx) => {
          if (idx !== indexDestino) return member;

          let nuevosDatos = { ...member };
          camposACopiar.forEach(campo => {
            nuevosDatos[campo] = miembroModelo[campo];
          });

          return nuevosDatos;
        })
      };
    });

    setCoverageGroups(updatedGroups);

    setAlert({
      type: "success",
      message: "Los datos del primer miembro fueron copiados exitosamente.",
      visible: true
    });

    setTimeout(() => {
      setAlert({ type: "", message: "", visible: false });
    }, 3000);
  };


  const getCountryCode = (iso) => {
    const country = countryCodes.find((c) => c.iso === iso);
    return country ? country.code : "";
  };

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


  const transformarCoberturasAcoverageGroups = (coberturas) => {
    if (!Array.isArray(coberturas)) return [];

    const grupos = {};

    coberturas.forEach(cob => {
      if (!cob) return;

      const tipo = cob.cobertura_tipo || "SEGURO MEDICO OBAMA";
      if (!grupos[tipo]) {
        grupos[tipo] = {
          id: Object.keys(grupos).length + 1,
          cobertura_tipo: tipo,
          policyData: { ...INITIAL_POLICY_STATE },
          members: []
        };
      }

      const member = {
        cobertura_id: cob.id || null,
        id: cob.cliente?.id || `temp-${Math.random()}`,
        nombre: cob.cliente?.nombre_completo || "Sin nombre",
        ingreso_anual: parseFloat(cob.cliente?.ingreso_anual) || 0,
        compania_id: cob.compania?.id || null,
        estado_cobertura: cob.estado_cobertura || "No definido",
        fecha_activacion: cob.fecha_activacion || "",
        fecha_cancelacion: cob.fecha_cancelacion || "",
        fecha_retiro: cob.fecha_retiro || "",
        ano_cobertura: cob.ano_cobertura || new Date().getFullYear().toString(),
        plan: cob.plan || "",
        metal: cob.metal || "",
        elegibilidad: cob.elegibilidad || "",
        red: cob.red || "",
        precio: parseFloat(cob.precio) || 0,
        pagador_id: cob.pagador_id || "",
        codigo_poliza: cob.codigo_poliza || "",
        parentesco: cob.parentesco || "",
        vigencia: cob.fecha_cancelacion ? false : true,
        activo: cob.activo ?? true,
        dia_pago: cob.dia_pago || 1,
        tipo_pago: cob.tipo_pago || "",
        grupo: cob.grupo || "G1",
        nota_cancel:cob.nota_cancel || "",
      };

      grupos[tipo].members.push(member);
    });

    return Object.values(grupos);
  };

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

  const grupoColorMap = {
    G1: "#0d6efd",   // Azul Bootstrap
    G2: "#198754",   // Verde Bootstrap
    G3: "#ffc107"    // Amarillo Bootstrap
  };

  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, ""); // Eliminar caracteres no numéricos
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

    if (!match) return value; // Retorna el valor original si no hay coincidencias
    return [match[1], match[2], match[3]].filter(Boolean).join("-");
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const handlePolicyChange = (e) => {
    const { name, value } = e.target;

    // Aplicar formato de teléfono
    let updatedValue = value;
    if (["telefono_1", "telefono_2"].includes(name)) {
      updatedValue = formatPhoneNumber(value);
    }

    setPolicyData(prev => ({
      ...prev,
      [name]: updatedValue
    }));
  };

  const handleContactMethodChange = (e) => {
    const { name, checked } = e.target;
    setContactMethods(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleProductTypeChange = (groupId, newProductType) => {
    setCoverageGroups(prevGroups =>
      prevGroups.map(group =>
        group.id === groupId
          ? { ...group, tipoProducto: newProductType }
          : group
      )
    );
  };

  const addFamilyMember = async (client) => {
    if (!client || !client.id) return;
  
    try {
      const clientData = await apiRequest(`cliente/${client.id}`, "GET");
      const ingresoAnualCliente = parseFloat(clientData.ingreso_anual || 0);
  
      const totalPermitido = parseInt(policyData.personas_cobertura || "0", 10);
  
      const totalActual = coverageGroups.reduce(
        (sum, group) =>
          sum + group.members.filter(m => m.activo === true && !m.fecha_retiro).length,
        0
      );
  
      // ❌ Verificar si ya existe una cobertura activa para el mismo cliente
      const yaExisteActivoSinRetiro = coverageGroups.some(group =>
        group.members.some(member =>
          (member.cliente_id === client.id || member.id === client.id) &&
          member.activo === true &&
          !member.fecha_retiro &&
          !member.fecha_cancelacion
        )
      );
  
      if (yaExisteActivoSinRetiro) {
        setAlert({
          type: "warning",
          message: `El cliente "${clientData.nombre_completo}" ya está agregado con una cobertura activa.`,
          visible: true
        });
        setTimeout(() => setAlert({ type: "", message: "", visible: false }), 3000);
        return;
      }
  
   
  
      // ✅ Agregar nuevo miembro al primer grupo
      setCoverageGroups(prevGroups => {
        const updatedGroups = prevGroups.map((group, index) => {
          if (index === 0) {
            return {
              ...group,
              members: [
                ...group.members,
                {
                  cobertura_id: null,
                  id: `${client.id}-nuevo-${Date.now()}`, // ID temporal único
                  cliente_id: client.id,
                  nombre: clientData.nombre_completo,
                  ingreso_anual: ingresoAnualCliente,
                  parentesco: "",
                  fecha_activacion: new Date().toISOString().split("T")[0],
                  fecha_cancelacion: "",
                  fecha_retiro: "", // ⚠️ Muy importante: nueva cobertura no retirada
                  compania_id: "",
                  codigo_poliza: "",
                  plan: "",
                  metal: "",
                  red: "",
                  precio: 0,
                  estado_cobertura: "",
                  elegibilidad: "",
                  ano_cobertura: new Date().getFullYear().toString(),
                  activo: true,      // ✅ Activo por defecto
                  grupo: "G1",
                  pagador_id: "",
                  tipo_pago: "",
                  dia_pago: 1,
                  nota_cancel: ""
                }
              ]
            };
          }
          return group;
        });
  
        recalculateTotalIncome(updatedGroups);
        return updatedGroups;
      });
  
      setShowModal(false);
      setAlert({
        type: "success",
        message: `Cliente "${clientData.nombre_completo}" agregado correctamente.`,
        visible: true
      });
  
      setTimeout(() => setAlert({ type: "", message: "", visible: false }), 3000);
    } catch (error) {
      console.error("Error al agregar cliente:", error);
      setAlert({
        type: "danger",
        message: "Error al traer información del cliente.",
        visible: true
      });
      setTimeout(() => setAlert({ type: "", message: "", visible: false }), 3000);
    }
  };
  


  const recalculateTotalIncome = (groups) => {
    const total = groups.reduce((sum, group) =>
      sum + group.members.reduce((gSum, m) => gSum + (parseFloat(m.ingreso_anual) || 0), 0)
      , 0);

    setPolicyData((prev) => ({ ...prev, ingreso_familiar: total }));
  };


  useEffect(() => {
    if (currentStep === 2) {
      const total = coverageGroups.reduce((sum, group) =>
        sum + group.members.reduce((gSum, m) => gSum + (parseFloat(m.ingreso_anual) || 0), 0)
        , 0);
      if (mode === "edit" && total === 0 && initialData) {
        // No actualizar, mantener el valor original
        console.log("Manteniendo ingreso familiar original:", initialData.ingreso_familiar_anual);
      } else {
        // Actualizar al nuevo valor calculado
        setPolicyData(prev => ({ ...prev, ingreso_familiar: total }));
        console.log("Actualizando ingreso familiar a:", total);
      }
    }
  }, [coverageGroups, currentStep, mode, initialData]);

  const handleClienteCreated = async (newClient) => {
    if (newClient && newClient.id) {
      addFamilyMember(newClient);
      console.log("Cliente agregado a la tabla en GrupoFamiliar.");
    }
  };

  const handleClienteExistenteSeleccionado = async (cliente) => {
    try {
      const clientData = await apiRequest(`cliente/show/${cliente.id}`, "GET");



      if (!clientData || !clientData.id) throw new Error("Cliente no encontrado");

      // Llama a la lógica de agregar al grupo, que ya valida duplicados
      addFamilyMember(clientData);

      console.log("Cliente existente agregado a la tabla en GrupoFamiliar.");
    } catch (error) {
      console.error("Error al traer información del cliente:", error);
      setAlert({
        type: "danger",
        message: "Error al traer información del cliente.",
        visible: true
      });
      setTimeout(() => setAlert({ type: "", message: "", visible: false }), 3000);
    }
  };




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
      // Hacer copia profunda de los objetos de los miembros (evita referencias compartidas)
      const newMembers = coverageGroups[0].members.map(member => ({
        ...JSON.parse(JSON.stringify(member)), // copia profunda segura
        parentesco: "",
        fecha_activacion: "",
        fecha_cancelacion: "",
        compania_id: "",
        plan: "",
        metal: "",
        elegibilidad: "",
        estado_cobertura: "",
        codigo_poliza: "",
        precio: "",
        red: "",
        ano_cobertura: "",
        pagador_id: ""
      }));

    }

    const newGroup = {
      id: coverageGroups.length + 1,
      cobertura_tipo: "SEGURO MEDICO  OBAMA",
      policyData: { ...INITIAL_POLICY_STATE },
      members: newMembers
    };

    setCoverageGroups([...coverageGroups, newGroup]);
  };


  const removeMemberFromGroup = async (groupId, memberId) => {
    try {
      const group = coverageGroups.find(g => g.id === groupId);
      if (!group) throw new Error("Grupo no encontrado");

      const member = group.members.find(m => m.id === memberId);
      if (!member) throw new Error("Miembro no encontrado");

      if (!member.cobertura_id) {
        // Solo frontend
        const updatedGroups = coverageGroups.map((group) =>
          group.id === groupId
            ? { ...group, members: group.members.filter((m) => m.id !== memberId) }
            : group
        );
        setCoverageGroups(updatedGroups);
        recalculateTotalIncome(updatedGroups);
        return;
      }

      const response = await GrupoFamiliarService.deleteCobertura(member.cobertura_id);


      // Verificar si la respuesta tiene message
      if (response && response.message) {
        // Eliminación exitosa
        const updatedGroups = coverageGroups.map((group) =>
          group.id === groupId
            ? { ...group, members: group.members.filter((m) => m.id !== memberId) }
            : group
        );
        setCoverageGroups(updatedGroups);
        recalculateTotalIncome(updatedGroups);

        setAlert({
          type: "success",
          message: "Cobertura eliminada correctamente.",
          visible: true,
        });
        setTimeout(() => setAlert({ type: "", message: "", visible: false }), 3000);
      } else {
        throw new Error("La eliminación no fue confirmada por el servidor.");
      }


    } catch (error) {
      console.error("Error al eliminar cobertura:", error);
      setAlert({
        type: "danger",
        message: `Error al eliminar cobertura: ${error.message}`,
        visible: true,
      });
    }
  };



  const updateMemberData = (groupId, memberId, field, value) => {
    setCoverageGroups((prevGroups) => {
      const updatedGroups = prevGroups.map((group) =>
        group.id === groupId
          ? {
            ...group,
            members: group.members.map((member) => {
              if (member.id === memberId) {
                const updatedMember = { ...member, [field]: value };

                // Si se está actualizando fecha_cancelacion, actualizamos el campo "vigencia"
                if (field === "fecha_cancelacion") {
                  updatedMember.vigencia = !value; // Si tiene fecha de cancelación, desactivamos
                }

                return updatedMember;
              }
              return member;
            }),
          }
          : group
      );

      // Después de actualizar recalculamos el ingreso familiar
      const total = updatedGroups.reduce((sum, group) =>
        sum + group.members.reduce((gSum, m) => gSum + (parseFloat(m.ingreso_anual) || 0), 0)
        , 0);

      setPolicyData((prev) => ({ ...prev, ingreso_familiar: total }));

      return updatedGroups;
    });
  };




  const openEditModal = (groupId, memberId) => {
    const group = coverageGroups.find(g => g.id === groupId);
    if (!group) return;

    const member = group.members.find(m => m.id === memberId);
    if (!member) return;

    setCurrentEditMember({ ...member, groupId });
    setShowEditModal(true);
  };
  const saveEditChanges = () => {
    if (!currentEditMember) return;

    // Verificar si el campo está vacío o inválido
    const precioCrudo = currentEditMember.precio?.toString().replace(/[^0-9.]/g, '') || "0";
    const parsedPrecio = parseFloat(precioCrudo);

    // Actualizar el grupo con el valor de precio corregido
    setCoverageGroups(prevGroups =>
      prevGroups.map(group =>
        group.id === currentEditMember.groupId
          ? {
              ...group,
              members: group.members.map(member =>
                member.id === currentEditMember.id
                  ? {
                      ...member,
                      ...currentEditMember,
                      precio: isNaN(parsedPrecio) ? 0 : parsedPrecio,
                      activo: currentEditMember.activo || false
                    }
                  : member
              )
            }
          : group
      )
    );
    

    setShowEditModal(false);
    setCurrentEditMember(null);
  };



  useEffect(() => {
    const conYes = coverageGroups.reduce(
      (sum, group) => sum + group.members.filter(m => m.estado_cobertura === "Yes").length,
      0
    );
    console.log("✔️ Total con cobertura 'Yes':", conYes);
    setTotalYes(conYes);
  }, [coverageGroups]);



  const getCompanyName = (companyId) => {
    if (!companyId) return "Sin compañía";

    // Asegurar que estamos comparando el mismo tipo de datos
    const company = availableCompanies.find(c => String(c.id) === String(companyId));

    return company ? company.nombre : "Compañía desconocida";
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!policyData.personas_en_taxes || !policyData.personas_cobertura) {
        setAlert({
          type: "danger",
          message: "Debe ingresar el número de Personas en Taxes y Personas en Cobertura.",
          visible: true
        });

        // Ocultar automáticamente a los 10 segundos
        setTimeout(() => {
          setAlert({ type: "", message: "", visible: false });
        }, 10000);

        return;
      }
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };



  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Función para abrir el modal y resetear a la pestaña por defecto
  const handleOpenModal = () => {
    setActiveTab("nuevo"); // Reset a la pestaña por defecto
    setShowModal(true);
  };

  const obtenerClienteTomador = () => {
    for (const group of coverageGroups) {
      const tomador = group.members.find(m => m.parentesco === "TOMADOR");
      if (tomador) return tomador.cliente_id;
    }
    return null;
  };
  


  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    e.preventDefault();
    setAlert({ type: "", message: "", visible: false });

    try {
      let ingresoFamiliarFinal = policyData.ingreso_familiar;

      // Modo edición: recalcular ingreso familiar si cambia
      if (mode === "edit" && currentStep === 2) {
        const calculatedIncome = coverageGroups.reduce((sum, group) =>
          sum + group.members.reduce((gSum, m) => gSum + (parseFloat(m.ingreso_anual) || 0), 0)
          , 0);

        ingresoFamiliarFinal = calculatedIncome > 0 ? calculatedIncome : initialData.ingreso_familiar_anual;
      }

      // Datos del grupo familiar
      const grupoFamiliarData = {
        personas_taxes: policyData.personas_en_taxes,
        personas_cobertura: policyData.personas_cobertura,
        relacion: policyData.relacion,
        ingreso_familiar_anual: ingresoFamiliarFinal,
        persona_contacto: policyData.persona_contacto,
        pertenece_grupo_familiar: policyData.pertenece_grupo_familiar,
        telefonos: {
          telefono_1: policyData.telefono_1 ? policyData.telefono_1.replace(/\D/g, "") : null,
          telefono_2: policyData.telefono_2 ? policyData.telefono_2.replace(/\D/g, "") : null,
          whatsapp: contactMethods.whatsapp,
          telegram: contactMethods.telegram,
          mensaje_sms: contactMethods.texto_sms
        },
        cod_tel_1: getCountryCode(selectedCode.telefono_1),
        cod_tel_2: getCountryCode(selectedCode.telefono_2),
        nota: policyData.notas_telefonos,
        captado_por: policyData.captado_por || "",
        cual: policyData.referido || "",
        responsable: policyData.responsable || ""
      };

      let grupoFamiliarResponse;
      if (mode === "edit") {
        const payload = {
          ...grupoFamiliarData,
          coberturas: coverageGroups.flatMap(group =>
            group.members.map(member => ({
             
              id: member.cobertura_id || null,
              codigo_poliza: member.codigo_poliza || "",
              parentesco: member.parentesco || "",
              fecha_activacion: member.fecha_activacion || "",
              fecha_cancelacion: member.fecha_cancelacion || "",
              fecha_retiro: member.fecha_retiro || "",
              ano_cobertura: member.ano_cobertura || new Date().getFullYear().toString(),
              compania_id: member.compania_id || null,
              plan: member.plan || "",
              metal: member.metal || "",
              red: member.red || "",
              precio: member.precio || 0,
              elegibilidad: member.elegibilidad || "",
              estado_cobertura: member.estado_cobertura || "",
              pagador_id: member.pagador_id || "",
              cliente_id: member.cliente_id || member.id,
              cobertura_tipo: group.cobertura_tipo,
              vigencia: member.vigencia,
              activo: member.activo ?? true,
              dia_pago: member.dia_pago || 1,
              tipo_pago: member.tipo_pago || "",
              grupo: member.grupo || "G1",
              nota_cancel: member.nota_cancel || "",

            }))
          )
        };


        grupoFamiliarResponse = await GrupoFamiliarService.fullUpdate(id, payload);
      } else {
        // CREACIÓN DEL GRUPO
        grupoFamiliarResponse = await GrupoFamiliarService.create(grupoFamiliarData);

        const grupoFamiliarId = grupoFamiliarResponse.data?.id;
        if (grupoFamiliarId) {
          await GrupoFamiliarService.saveCoberturas(grupoFamiliarId, coverageGroups);

          const clienteTomadorId = obtenerClienteTomador();

          setBitacoraData({
            accion: "create",
            entity_type: "grupo_familiar",
            grupo_familiar_id: grupoFamiliarId,
            cliente_id: clienteTomadorId || null

          });

          setShowBitacoraModal(true);
         
          return; // Muy importante para evitar navegación automática
          
        }

      }

      console.log("✅ Grupo familiar procesado correctamente:", grupoFamiliarResponse);


      if (mode === "edit") {
        setBitacoraData({
          accion: "update",
          entity_type: "grupo_familiar",
          grupo_familiar_id: id,
          cliente_id: obtenerClienteTomador() || null

        });
        setShowBitacoraModal(true);
        return; // ⬅️ Evita la navegación automática
      }


      if (mode !== "edit") {
        setPolicyData(INITIAL_POLICY_STATE);
        setCoverageGroups([{
          id: 1,
          tipoProducto: "SEGURO MEDICO  OBAMA",
          policyData: { ...INITIAL_POLICY_STATE },
          members: []
        }]);
      }

    } catch (error) {
      console.error("❌ Error en handleSubmit:", error);
      setAlert({
        type: "danger",
        message: `Error al guardar: ${error.message || "Ocurrió un error inesperado"}`,
        visible: true
      });
    }
  };





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
              className={`d-flex align-items-center justify-content-center rounded-circle mx-auto mb-2 ${step <= currentStep ? 'bg-primary text-white' : 'bg-light'
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
  const companyColorMap = {
    "AMBETER": "#FF99FF",
    "BCBS TEXAS": "#89CFF0",
    "BRIGHT HEALTH": "#9EFF00",
    "FLORIDA BLUE": "#6FCFFF"

  };

  const metalColorMap = {
    "BRONCE": "#CD7F32",   // Bronce
    "SILVER": "#C0C0C0",   // Plata
    "GOLD": "#FFD700"      // Oro
  };


  const getCompanyColor = (compania_id) => {
    const name = getCompanyName(compania_id);
    return companyColorMap[name] || "#d3d3d3"; // Gris claro por defecto
  };

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


                      readOnly
                      className="bg-light"
                    />
                  </Form.Group>
                </Col>
              </Row>

              <h4 className="mt-4 mb-3 text-primary">Datos de Contacto</h4>
              <hr />

              <Row className="mb-4">
                <Col md={2}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Persona Contacto</Form.Label>
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
                    <Form.Label className="fw-medium" title="Seleccione la relacion entre la persona de contacto y el grupo familiar">
                      Relación
                    </Form.Label>
                    <Form.Select name="relacion" value={policyData.relacion} onChange={handlePolicyChange}>
                      <option value="">Seleccione</option>
                      <option value="CONYUGE">CONYUGE</option>
                      <option value="HIJO">HIJO</option>
                      <option value="HERMANO">HERMANO</option>
                      <option value="PADRE">PADRE</option>
                      <option value="MADRE">MADRE</option>
                      <option value="NIETO/A">NIETO/A</option>
                      <option value="ABUELO/A">ABUELO/A</option>
                      <option value="SUEGRO/A">SUEGRO/A</option>
                      <option value="TIO/A">TIO/A</option>
                      <option value="SOBRINO/A">SOBRINO/A</option>
                      <option value="AMIGO">AMIGO</option>
                    </Form.Select>
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
                    <div className="input-group">
                      <span className="input-group-text p-0">
                        <CountrySelectWithFlags
                          name="telefono_1"
                          selectedCode={selectedCode.telefono_1}
                          onChange={handleCountryCodeChange}
                        />
                      </span>
                      <Form.Control
                        type="text"
                        name="telefono_1"
                        value={policyData.telefono_1}
                        onChange={handlePolicyChange}
                      />
                    </div>
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Teléfono 2</Form.Label>
                    <div className="input-group">
                      <span className="input-group-text p-0">
                        <CountrySelectWithFlags
                          name="telefono_2"
                          selectedCode={selectedCode.telefono_2}
                          onChange={handleCountryCodeChange}
                        />
                      </span>
                      <Form.Control
                        type="text"
                        name="telefono_2"
                        value={policyData.telefono_2}
                        onChange={handlePolicyChange}
                      />
                    </div>
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-4">
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-medium">Nota</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      name="notas_telefonos"
                      value={policyData.notas_telefonos}
                      onChange={handlePolicyChange}
                      placeholder="Ingrese sus notas aquí..."
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
                    <Form.Select name="captado_por" value={policyData.captado_por} onChange={handlePolicyChange}>
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
                    <Form.Label className="fw-medium">Asesor</Form.Label>
                    <Form.Control
                      type="text"
                      name="responsable"
                      value={policyData.responsable}
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
              <div className="mb-4">




              </div>

              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="mb-0 text-primary">Personas del Grupo Familiar</h4>
                <Button
                  variant="primary"
                  onClick={handleOpenModal}
                  disabled={totalMiembros >= parseInt(policyData.personas_en_taxes || "0", 10)}
                >
                  <i className="bi bi-plus-circle me-2"></i>Agregar Miembro
                </Button>


              </div>
              <hr />

              {coverageGroups.map((group) => (
                <Accordion key={group.id} className="mb-4" defaultActiveKey="0">
                  <Accordion.Item eventKey="0">
                    <Accordion.Header>
                      <div className="d-flex align-items-center">
                        <span className="me-2">Cobertura {group.id}:</span>
                        <Form.Select
                          style={{ width: "auto", maxWidth: "300px", marginRight: "10px" }}
                          value={group.tipoProducto}
                          onChange={(e) => handleProductTypeChange(group.id, e.target.value)}
                          className="form-select-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {TIPOS_PRODUCTOS.map(producto => (
                            <option key={producto.id} value={producto.id}>
                              {producto.nombre}
                            </option>
                          ))}
                        </Form.Select>


                      </div>
                    </Accordion.Header>


                    <Accordion.Body>

                      <Row>
                        {group.members.filter(m => m.activo === true).length > 0 ? (
                          group.members
                            .filter(m => m.activo === true)
                            .map((member, index) => (
                              <Col key={member.id} lg={4} md={6} className="mb-3">
                                <Card

                                  className={`h-100 shadow-sm ${member.estado_cobertura !== "Yes" ? 'border-danger bg-light-subtle' : ''}`}>


                                  <Card.Header className="d-flex justify-content-between align-items-start bg-light flex-wrap">
                                    <div className="d-flex align-items-center flex-wrap gap-2">
                                      <Form.Select
                                        size="sm"
                                        value={member.grupo || "G1"}
                                        style={{
                                          backgroundColor: grupoColorMap[member.grupo || "G1"],
                                          color: "#fff",
                                          fontWeight: "bold",
                                          width: "55px",
                                          padding: "2px 8px"
                                        }}
                                        onChange={(e) => updateMemberData(group.id, member.id, "grupo", e.target.value)}
                                      >
                                        <option value="G1">G1</option>
                                        <option value="G2">G2</option>
                                        <option value="G3">G3</option>
                                      </Form.Select>
                                      <h6 className="mb-0 me-2">{member.nombre}</h6>
                                    </div>

                                    <Dropdown>
                                      <Dropdown.Toggle variant="outline-secondary" size="sm" id={`dropdown-${member.id}`}>
                                        <i className="bi bi-three-dots-vertical"></i>
                                      </Dropdown.Toggle>
                                      <Dropdown.Menu align="end">
                                        <Dropdown.Item onClick={() => openEditModal(group.id, member.id)}>
                                          <i className="bi bi-pencil me-2"></i> Editar
                                        </Dropdown.Item>
                                        {index > 0 && (
                                          <Dropdown.Item onClick={() => {
                                            Swal.fire({
                                              title: '¿Está seguro?',
                                              text: '¿Desea copiar la información del primer miembro a este miembro?',
                                              icon: 'question',
                                              showCancelButton: true,
                                              confirmButtonText: 'Sí, copiar',
                                              cancelButtonText: 'Cancelar',
                                              customClass: {
                                                confirmButton: 'btn btn-success me-2',
                                                cancelButton: 'btn btn-secondary',
                                                actions: 'd-flex justify-content-center gap-2'
                                              },
                                              buttonsStyling: false
                                            }).then((result) => {
                                              if (result.isConfirmed) {
                                                copiarDatosDelPrimero(group.id, index);
                                              }
                                            });
                                          }}>
                                            <i className="bi bi-copy me-2"></i> Copiar datos
                                          </Dropdown.Item>
                                        )}
                                      </Dropdown.Menu>
                                    </Dropdown>
                                  </Card.Header>

                                  <Card.Body>
                                    <div className="mb-3">
                                      <Form.Group className="mb-2">
                                        <Form.Label className="small text-muted mb-1">ID Póliza</Form.Label>
                                        <Form.Control
                                          size="sm"
                                          type="text"
                                          value={member.codigo_poliza || ""}
                                          onChange={(e) => updateMemberData(group.id, member.id, "codigo_poliza", e.target.value)}
                                          placeholder="ID Póliza"
                                        />
                                      </Form.Group>

                                      <Form.Group className="mb-2">
                                        <Form.Label className="small text-muted mb-1">Parentesco</Form.Label>
                                        <Form.Select
                                          size="sm"
                                          value={member.parentesco || ""}
                                          onChange={(e) => {
                                            const selectedValue = e.target.value;
                                            updateMemberData(group.id, member.id, "parentesco", selectedValue);

                                          }}
                                        >
                                          <option value="">Seleccione</option>
                                          <option value="TOMADOR">TOMADOR</option>
                                          <option value="CONYUGE">CONYUGE</option>
                                          <option value="HIJO">HIJO</option>
                                          <option value="HERMANO">HERMANO</option>
                                          <option value="PADRE">PADRE</option>
                                          <option value="MADRE">MADRE</option>
                                          <option value="NIETO/A">NIETO/A</option>
                                          <option value="ABUELO/A">ABUELO/A</option>
                                          <option value="SUEGRO/A">SUEGRO/A</option>
                                          <option value="TIO/A">TIO/A</option>
                                          <option value="SOBRINO/A">SOBRINO/A</option>
                                          <option value="AMIGO">AMIGO</option>
                                        </Form.Select>
                                      </Form.Group>

                                      <Row className="mb-2">
                                        <Col xs={6}>
                                          <Form.Group>
                                            <Form.Label className="small text-muted mb-1">Activación</Form.Label>
                                            <Form.Control
                                              size="sm"
                                              type="date"
                                              value={member.fecha_activacion || ""}
                                              onChange={(e) => updateMemberData(group.id, member.id, "fecha_activacion", e.target.value)}
                                              disabled={member.estado_cobertura === "No"}
                                            />

                                          </Form.Group>
                                        </Col>
                                        <Col xs={6}>
                                          <Form.Group>
                                            <Form.Label className="small text-muted mb-1">Cancelación</Form.Label>
                                            <Form.Control
                                              size="sm"
                                              type="date"
                                              value={member.fecha_cancelacion || ""}
                                              onChange={(e) => updateMemberData(group.id, member.id, "fecha_cancelacion", e.target.value)}
                                              disabled
                                            />
                                          </Form.Group>
                                        </Col>
                                      </Row>
                                    </div>

                                    <Button
                                      variant="outline-primary"
                                      size="sm"
                                      className="w-100"
                                      onClick={() => openEditModal(group.id, member.id)}
                                    >
                                      <i className="bi bi-pencil-square me-1"></i> Editar detalles completos
                                    </Button>
                                  </Card.Body>
                                  <Card.Footer className="bg-white">
                                    <div className="d-flex justify-content-between align-items-center">
                                      <small className="text-muted d-flex align-items-center gap-2">
                                        <span
                                          style={{
                                            width: "12px",
                                            height: "12px",
                                            borderRadius: "50%",
                                            backgroundColor: getCompanyColor(member.compania_id),
                                            display: "inline-block"
                                          }}
                                        ></span>
                                        {member.compania_id ? getCompanyName(member.compania_id) : "Sin compañía"}
                                      </small>


                                      <span className="badge rounded-pill"
                                        style={{
                                          backgroundColor: metalColorMap[member.metal] || '#d3d3d3',
                                          color: 'black'
                                        }}>
                                        {member.metal || "Sin metal"}
                                      </span>

                                    </div>

                                    {/* NUEVO BLOQUE: Cobertura y Precio */}
                                    <div className="d-flex justify-content-between align-items-center mt-2 px-1">
                                      <span className="d-flex align-items-center gap-1">
                                        <span className="text-muted small fw-medium">Cobertura:</span>
                                        <span
                                          className={`badge rounded-pill text-white ${member.estado_cobertura === "Yes"
                                            ? "bg-success"
                                            : member.estado_cobertura === "No"
                                              ? "bg-secondary"
                                              : "bg-warning text-dark"
                                            }`}
                                        >
                                          {member.estado_cobertura || "No definido"}
                                        </span>
                                      </span>


                                      <span className="text-muted small">
                                        <strong>Precio:</strong> {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(member.precio || 0)}
                                      </span>
                                    </div>


                                  </Card.Footer>

                                </Card>
                              </Col>
                            ))
                        ) : (
                          <Col xs={12}>
                            <div className="text-center py-5 border rounded bg-light">
                              <p className="mb-0 text-muted">No hay miembros agregados.</p>


                            </div>
                          </Col>
                        )
                        }
                      </Row>
                    </Accordion.Body>
                  </Accordion.Item>
                </Accordion>
              ))}
              <div className="rounded shadow-sm border border-info bg-light p-3 mb-4">
                <Row className="text-center fw-medium small">
                  <Col md={6}>
                    <div className="text-info mb-2">Personas en Taxes</div>
                    <span>{totalMiembros} / {policyData.personas_en_taxes || 0}</span>
                  </Col>
                  <Col md={6}>
                    <div className="text-info mb-2">Personas con Cobertura</div>
                    <span>{totalYes} / {policyData.personas_cobertura || 0}</span>
                  </Col>
                </Row>
              </div>
              {/* <div className="mt-4">
                <Button variant="outline-primary" onClick={addCoverageGroup} className="d-flex align-items-center">
                  <i className="bi bi-plus-circle me-2"></i> Agregar nueva cobertura
                </Button>
              </div> */}
            </Card.Body>
          </Card>
        );
      default:
        return null;
    }
  };
  const isPolicyValid = () => {
    const enTaxes = parseInt(policyData.personas_en_taxes || "0", 10);
    const conCobertura = parseInt(policyData.personas_cobertura || "0", 10);

    return (
      enTaxes === totalMiembros &&
      conCobertura === totalYes
    );
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
          onClose={() => setAlert({ ...alert, visible: false })}
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
          <Button
            variant="success"
            className="ms-auto"
            onClick={handleSubmit}

            disabled={!isPolicyValid()}
          >
            <i className="bi bi-save me-2"></i>
            {mode === "edit" ? "Actualizar Grupo Familiar" : "Guardar Póliza de Grupo Familiar"}
          </Button>




        )}


        {showBitacoraModal && (
          <BitacoraModal
            show={showBitacoraModal}
            onHide={() => setShowBitacoraModal(false)}
            data={bitacoraData}
            onSaved={() => {
              setShowBitacoraModal(false);

              Swal.fire({
                title: "¡Actualización Exitosa!",
                text: "El grupo familiar ha sido actualizado.",
                icon: "success",
                confirmButtonText: "Aceptar",
                timer: 4000
              }).then(() => {
                navigate('/grupofamiliar/lista');
              });
            }}
          />
        )}



      </div>

      {/* Modal for adding client (nuevo o existente) */}
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
          <Nav variant="tabs" className="mb-4">
            <Nav.Item>
              <Nav.Link
                active={activeTab === "nuevo"}
                onClick={() => setActiveTab("nuevo")}
                className={activeTab === "nuevo" ? "fw-bold" : ""}
              >
                <i className="bi bi-person-plus-fill me-2"></i>
                Nuevo Cliente
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                active={activeTab === "existente"}
                onClick={() => setActiveTab("existente")}
                className={activeTab === "existente" ? "fw-bold" : ""}
              >
                <i className="bi bi-search me-2"></i>
                Cliente Existente
              </Nav.Link>
            </Nav.Item>
          </Nav>

          {activeTab === "nuevo" ? (
            <Clientes onClienteCreado={handleClienteCreated} isModal={true} />
          ) : (
            <ClienteExistente onClienteSeleccionado={handleClienteExistenteSeleccionado} />
          )}
        </Modal.Body>
      </Modal>

      {/* Modal for editing member details */}
      <Modal
        show={showEditModal}
        onHide={() => { setShowEditModal(false); setCurrentEditMember(null); }}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            <i className="bi bi-pencil-square me-2"></i>
            Editar Miembro
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {currentEditMember && (
            <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="fw-semibold">
                  <Form.Label>ID Póliza</Form.Label>
                  <Form.Control
                    type="text"
                    value={currentEditMember.codigo_poliza || ""}
                    onChange={(e) => setCurrentEditMember({ ...currentEditMember, codigo_poliza: e.target.value })}
                  />
                </Form.Group>
              </Col>

                <Col md={6}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Fecha Activación</Form.Label>
                    <Form.Control
                      type="date"
                      value={currentEditMember.fecha_activacion || ""}
                      onChange={(e) => setCurrentEditMember({ ...currentEditMember, fecha_activacion: e.target.value })}
                      disabled={currentEditMember.estado_cobertura !== "Yes"}
                    />

                  </Form.Group>
                </Col>
            </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Año Cobertura</Form.Label>
                    <Form.Control
                      type="text"
                      value={currentEditMember.ano_cobertura || ""}
                      onChange={(e) => setCurrentEditMember({ ...currentEditMember, ano_cobertura: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Compañía</Form.Label>
                    <Form.Select
                      value={currentEditMember.compania_id || ""}
                      onChange={(e) => setCurrentEditMember({ ...currentEditMember, compania_id: e.target.value })}
                    >
                      <option value="">Seleccione</option>
                      {availableCompanies.map(company => (
                        <option key={company.id} value={company.id}>
                          {company.nombre}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Plan</Form.Label>
                    <Form.Control
                      type="text"
                      value={currentEditMember.plan || ""}
                      onChange={(e) => setCurrentEditMember({ ...currentEditMember, plan: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Metal</Form.Label>
                    <Form.Select
                      value={currentEditMember.metal || ""}
                      onChange={(e) =>
                        setCurrentEditMember({ ...currentEditMember, metal: e.target.value })
                      }
                    >
                      <option value="">Seleccione</option>
                      <option value="BRONCE">BRONCE</option>
                      <option value="SILVER">SILVER</option>
                      <option value="GOLD">GOLD</option>
                    </Form.Select>

                  </Form.Group>

                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Elegibilidad</Form.Label>
                    <Form.Control
                      type="text"
                      value={currentEditMember.elegibilidad || ""}
                      onChange={(e) => setCurrentEditMember({ ...currentEditMember, elegibilidad: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Cobertura</Form.Label>
                    <Form.Select
                      value={currentEditMember.estado_cobertura || ""}
                      onChange={(e) => {
                        const valor = e.target.value;
                        setCurrentEditMember(prev => ({
                          ...prev,
                          estado_cobertura: valor
                        }));
                      }}
                    >
                      <option value="">Seleccione</option>
                      {(currentEditMember.estado_cobertura === "Yes" || totalYes < parseInt(policyData.personas_cobertura || "0", 10)) && (
                        <option value="Yes">Yes</option>
                      )}
                      <option value="No">No</option>
                      <option value="MEDICARE">MEDICARE</option>
                      <option value="MEDICAID">MEDICAID</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={4}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Red</Form.Label>
                    <Form.Select
                      value={currentEditMember.red || ""}
                      onChange={(e) => setCurrentEditMember({ ...currentEditMember, red: e.target.value })}
                    >
                      <option value="">Seleccione</option>
                      <option value="HMO">HMO</option>
                      <option value="EPO">EPO</option>
                      <option value="PPO">PPO</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Pagador</Form.Label>
                    <Form.Select
                        value={currentEditMember.pagador_id || ""}
                        onChange={(e) => setCurrentEditMember({ ...currentEditMember, pagador_id: e.target.value })}
                      >
                        <option value="">Seleccione un pagador</option>
                        {Array.from(
                          new Map(
                            coverageGroups
                              .flatMap(group => group.members)
                              .filter(m => m.activo && m.cliente_id) // solo miembros activos con cliente
                              .map(member => [member.cliente_id, member]) // agrupar por cliente_id
                          ).values()
                        ).map(member => (
                          <option key={member.cliente_id} value={member.cliente_id}>
                            {member.nombre}
                          </option>
                        ))}
                      </Form.Select>


                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Precio</Form.Label>
                    <Form.Control
                      type="text"
                      value={currentEditMember.precio}
                      onChange={(e) => {
                        // Solo permite números y punto decimal
                        const raw = e.target.value.replace(/[^0-9.]/g, '');
                        setCurrentEditMember({
                          ...currentEditMember,
                          precio: raw
                        });
                      }}
                      onBlur={(e) => {
                        const number = parseFloat(currentEditMember.precio);
                        if (!isNaN(number)) {
                          const formatted = new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          }).format(number);
                          setCurrentEditMember({
                            ...currentEditMember,
                            precio: formatted
                          });
                        }
                      }}
                      onFocus={(e) => {

                        if (!currentEditMember?.precio) return; // 👈 Protección
                        const clean = currentEditMember.precio.replace(/[$,]/g, '');
                        setCurrentEditMember({
                          ...currentEditMember,
                          precio: clean
                        });
                      }}

                    />
                  </Form.Group>


                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Dia C/M</Form.Label>
                    <Form.Control
                      type="number"
                      value={currentEditMember.dia_pago || ""}
                      onChange={(e) => setCurrentEditMember({ ...currentEditMember, dia_pago: e.target.value })}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Tipo de pago</Form.Label>
                    <Form.Select
                      value={currentEditMember.tipo_pago || ""}
                      onChange={(e) => setCurrentEditMember({ ...currentEditMember, tipo_pago: e.target.value })}
                    >
                      <option value="">Seleccione</option>
                      <option value="DEBITO AUTOMATICO">DEBITO AUTOMATICO</option>
                      <option value="CTE PAGA">CTE PAGA</option>
                      <option value="MES A MES">MES A MES</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

              </Row>
              <Row>
              <Col md={4}>
                  <Form.Group className="fw-semibold">
                    <Form.Label>Fecha Cancelación</Form.Label>
                    <Form.Control
                          type="date"
                          value={currentEditMember.fecha_cancelacion || ""}
                          onChange={(e) => {
                            const cancelDate = e.target.value;
                            setCurrentEditMember(prev => ({
                              ...prev,
                              fecha_cancelacion: cancelDate,
                              vigencia: cancelDate ? false : true // Actualiza automáticamente vigencia
                            }));
                          }}
                        />

                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Fecha de Retiro</Form.Label>
                    <Form.Control
                        type="date"
                        value={currentEditMember.fecha_retiro || ""}
                        onChange={(e) => setCurrentEditMember({ ...currentEditMember, fecha_retiro: e.target.value })}
                        disabled={currentEditMember.activo}
                      />

                  </Form.Group>
                </Col>
                <Col md={4} className="d-flex align-items-center">
                <Form.Group className="mb-0">
                <Form.Check
                      type="checkbox"
                      label="Póliza activa para Taxes"
                      checked={currentEditMember.activo || false}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCurrentEditMember(prev => ({
                          ...prev,
                          activo: checked,
                          fecha_retiro: checked ? "" : prev.fecha_retiro,
                          nota_retiro: checked ? "" : prev.nota_retiro // Limpia si se activa
                        }));
                      }}
                    />


                </Form.Group>
              </Col>
              </Row>
              <Row>
              <Col md={12} className="mt-3">
                <Form.Group>
                  <Form.Label className="fw-semibold">Nota del Retiro</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={currentEditMember.nota_cancel || ""}
                    disabled={currentEditMember.activo} // ❌ Deshabilitado si está activo
                    onChange={(e) => setCurrentEditMember({ ...currentEditMember, nota_cancel: e.target.value })}
                    placeholder="Ingrese una nota si se retira al cliente"
                  />
                </Form.Group>
              </Col>

                              </Row>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowEditModal(false); setCurrentEditMember(null); }}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={saveEditChanges}>
            Guardar Cambios
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Grupofamiliar;



