import React, { useEffect, useState } from "react";
import { Modal, Table, Badge, Row, Col } from "react-bootstrap";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import apiRequest from "../../services/api";

const ResumenTareasModal = ({ show, onHide, fecha, setFecha }) => {
  const [tareasPorUsuario, setTareasPorUsuario] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [tareasUsuarioDetalle, setTareasUsuarioDetalle] = useState([]);

  const fechaObjetivo = fecha ? new Date(fecha) : new Date();
  const fechaISO = fechaObjetivo.toISOString().slice(0, 10);

  // 🔁 Cargar resumen al abrir o cambiar fecha
  useEffect(() => {
    const fetchResumen = async () => {
      if (!show || !fecha) return;
      try {
        const response = await apiRequest(`tareas_operativas/resumen-tareas?fecha=${fechaISO}`, "GET");
        setTareasPorUsuario(response || []);
        setUsuarioSeleccionado(null); // limpiar si cambia la fecha
      } catch (error) {
        console.error("Error al obtener resumen de tareas:", error);
        setTareasPorUsuario([]);
      }
    };
    fetchResumen();
  }, [show, fecha]);

// 🔁 Cargar tareas detalladas del usuario seleccionado
useEffect(() => {
  const fetchTareasUsuario = async () => {
    if (!usuarioSeleccionado || !fecha) return;
    try {
      const res = await apiRequest(
        `tareas_operativas?assigned_user_id=${usuarioSeleccionado.id}&fecha_inicio=${fechaISO}&fecha_fin=${fechaISO}&per_page=100`,
        "GET"
      );
      setTareasUsuarioDetalle(res?.data || []);
    } catch (error) {
      console.error("Error al obtener tareas del usuario:", error);
      setTareasUsuarioDetalle([]);
    }
  };
  fetchTareasUsuario();
}, [usuarioSeleccionado, fecha]);


  useEffect(() => {
    if (!fecha && show) {
      setFecha(new Date());
    }
  }, [fecha, show, setFecha]);

  const esMismaFecha = (fechaStr1, fechaStr2) => {
    return new Date(fechaStr1).toISOString().slice(0, 10) === new Date(fechaStr2).toISOString().slice(0, 10);
  };
  
  const generarOpcionesDias = () => {
    const año = fechaObjetivo.getFullYear();
    const mes = fechaObjetivo.getMonth();
    const diasEnMes = new Date(año, mes + 1, 0).getDate();

    return Array.from({ length: diasEnMes }, (_, i) => {
      const dia = i + 1;
      const fechaCompleta = new Date(año, mes, dia);
      const formatted = fechaCompleta.toISOString().slice(0, 10);
      return (
        <option key={formatted} value={formatted}>
          {dia}
        </option>
      );
    });
  };

  const COLORS = ["#ffc107", "#0dcaf0", "#198754"];
  const datosTorta = [
    { name: "Pendientes", value: tareasPorUsuario.reduce((acc, u) => acc + u.pending, 0) },
    { name: "En Progreso", value: tareasPorUsuario.reduce((acc, u) => acc + u.in_progress, 0) },
    { name: "Completadas", value: tareasPorUsuario.reduce((acc, u) => acc + u.completed, 0) },
  ];

  const handleUsuarioClick = (usuario) => {
    setUsuarioSeleccionado(usuario);
  };

  return (
    <Modal show={show} onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title className="w-100 d-flex justify-content-between align-items-center">
          <span>Resumen de Tareas - {fechaObjetivo.toLocaleDateString()}</span>
          <div className="d-flex align-items-center gap-2">
            <label className="form-label fw-bold mb-0">Día:</label>
            <select
              className="form-select form-select-sm"
              value={fechaISO}
              onChange={(e) => setFecha(new Date(e.target.value))}
            >
              {generarOpcionesDias()}
            </select>
          </div>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Row className="mb-4">
          <Col md={6}>
            <h6>Distribución por usuario (Barras)</h6>
            <ResponsiveContainer width="100%" height={250}>
            <BarChart data={tareasPorUsuario}>
              <XAxis dataKey="usuario.name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="pending"
                fill="#ffc107"
                name="Pendientes"
                cursor="pointer"
                onClick={(data) => handleUsuarioClick(data.payload.usuario)}
              />
              <Bar
                dataKey="in_progress"
                fill="#0dcaf0"
                name="En Progreso"
                cursor="pointer"
                onClick={(data) => handleUsuarioClick(data.payload.usuario)}
              />
              <Bar
                dataKey="completed"
                fill="#198754"
                name="Completadas"
                cursor="pointer"
                onClick={(data) => handleUsuarioClick(data.payload.usuario)}
              />
            </BarChart>

            </ResponsiveContainer>
          </Col>
          <Col md={6}>
            <h6>Totales del día (Torta)</h6>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={datosTorta} dataKey="value" nameKey="name" outerRadius={80} label>
                  {datosTorta.map((_, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Col>
        </Row>

        <h6 className="mt-4">Detalle por Usuario</h6>
        <Table bordered hover responsive>
          <thead>
            <tr>
              <th>Usuario</th>
              <th><Badge bg="warning">Pendientes</Badge></th>
              <th><Badge bg="info">En Progreso</Badge></th>
              <th><Badge bg="success">Completadas</Badge></th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {tareasPorUsuario.map((u) => (
              <tr
                key={u.usuario.id}
                style={{ cursor: "pointer" }}
                onClick={() => handleUsuarioClick(u.usuario)}
              >
                <td>{u.usuario.name}</td>
                <td><Badge bg="warning">{u.pending}</Badge></td>
                <td><Badge bg="info">{u.in_progress}</Badge></td>
                <td><Badge bg="success">{u.completed}</Badge></td>
                <td><strong>{u.total}</strong></td>
              </tr>
            ))}
          </tbody>
        </Table>

        {usuarioSeleccionado && (
          <>
            <h6 className="mt-4">Tareas de {usuarioSeleccionado.name}</h6>
            <Table bordered size="sm" hover responsive>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
              {tareasUsuarioDetalle
  .filter((t) => esMismaFecha(t?.log?.created_at, fechaISO))
  .map((t) => (
    <tr key={t.id}>
      <td>{t.id}</td>
      <td>{t.cliente?.nombre_completo || "Sin cliente"}</td>
      <td>
        <Badge
          bg={
            t.status === "pending"
              ? "warning"
              : t.status === "in_progress"
              ? "info"
              : "success"
          }
        >
          {t.status}
        </Badge>
      </td>
    </tr>
))}

              </tbody>
            </Table>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default ResumenTareasModal;
