// ClienteExistente.jsx
import React, { useState, useEffect } from "react";
import { Form, Button, Table, InputGroup, Alert, Spinner } from "react-bootstrap";
import apiRequest from "../services/api";
import { formatPhone334 } from "../utils/formatters";

const ClienteExistente = ({ onClienteSeleccionado }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  const buscarClientes = async () => {
    const termino = searchTerm.trim();
    if (termino.length < 3) {
      setError("Ingrese al menos 3 caracteres para buscar");
      setSearchResults([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest(
        `cliente/buscar?nombre=${encodeURIComponent(termino)}&incluir_prospectos=false`,
        "GET"
      );
      const clientes = Array.isArray(response) ? response : [];
      if (clientes.length > 0) {
        setSearchResults(clientes);
        setTotalPages(Math.ceil(clientes.length / itemsPerPage));
        setPage(1);
      } else {
        setSearchResults([]);
        setError(`No se encontraron resultados para "${termino}"`);
      }
    } catch (err) {
      console.error("Error:", err);
      setSearchResults([]);
      setError("Error al buscar clientes.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (error) setError(null);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm.trim().length >= 3) buscarClientes();
      else setSearchResults([]);
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const getCurrentPageClients = () => {
    const startIndex = (page - 1) * itemsPerPage;
    return searchResults.slice(startIndex, startIndex + itemsPerPage);
  };

  // Función para formatear y mostrar teléfonos del array telefonos
  const formatTelefonos = (cliente) => {
    // Priorizar array de telefonos si existe
    if (Array.isArray(cliente.telefonos) && cliente.telefonos.length > 0) {
      const telefonosOrdenados = [...cliente.telefonos].sort(
        (a, b) => (b?.principal ? 1 : 0) - (a?.principal ? 1 : 0)
      );
      
      return telefonosOrdenados.map((tel) => {
        const indicativo = tel?.indicativo ? `+${tel.indicativo} ` : "";
        const numeroFormateado = formatPhone334(tel?.numero || "");
        const tipo = tel?.tipo ? ` (${tel.tipo})` : "";
        const principal = tel?.principal ? " ⭐" : "";
        return `${indicativo}${numeroFormateado}${tipo}${principal}`;
      }).join(", ");
    }
    
    // Fallback: usar campo legacy telefono
    if (cliente.telefono) {
      return formatPhone334(cliente.telefono);
    }
    
    return "-";
  };

  return (
    <div>
      <Form>
        <Form.Group className="mb-3">
          <Form.Label>Buscar Cliente</Form.Label>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="Nombre"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </InputGroup>
          <Form.Text className="text-muted">Ingrese al menos 3 caracteres para buscar</Form.Text>
        </Form.Group>
      </Form>

      {loading && (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" /> Buscando…
        </div>
      )}

      {error && (
        <Alert variant="danger" className="mt-3">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {!loading && searchResults.length > 0 && (
        <>
          <h6 className="mt-3">Resultados ({searchResults.length})</h6>
          <div className="table-responsive">
            <Table hover className="mt-2">
              <thead className="bg-light">
                <tr>
                  <th>Nombre</th>
                  <th>Estado Cliente</th>
                  <th>Teléfono</th>
                  <th>Fecha de Nacimiento</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {getCurrentPageClients().map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.nombre_completo || `${cliente.nombre || ""} ${cliente.apellido || ""}`}</td>
                    <td>{cliente.estado_cliente || "-"}</td>
                    <td>{formatTelefonos(cliente)}</td>
                    <td>{cliente.fecha_nacimiento ? new Date(cliente.fecha_nacimiento).toLocaleDateString() : "-"}</td>
                    <td>
                      <Button variant="success" size="sm" onClick={() => onClienteSeleccionado?.(cliente)}>
                        <i className="bi bi-plus-circle me-1"></i> Agregar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-3">
              <ul className="pagination">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <li key={p} className={`page-item ${p === page ? "active" : ""}`}>
                    <button className="page-link" onClick={() => setPage(p)}>{p}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClienteExistente;
