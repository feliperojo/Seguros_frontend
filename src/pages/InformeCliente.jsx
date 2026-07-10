import React, { useState } from "react";
import {
  Container,
  Form,
  Button,
  Row,
  Col,
  Accordion,
  Spinner,
  Alert,
  Table,
} from "react-bootstrap";
import apiRequest from "../services/api";
import { getListFromApi } from "../utils/apiResponse";

const InformeCliente = () => {
  const [busqueda, setBusqueda] = useState("");
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [incluirGrupo, setIncluirGrupo] = useState(false);
  const [polizasAgrupadas, setPolizasAgrupadas] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debounceTimeout, setDebounceTimeout] = useState(null);

  const buscarClientes = async (nombre) => {
    try {
      const res = await apiRequest(`cliente/buscar?nombre=${nombre}`, "GET");
      setClientes(getListFromApi(res));
    } catch (err) {
      console.error("Error al buscar clientes:", err);
    }
  };

  const buscarHistorial = async (cliente) => {
    setLoading(true);
    setError("");
    setPolizasAgrupadas({});

    try {
      const res = await apiRequest(
        `cliente/${cliente.id}/historial-polizas?incluir_grupo=${incluirGrupo}`,
        "GET"
      );
console.log("lista clientes",res)
      const agrupado = {};
      for (const poliza of res || []) {
        const grupoId = poliza.grupo_familiar_id;
        if (!agrupado[grupoId]) agrupado[grupoId] = [];
        agrupado[grupoId].push(poliza);
      }

      setPolizasAgrupadas(agrupado);
    } catch (err) {
      console.error("Error al obtener historial:", err);
      setError("Error al obtener el historial.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <h3 className="my-4">Informe Histórico del Cliente</h3>

      <Row className="align-items-center mb-3">
        <Col md={6}>
          <div style={{ position: "relative" }}>
            <Form.Control
              placeholder="Buscar cliente por nombre"
              value={busqueda}
              onChange={(e) => {
                const val = e.target.value;
                setBusqueda(val);
                setClienteSeleccionado(null);
                setPolizasAgrupadas({});
                setError("");

                if (debounceTimeout) clearTimeout(debounceTimeout);

                const timeout = setTimeout(() => {
                  if (val.length >= 2) buscarClientes(val);
                }, 300);

                setDebounceTimeout(timeout);
              }}
            />

            {clientes.length > 0 && (
              <div
                className="position-absolute bg-white border rounded shadow-sm mt-1"
                style={{
                  zIndex: 9999,
                  width: "100%",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {clientes.map((cli) => (
                  <div
                    key={cli.id}
                    className="py-1 px-2"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#eef6ff")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "white")
                    }
                    onClick={async () => {
                      setClienteSeleccionado(cli);
                      setBusqueda(cli.nombre_completo);
                      setClientes([]);
                      await buscarHistorial(cli);
                    }}
                  >
                    {cli.nombre_completo}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Col>

        <Col md={4}>
          <Form.Check
            label="Incluir miembros del grupo familiar"
            checked={incluirGrupo}
            onChange={(e) => setIncluirGrupo(e.target.checked)}
          />
        </Col>

        <Col md={2}>
          <Button disabled className="w-100" title="Selecciona un cliente de la lista">
            Filtrar
          </Button>
        </Col>
      </Row>

      {clienteSeleccionado && (
        <p className="text-muted">
          Mostrando historial para:{" "}
          <strong>{clienteSeleccionado.nombre_completo}</strong>
        </p>
      )}

      {loading && <Spinner animation="border" />}
      {error && <Alert variant="danger">{error}</Alert>}

      {Object.keys(polizasAgrupadas).length > 0 ? (
        <Accordion defaultActiveKey="0" alwaysOpen>
          {Object.entries(polizasAgrupadas).map(([grupoId, polizas], idx) => (
            <Accordion.Item eventKey={idx.toString()} key={grupoId}>
              <Accordion.Header>
                Grupo Familiar ID: {grupoId} ({polizas.length} póliza
                {polizas.length > 1 ? "s" : ""})
              </Accordion.Header>
              <Accordion.Body>
                <Table striped bordered hover responsive size="sm">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Cliente</th>
                      <th>Inicio</th>
                      <th>Estado</th>
                      <th>Parentesco</th>
                      <th>Compañía</th>
                      <th>Plan</th>
                      <th>Metal</th>
                      <th>Red</th>
                      <th>Tipo</th>
                      <th>Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {polizas.map((p) => (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td>{p.cliente_nombre}</td>
                        <td>{p.fecha_inicio}</td>
                        <td>{p.estado}</td>
                        <td>{p.parentesco || "-"}</td>
                        <td>{p.compania_nombre || "-"}</td>
                        <td>{p.plan || "-"}</td>
                        <td>{p.metal || "-"}</td>
                        <td>{p.red || "-"}</td>
                        <td>{p.cobertura_tipo || "-"}</td>
                        <td>{p.tipo_pago || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      ) : (
        clienteSeleccionado &&
        !loading && (
          <Alert variant="info" className="mt-3">
            No se encontraron pólizas para el cliente seleccionado.
          </Alert>
        )
      )}
    </Container>
  );
};

export default InformeCliente;
