import React, { useEffect, useRef, useState } from "react";
import {
  Container,
  Form,
  Button,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Table,
} from "react-bootstrap";
import apiRequest from "../services/api";
import { getListFromApi } from "../utils/apiResponse";

const formatFecha = (value) => {
  if (!value) return "—";
  const raw = String(value).trim();
  if (!raw) return "—";
  // YYYY-MM-DD o ISO
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  return raw;
};

const InformeCliente = () => {
  const [busqueda, setBusqueda] = useState("");
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [incluirGrupo, setIncluirGrupo] = useState(false);
  const [polizasAgrupadas, setPolizasAgrupadas] = useState({});
  const [loading, setLoading] = useState(false);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef(null);
  const incluirGrupoRef = useRef(incluirGrupo);

  useEffect(() => {
    incluirGrupoRef.current = incluirGrupo;
  }, [incluirGrupo]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const buscarClientes = async (nombre) => {
    setBuscandoClientes(true);
    try {
      const res = await apiRequest(
        `cliente/buscar?nombre=${encodeURIComponent(nombre)}`,
        "GET"
      );
      setClientes(getListFromApi(res));
    } catch (err) {
      console.error("Error al buscar clientes:", err);
      setClientes([]);
    } finally {
      setBuscandoClientes(false);
    }
  };

  const buscarHistorial = async (cliente, incluirGrupoFamiliar = incluirGrupoRef.current) => {
    if (!cliente?.id) return;

    setLoading(true);
    setError("");
    setPolizasAgrupadas({});

    try {
      const res = await apiRequest(
        `cliente/${cliente.id}/historial-polizas?incluir_grupo=${incluirGrupoFamiliar ? "1" : "0"}`,
        "GET"
      );
      const polizas = getListFromApi(res);
      const agrupado = {};

      for (const poliza of polizas) {
        const grupoId = poliza.grupo_familiar_id ?? "sin-grupo";
        if (!agrupado[grupoId]) agrupado[grupoId] = [];
        agrupado[grupoId].push(poliza);
      }

      setPolizasAgrupadas(agrupado);
    } catch (err) {
      console.error("Error al obtener historial:", err);
      setError(err?.message || "Error al obtener el historial de coberturas.");
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrar = async () => {
    if (!clienteSeleccionado) {
      setError("Selecciona un cliente de la lista de sugerencias.");
      return;
    }
    await buscarHistorial(clienteSeleccionado, incluirGrupo);
  };

  const totalPolizas = Object.values(polizasAgrupadas).reduce(
    (acc, lista) => acc + lista.length,
    0
  );

  return (
    <Container>
      <h3 className="my-4">Informe Histórico del Cliente</h3>
      <p className="text-muted mb-3">
        Consulta el historial de coberturas/pólizas de un cliente. Opcionalmente
        incluye a todos los miembros de sus grupos familiares.
      </p>

      <Row className="align-items-center mb-3 g-2">
        <Col md={6}>
          <div style={{ position: "relative" }}>
            <Form.Control
              placeholder="Buscar cliente por nombre (mín. 2 letras)"
              value={busqueda}
              onChange={(e) => {
                const val = e.target.value;
                setBusqueda(val);
                setClienteSeleccionado(null);
                setPolizasAgrupadas({});
                setError("");

                if (debounceRef.current) clearTimeout(debounceRef.current);

                debounceRef.current = setTimeout(() => {
                  if (val.trim().length >= 2) buscarClientes(val.trim());
                  else setClientes([]);
                }, 300);
              }}
            />

            {buscandoClientes && (
              <div className="position-absolute end-0 top-50 translate-middle-y me-2">
                <Spinner animation="border" size="sm" />
              </div>
            )}

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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#eef6ff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "white";
                    }}
                    onClick={async () => {
                      setClienteSeleccionado(cli);
                      setBusqueda(cli.nombre_completo || "");
                      setClientes([]);
                      await buscarHistorial(cli, incluirGrupo);
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
            onChange={async (e) => {
              const checked = e.target.checked;
              setIncluirGrupo(checked);
              if (clienteSeleccionado) {
                await buscarHistorial(clienteSeleccionado, checked);
              }
            }}
          />
        </Col>

        <Col md={2}>
          <Button
            className="w-100"
            onClick={handleFiltrar}
            disabled={!clienteSeleccionado || loading}
          >
            {loading ? "Cargando…" : "Filtrar"}
          </Button>
        </Col>
      </Row>

      {!clienteSeleccionado && !loading && (
        <Alert variant="light" className="border">
          Escribe el nombre del cliente, selecciónalo en la lista y se mostrará
          su historial de coberturas.
        </Alert>
      )}

      {clienteSeleccionado && (
        <p className="text-muted">
          Mostrando historial para:{" "}
          <strong>{clienteSeleccionado.nombre_completo}</strong>
          {totalPolizas > 0 ? ` · ${totalPolizas} cobertura(s)` : null}
        </p>
      )}

      {loading && (
        <div className="d-flex align-items-center gap-2 my-3">
          <Spinner animation="border" size="sm" />
          <span className="text-muted">Cargando coberturas…</span>
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}

      {Object.keys(polizasAgrupadas).length > 0 ? (
        <div className="d-flex flex-column gap-3">
          {Object.entries(polizasAgrupadas).map(([grupoId, polizas]) => (
            <Card key={grupoId} className="shadow-sm">
              <Card.Header className="bg-primary bg-opacity-10 fw-semibold">
                {grupoId === "sin-grupo"
                  ? "Sin grupo familiar"
                  : `Grupo Familiar ID: ${grupoId}`}{" "}
                ({polizas.length} cobertura
                {polizas.length > 1 ? "s" : ""})
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table striped bordered hover responsive size="sm" className="mb-0">
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
                        <th>Póliza</th>
                      </tr>
                    </thead>
                    <tbody>
                      {polizas.map((p) => (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td>{p.cliente_nombre || "—"}</td>
                          <td>{formatFecha(p.fecha_inicio)}</td>
                          <td>{p.estado || "—"}</td>
                          <td>{p.parentesco || "—"}</td>
                          <td>{p.compania_nombre || "—"}</td>
                          <td>{p.plan || "—"}</td>
                          <td>{p.metal || "—"}</td>
                          <td>{p.red || "—"}</td>
                          <td>{p.cobertura_tipo || "—"}</td>
                          <td>{p.tipo_pago || "—"}</td>
                          <td>{p.codigo_poliza || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      ) : (
        clienteSeleccionado &&
        !loading &&
        !error && (
          <Alert variant="info" className="mt-3">
            No se encontraron coberturas para el cliente seleccionado
            {incluirGrupo ? " ni para su grupo familiar" : ""}.
          </Alert>
        )
      )}
    </Container>
  );
};

export default InformeCliente;
