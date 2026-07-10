import React, { useEffect, useState } from "react";
import { Modal, Table, Badge, Row, Col, Card, Spinner, Alert, Button, Form } from "react-bootstrap";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { FaTasks, FaClock, FaCheckCircle, FaUser, FaChartBar, FaChartPie, FaCalendarAlt, FaSearch } from "react-icons/fa";
import apiRequest from "../../services/api";

const ResumenTareasModal = ({ show, onHide, fecha, setFecha }) => {
  const [tareasPorUsuario, setTareasPorUsuario] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [tareasUsuarioDetalle, setTareasUsuarioDetalle] = useState([]);
  const [resumenGeneral, setResumenGeneral] = useState({ pending: 0, in_progress: 0, completed: 0, total: 0 });
  const [totalesDia, setTotalesDia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [error, setError] = useState("");
  const [ejecutado, setEjecutado] = useState(false);
  const [mesSeleccionado, setMesSeleccionado] = useState("");
  const [añoSeleccionado, setAñoSeleccionado] = useState("");

  // Función helper para convertir fecha a formato YYYY-MM-DD sin problemas de zona horaria
  const fechaALocalISO = (fecha) => {
    if (!fecha) return "";
    const d = new Date(fecha);
    const año = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${año}-${mes}-${dia}`;
  };

  const fechaObjetivo = fecha ? new Date(fecha) : new Date();
  const fechaISO = fechaALocalISO(fechaObjetivo);

  // Inicializar mes y año cuando se abre el modal
  useEffect(() => {
    if (show) {
      const fechaInicial = fecha || new Date();
      const mes = (fechaInicial.getMonth() + 1).toString().padStart(2, "0");
      const año = fechaInicial.getFullYear().toString();
      setMesSeleccionado(mes);
      setAñoSeleccionado(año);
      if (!fecha) {
        // Crear fecha usando mediodía para evitar problemas de zona horaria
        const hoy = new Date();
        const fechaLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12, 0, 0, 0);
        setFecha(fechaLocal);
      }
    }
  }, [show]);

  // Función para ejecutar la consulta
  const ejecutarConsulta = async () => {
    if (!fecha) {
      setError("Por favor seleccione una fecha.");
      return;
    }

    setLoading(true);
    setError("");
    setEjecutado(true);
    setUsuarioSeleccionado(null);
    setTareasUsuarioDetalle([]);

    try {
      const response = await apiRequest(`tareas_operativas/resumen-tareas?fecha=${fechaISO}`, "GET");
      
      // Mapear la respuesta del backend a la estructura esperada
      if (response?.detalle_por_usuario && Array.isArray(response.detalle_por_usuario)) {
        // Transformar detalle_por_usuario a la estructura esperada
        const datosMapeados = response.detalle_por_usuario.map((item) => ({
          usuario: {
            id: item.usuario?.id || item.usuario_id,
            name: item.usuario?.name || item.usuario_nombre,
            email: item.usuario?.email || null,
          },
          pending: item.resumen?.pending || 0,
          in_progress: item.resumen?.in_progress || 0,
          completed: item.resumen?.completed || 0,
          total: item.resumen?.total || 0,
          tareas: item.tareas || [], // Guardar tareas para el detalle
        }));
        
        setTareasPorUsuario(datosMapeados);
        
        // Guardar resumen general
        if (response.resumen) {
          setResumenGeneral({
            pending: response.resumen.pending || 0,
            in_progress: response.resumen.in_progress || 0,
            completed: response.resumen.completed || 0,
            total: response.resumen.total || 0,
          });
        }
        
        // Guardar totales del día para el gráfico de torta
        if (response.totales_dia && Array.isArray(response.totales_dia)) {
          setTotalesDia(response.totales_dia);
        }
      } else {
        // Fallback: si viene en formato antiguo
        const datos = Array.isArray(response) ? response : (response?.data || []);
        setTareasPorUsuario(datos);
        setResumenGeneral({ pending: 0, in_progress: 0, completed: 0, total: 0 });
        setTotalesDia([]);
      }
    } catch (error) {
      console.error("Error al obtener resumen de tareas:", error);
      setError("Error al cargar el resumen de tareas. Por favor intente nuevamente.");
      setTareasPorUsuario([]);
      setResumenGeneral({ pending: 0, in_progress: 0, completed: 0, total: 0 });
      setTotalesDia([]);
    } finally {
      setLoading(false);
    }
  };

  // Limpiar datos cuando se cierra el modal
  useEffect(() => {
    if (!show) {
      setEjecutado(false);
      setTareasPorUsuario([]);
      setUsuarioSeleccionado(null);
      setTareasUsuarioDetalle([]);
      setResumenGeneral({ pending: 0, in_progress: 0, completed: 0, total: 0 });
      setTotalesDia([]);
      setError("");
    }
  }, [show]);

  // 🔁 Cargar tareas detalladas del usuario seleccionado desde los datos ya cargados
  useEffect(() => {
    if (!usuarioSeleccionado || !ejecutado || tareasPorUsuario.length === 0) {
      setTareasUsuarioDetalle([]);
      return;
    }
    
    // Buscar las tareas del usuario seleccionado en los datos ya cargados
    const usuarioData = tareasPorUsuario.find(
      (item) => item.usuario?.id === usuarioSeleccionado.id
    );
    
    if (usuarioData && usuarioData.tareas) {
      setTareasUsuarioDetalle(usuarioData.tareas);
    } else {
      setTareasUsuarioDetalle([]);
    }
  }, [usuarioSeleccionado, ejecutado, tareasPorUsuario]);

  useEffect(() => {
    if (!fecha && show) {
      // Crear fecha usando mediodía para evitar problemas de zona horaria
      const hoy = new Date();
      const fechaLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12, 0, 0, 0);
      setFecha(fechaLocal);
    }
  }, [fecha, show, setFecha]);

  // Manejar cambio de mes
  const handleCambioMes = (nuevoMes) => {
    setMesSeleccionado(nuevoMes);
    const año = parseInt(añoSeleccionado || fechaObjetivo.getFullYear());
    const mes = parseInt(nuevoMes) - 1; // JavaScript usa meses 0-11
    const diaActual = fechaObjetivo.getDate();
    const diasEnMes = new Date(año, mes + 1, 0).getDate(); // Días en el nuevo mes
    const dia = Math.min(diaActual, diasEnMes); // Ajustar si el día actual no existe en el nuevo mes
    // Crear fecha usando hora local (sin UTC)
    const nuevaFecha = new Date(año, mes, dia, 12, 0, 0, 0); // Usar mediodía para evitar problemas de zona horaria
    setFecha(nuevaFecha);
    setEjecutado(false); // Resetear ejecutado para requerir nueva consulta
  };

  // Manejar cambio de año
  const handleCambioAño = (nuevoAño) => {
    setAñoSeleccionado(nuevoAño);
    const año = parseInt(nuevoAño);
    const mes = parseInt(mesSeleccionado || (fechaObjetivo.getMonth() + 1)) - 1; // JavaScript usa meses 0-11
    const diaActual = fechaObjetivo.getDate();
    const diasEnMes = new Date(año, mes + 1, 0).getDate(); // Días en el mes del nuevo año
    const dia = Math.min(diaActual, diasEnMes); // Ajustar si el día actual no existe en el nuevo mes
    // Crear fecha usando hora local (sin UTC)
    const nuevaFecha = new Date(año, mes, dia, 12, 0, 0, 0); // Usar mediodía para evitar problemas de zona horaria
    setFecha(nuevaFecha);
    setEjecutado(false); // Resetear ejecutado para requerir nueva consulta
  };

  // Manejar cambio de día
  const handleCambioDia = (nuevoDia) => {
    const año = parseInt(añoSeleccionado || fechaObjetivo.getFullYear());
    const mes = parseInt(mesSeleccionado || (fechaObjetivo.getMonth() + 1)) - 1; // JavaScript usa meses 0-11
    const dia = parseInt(nuevoDia);
    // Crear fecha usando hora local (sin UTC) - usar mediodía para evitar problemas de zona horaria
    const nuevaFecha = new Date(año, mes, dia, 12, 0, 0, 0);
    setFecha(nuevaFecha);
    setEjecutado(false); // Resetear ejecutado para requerir nueva consulta
  };

  const esMismaFecha = (fechaStr1, fechaStr2) => {
    return fechaALocalISO(new Date(fechaStr1)) === fechaALocalISO(new Date(fechaStr2));
  };
  
  const generarOpcionesMeses = () => {
    const meses = [
      { value: "01", label: "Enero" },
      { value: "02", label: "Febrero" },
      { value: "03", label: "Marzo" },
      { value: "04", label: "Abril" },
      { value: "05", label: "Mayo" },
      { value: "06", label: "Junio" },
      { value: "07", label: "Julio" },
      { value: "08", label: "Agosto" },
      { value: "09", label: "Septiembre" },
      { value: "10", label: "Octubre" },
      { value: "11", label: "Noviembre" },
      { value: "12", label: "Diciembre" },
    ];
    return meses.map((mes) => (
      <option key={mes.value} value={mes.value}>
        {mes.label}
      </option>
    ));
  };

  const generarOpcionesAños = () => {
    const añoActual = new Date().getFullYear();
    const años = [];
    for (let i = añoActual; i >= añoActual - 5; i--) {
      años.push(i);
    }
    return años.map((año) => (
      <option key={año} value={año}>
        {año}
      </option>
    ));
  };

  const generarOpcionesDias = () => {
    const año = parseInt(añoSeleccionado || fechaObjetivo.getFullYear());
    const mes = parseInt(mesSeleccionado || (fechaObjetivo.getMonth() + 1)) - 1;
    const diasEnMes = new Date(año, mes + 1, 0).getDate();

    return Array.from({ length: diasEnMes }, (_, i) => {
      const dia = i + 1;
      return (
        <option key={dia} value={dia}>
          {dia}
        </option>
      );
    });
  };

  // Asegurar que tareasPorUsuario siempre sea un array
  const tareasPorUsuarioArray = Array.isArray(tareasPorUsuario) ? tareasPorUsuario : [];

  const COLORS = ["#ffc107", "#0dcaf0", "#198754"];
  
  // Usar totalesDia del backend si está disponible, sino calcular desde tareasPorUsuario
  const datosTorta = totalesDia.length > 0
    ? totalesDia.map((item) => ({
        name: item.label || item.estado,
        value: item.valor || 0,
      }))
    : [
        { name: "Pendientes", value: resumenGeneral.pending || 0 },
        { name: "En Progreso", value: resumenGeneral.in_progress || 0 },
        { name: "Completadas", value: resumenGeneral.completed || 0 },
      ];

  // Usar resumenGeneral del backend si está disponible
  const totalPendientes = resumenGeneral.pending || tareasPorUsuarioArray.reduce((acc, u) => acc + (u.pending || 0), 0);
  const totalEnProgreso = resumenGeneral.in_progress || tareasPorUsuarioArray.reduce((acc, u) => acc + (u.in_progress || 0), 0);
  const totalCompletadas = resumenGeneral.completed || tareasPorUsuarioArray.reduce((acc, u) => acc + (u.completed || 0), 0);
  const totalGeneral = resumenGeneral.total || (totalPendientes + totalEnProgreso + totalCompletadas);

  const handleUsuarioClick = (usuario) => {
    setUsuarioSeleccionado(usuario);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "—";
    try {
      const d = new Date(fecha);
      if (isNaN(d.getTime())) return fecha;
      return d.toLocaleDateString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return fecha;
    }
  };

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      size="xl" 
      centered
      dialogClassName="modal-xl"
      style={{ maxWidth: "95vw", width: "95vw" }}
    >
      <Modal.Header closeButton className="bg-light border-bottom">
        <Modal.Title className="w-100">
          <div className="d-flex align-items-center gap-2 mb-2">
            <FaTasks className="text-primary" />
            <span className="fw-bold">Resumen de Tareas</span>
          </div>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="bg-light" style={{ maxHeight: "85vh", overflowY: "auto", padding: "1.5rem" }}>
        {/* Card de Filtros */}
        <Card className="mb-4 shadow-sm border-0" style={{ borderRadius: "12px" }}>
          <Card.Header className="bg-white border-bottom">
            <div className="d-flex align-items-center gap-2">
              <FaCalendarAlt className="text-primary" />
              <h6 className="mb-0 fw-semibold">Seleccionar Fecha</h6>
            </div>
          </Card.Header>
          <Card.Body>
            <Row className="g-3 align-items-end">
              <Col md={3} sm={6}>
                <Form.Label className="fw-semibold">Año</Form.Label>
                <Form.Select
                  value={añoSeleccionado || fechaObjetivo.getFullYear()}
                  onChange={(e) => handleCambioAño(e.target.value)}
                >
                  {generarOpcionesAños()}
                </Form.Select>
              </Col>
              <Col md={4} sm={6}>
                <Form.Label className="fw-semibold">Mes</Form.Label>
                <Form.Select
                  value={mesSeleccionado || (fechaObjetivo.getMonth() + 1).toString().padStart(2, "0")}
                  onChange={(e) => handleCambioMes(e.target.value)}
                >
                  {generarOpcionesMeses()}
                </Form.Select>
              </Col>
              <Col md={3} sm={6}>
                <Form.Label className="fw-semibold">Día</Form.Label>
                <Form.Select
                  value={fecha ? fechaObjetivo.getDate() : new Date().getDate()}
                  onChange={(e) => handleCambioDia(e.target.value)}
                >
                  {generarOpcionesDias()}
                </Form.Select>
              </Col>
              <Col md={2} sm={6}>
                <Button
                  variant="primary"
                  onClick={ejecutarConsulta}
                  disabled={loading || !fecha}
                  className="w-100"
                >
                  {loading ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      Cargando...
                    </>
                  ) : (
                    <>
                      <FaSearch className="me-2" />
                      Ejecutar
                    </>
                  )}
                </Button>
              </Col>
            </Row>
            {fecha && (
              <div className="mt-3">
                <Badge bg="info" className="px-3 py-2">
                  <FaCalendarAlt className="me-2" />
                  Fecha seleccionada: {formatearFecha(fecha)}
                </Badge>
              </div>
            )}
          </Card.Body>
        </Card>

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError("")} className="mb-3">
            <i className="fas fa-exclamation-triangle me-2"></i>
            {error}
          </Alert>
        )}

        {!ejecutado && !loading && (
          <Alert variant="info" className="mb-3">
            <i className="fas fa-info-circle me-2"></i>
            Seleccione una fecha y haga clic en "Ejecutar" para ver el resumen de tareas.
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Cargando resumen de tareas...</p>
          </div>
        ) : ejecutado ? (
          <>
            {/* Cards de Métricas Principales */}
            <Row className="mb-4 g-4">
              <Col md={3} sm={6}>
                <Card className="h-100 shadow-sm border-0" style={{ borderRadius: "12px" }}>
                  <Card.Body className="p-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <p className="text-muted mb-1 small fw-semibold">Pendientes</p>
                        <h3 className="mb-0 fw-bold text-warning">{totalPendientes}</h3>
                      </div>
                      <div
                        className="bg-warning bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: "50px", height: "50px" }}
                      >
                        <FaClock className="text-warning" size={20} />
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6}>
                <Card className="h-100 shadow-sm border-0" style={{ borderRadius: "12px" }}>
                  <Card.Body className="p-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <p className="text-muted mb-1 small fw-semibold">En Progreso</p>
                        <h3 className="mb-0 fw-bold text-info">{totalEnProgreso}</h3>
                      </div>
                      <div
                        className="bg-info bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: "50px", height: "50px" }}
                      >
                        <FaTasks className="text-info" size={20} />
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6}>
                <Card className="h-100 shadow-sm border-0" style={{ borderRadius: "12px" }}>
                  <Card.Body className="p-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <p className="text-muted mb-1 small fw-semibold">Completadas</p>
                        <h3 className="mb-0 fw-bold text-success">{totalCompletadas}</h3>
                      </div>
                      <div
                        className="bg-success bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: "50px", height: "50px" }}
                      >
                        <FaCheckCircle className="text-success" size={20} />
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6}>
                <Card className="h-100 shadow-sm border-0 bg-primary bg-opacity-10" style={{ borderRadius: "12px" }}>
                  <Card.Body className="p-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <p className="text-muted mb-1 small fw-semibold">Total</p>
                        <h3 className="mb-0 fw-bold text-primary">{totalGeneral}</h3>
                      </div>
                      <div
                        className="bg-primary bg-opacity-20 rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: "50px", height: "50px" }}
                      >
                        <FaTasks className="text-primary" size={20} />
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Gráficos */}
            <Row className="mb-4 g-4">
              <Col md={6}>
                <Card className="shadow-sm border-0 h-100" style={{ borderRadius: "12px" }}>
                  <Card.Header className="bg-white border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <FaChartBar className="text-primary" />
                      <h6 className="mb-0 fw-semibold">Distribución por Usuario</h6>
                    </div>
                  </Card.Header>
                  <Card.Body style={{ padding: "1.5rem" }}>
                    {tareasPorUsuarioArray.length > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={tareasPorUsuarioArray} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                          <XAxis 
                            dataKey="usuario.name" 
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            tick={{ fontSize: 13 }}
                            interval={0}
                          />
                          <YAxis tick={{ fontSize: 13 }} />
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: "8px",
                              border: "1px solid #e9ecef",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                              fontSize: "13px"
                            }}
                          />
                          <Legend 
                            wrapperStyle={{ paddingTop: "15px", fontSize: "13px" }} 
                            iconSize={14}
                          />
                          <Bar
                            dataKey="pending"
                            fill="#ffc107"
                            name="Pendientes"
                            cursor="pointer"
                            radius={[4, 4, 0, 0]}
                            onClick={(data) => handleUsuarioClick(data.payload.usuario)}
                          />
                          <Bar
                            dataKey="in_progress"
                            fill="#0dcaf0"
                            name="En Progreso"
                            cursor="pointer"
                            radius={[4, 4, 0, 0]}
                            onClick={(data) => handleUsuarioClick(data.payload.usuario)}
                          />
                          <Bar
                            dataKey="completed"
                            fill="#198754"
                            name="Completadas"
                            cursor="pointer"
                            radius={[4, 4, 0, 0]}
                            onClick={(data) => handleUsuarioClick(data.payload.usuario)}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-5 text-muted">
                        <FaChartBar size={40} className="mb-3 opacity-50" />
                        <p>No hay datos para mostrar</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="shadow-sm border-0 h-100" style={{ borderRadius: "12px" }}>
                  <Card.Header className="bg-white border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <FaChartPie className="text-primary" />
                      <h6 className="mb-0 fw-semibold">Totales del Día</h6>
                    </div>
                  </Card.Header>
                  <Card.Body style={{ padding: "1.5rem" }}>
                    {totalGeneral > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <PieChart>
                          <Pie 
                            data={datosTorta.filter(d => d.value > 0)} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="45%"
                            outerRadius={110}
                            innerRadius={50}
                            label={false}
                            paddingAngle={3}
                          >
                            {datosTorta.filter(d => d.value > 0).map((item, index) => {
                              const colorIndex = datosTorta.findIndex(d => d.name === item.name);
                              return <Cell key={index} fill={COLORS[colorIndex >= 0 ? colorIndex : index]} />;
                            })}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: "8px",
                              border: "1px solid #e9ecef",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                              fontSize: "13px"
                            }}
                            formatter={(value, name) => [`${value}`, name]}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={80}
                            iconType="circle"
                            wrapperStyle={{ fontSize: "13px", paddingTop: "20px" }}
                            formatter={(value) => {
                              const data = datosTorta.find(d => d.name === value);
                              if (!data || data.value === 0) return '';
                              const percent = totalGeneral > 0 ? ((data.value / totalGeneral) * 100).toFixed(0) : 0;
                              return `${value}: ${data.value} (${percent}%)`;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-5 text-muted">
                        <FaChartPie size={40} className="mb-3 opacity-50" />
                        <p>No hay datos para mostrar</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Tabla de Detalle por Usuario */}
            <Card className="shadow-sm border-0 mb-4" style={{ borderRadius: "12px" }}>
              <Card.Header className="bg-white border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <FaUser className="text-primary" />
                  <h6 className="mb-0 fw-semibold">Detalle por Usuario</h6>
                  {tareasPorUsuarioArray.length > 0 && (
                    <Badge bg="secondary" className="ms-2">
                      {tareasPorUsuarioArray.length} {tareasPorUsuarioArray.length === 1 ? "usuario" : "usuarios"}
                    </Badge>
                  )}
                </div>
              </Card.Header>
              <Card.Body className="p-0" style={{ padding: "0.5rem" }}>
                {tareasPorUsuarioArray.length > 0 ? (
                  <div className="table-responsive">
                    <Table hover className="mb-0" style={{ fontSize: "14px" }}>
                      <thead className="table-light">
                        <tr>
                          <th className="ps-3" style={{ minWidth: "200px" }}>
                            <FaUser className="me-2" />
                            Usuario
                          </th>
                          <th className="text-center" style={{ minWidth: "120px" }}>
                            <Badge bg="warning" className="w-100">Pendientes</Badge>
                          </th>
                          <th className="text-center" style={{ minWidth: "140px" }}>
                            <Badge bg="info" className="w-100">En Progreso</Badge>
                          </th>
                          <th className="text-center" style={{ minWidth: "130px" }}>
                            <Badge bg="success" className="w-100">Completadas</Badge>
                          </th>
                          <th className="text-center pe-3" style={{ minWidth: "100px" }}>
                            <strong>Total</strong>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tareasPorUsuarioArray.map((u) => (
                          <tr
                            key={u.usuario.id}
                            style={{ 
                              cursor: "pointer",
                              transition: "background-color 0.2s"
                            }}
                            onClick={() => handleUsuarioClick(u.usuario)}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ""}
                            className={usuarioSeleccionado?.id === u.usuario.id ? "table-primary" : ""}
                          >
                            <td className="ps-3 fw-semibold">{u.usuario.name}</td>
                            <td className="text-center">
                              <Badge bg="warning" className="px-3 py-2">{u.pending}</Badge>
                            </td>
                            <td className="text-center">
                              <Badge bg="info" className="px-3 py-2">{u.in_progress}</Badge>
                            </td>
                            <td className="text-center">
                              <Badge bg="success" className="px-3 py-2">{u.completed}</Badge>
                            </td>
                            <td className="text-center pe-3">
                              <strong className="text-primary">{u.total}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-5 text-muted">
                    <FaUser size={40} className="mb-3 opacity-50" />
                    <p>No hay usuarios con tareas en esta fecha</p>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Detalle de Tareas del Usuario Seleccionado */}
            {usuarioSeleccionado && (
              <Card className="shadow-sm border-primary" style={{ borderRadius: "12px", borderWidth: "2px" }}>
                <Card.Header className="bg-primary bg-opacity-10 border-bottom">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <FaUser className="text-primary" />
                      <h6 className="mb-0 fw-semibold">
                        Tareas de <span className="text-primary">{usuarioSeleccionado.name}</span>
                      </h6>
                    </div>
                    <Badge bg="primary">
                      {tareasUsuarioDetalle.length} {tareasUsuarioDetalle.length === 1 ? "tarea" : "tareas"}
                    </Badge>
                  </div>
                </Card.Header>
                <Card.Body className="p-0">
                  {tareasUsuarioDetalle.length > 0 ? (
                    <div className="table-responsive">
                      <Table hover className="mb-0" style={{ fontSize: "14px" }}>
                        <thead className="table-light">
                          <tr>
                            <th className="ps-3" style={{ minWidth: "80px" }}>ID</th>
                            <th style={{ minWidth: "200px" }}>Concepto</th>
                            <th style={{ minWidth: "250px" }}>Cliente</th>
                            <th className="text-center" style={{ minWidth: "140px" }}>Estado</th>
                            <th className="pe-3" style={{ minWidth: "150px" }}>Fecha Programada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tareasUsuarioDetalle.map((t) => (
                            <tr key={t.id}>
                              <td className="ps-3">
                                <strong className="text-primary">#{t.id}</strong>
                              </td>
                              <td>
                                <div style={{ maxWidth: "200px", wordWrap: "break-word" }}>
                                  {t.concepto || "Sin concepto"}
                                </div>
                              </td>
                              <td>
                                <div>
                                  <strong>{t.cliente?.nombre_completo || "Sin cliente"}</strong>
                                  {t.cliente?.id && (
                                    <div className="small text-muted">ID: {t.cliente.id}</div>
                                  )}
                                </div>
                              </td>
                              <td className="text-center">
                                <Badge
                                  bg={
                                    t.status === "pending"
                                      ? "warning"
                                      : t.status === "in_progress"
                                      ? "info"
                                      : "success"
                                  }
                                  className="px-3 py-2"
                                >
                                  {t.status === "pending"
                                    ? "Pendiente"
                                    : t.status === "in_progress"
                                    ? "En Progreso"
                                    : t.status === "completed"
                                    ? "Completada"
                                    : t.status}
                                </Badge>
                              </td>
                              <td className="pe-3 small text-muted">
                                {t.scheduled_date ? formatearFecha(t.scheduled_date) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-5 text-muted">
                      <FaTasks size={40} className="mb-3 opacity-50" />
                      <p>No hay tareas para este usuario en esta fecha</p>
                    </div>
                  )}
                </Card.Body>
                <Card.Footer className="bg-light border-top">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setUsuarioSeleccionado(null)}
                  >
                    <i className="fas fa-times me-1"></i>
                    Cerrar Detalle
                  </button>
                </Card.Footer>
              </Card>
            )}
          </>
        ) : null}
      </Modal.Body>
    </Modal>
  );
};

export default ResumenTareasModal;
