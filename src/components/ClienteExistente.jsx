import React, { useState, useEffect } from "react";
import { Form, Button, Table, InputGroup, Alert, Spinner } from "react-bootstrap";
import apiRequest from "../services/api";

const ClienteExistente = ({ onClienteSeleccionado }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(10);
  const termino = searchTerm.trim().toLowerCase();

  // Función para buscar clientes
  const buscarClientes = async () => {
    const termino = searchTerm.trim();
  
    if (termino.length < 3) {
      setError("Ingrese al menos 3 caracteres para buscar");
      setSearchResults([]);
      return;
    }
  
    try {
      const response = await apiRequest(`cliente/buscar?nombre=${encodeURIComponent(termino)}&incluir_prospectos=false`, "GET");
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
  
  // Manejador para el cambio en el input de búsqueda
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (error) setError(null);
  };

  // Manejador para el formulario de búsqueda
  

  // Manejador para seleccionar un cliente
  const handleSelectClient = (cliente) => {
   
    onClienteSeleccionado(cliente);
  };

  // Manejador de paginación
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      // No realizamos una nueva búsqueda, solo filtramos los resultados ya obtenidos
      // para la paginación del lado del cliente
    }
  };
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchTerm.trim().length >= 3) {
        buscarClientes();
      } else {
        setSearchResults([]);
      }
    }, 400); // espera 400ms tras dejar de escribir
  
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);
  

  // Obtenemos los clientes para la página actual
  const getCurrentPageClients = () => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return searchResults.slice(startIndex, endIndex);
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
          <Form.Text className="text-muted">
            Ingrese al menos 3 caracteres para buscar
          </Form.Text>
        </Form.Group>
      </Form>

      {error && (
        <Alert variant="danger" className="mt-3">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {searchResults.length > 0 ? (
        <div className="mt-4">
          <h5>Resultados ({searchResults.length})</h5>
          <div className="table-responsive">
            <Table hover className="mt-3">
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
                    <td>{cliente.nombre_completo || `${cliente.nombre || ''} ${cliente.apellido || ''}`}</td>
                    <td>{cliente.estado_cliente || "-"}</td>
                    <td>{cliente.telefono || "-"}</td>
                    <td>{cliente.fecha_nacimiento
                    ? new Date(cliente.fecha_nacimiento).toLocaleDateString()
                    : "-"}</td>
                    <td>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleSelectClient(cliente)}
                      >
                        <i className="bi bi-plus-circle me-1"></i> Agregar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center mt-3">
              <ul className="pagination">
                <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(page - 1)}
                  >
                    Anterior
                  </button>
                </li>
                {[...Array(totalPages).keys()].map((i) => (
                  <li
                    key={i + 1}
                    className={`page-item ${page === i + 1 ? "active" : ""}`}
                  >
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(i + 1)}
                    >
                      {i + 1}
                    </button>
                  </li>
                ))}
                <li
                  className={`page-item ${
                    page === totalPages ? "disabled" : ""
                  }`}
                >
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Siguiente
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      ) : (
        !loading &&
        searchTerm &&
        !error && (
          <div className="text-center my-4 py-4 border rounded bg-light">
            <i className="bi bi-search fs-1 text-muted"></i>
                      </div>
        )
      )}
    </div>
  );
};

export default ClienteExistente;