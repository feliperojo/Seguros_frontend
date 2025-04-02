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

  // Función para buscar clientes
  const buscarClientes = async (pagina = 1) => {
    if (!searchTerm.trim() || searchTerm.trim().length < 3) {
      setError("Por favor ingrese al menos 3 caracteres para buscar");
      return;
    }

    setLoading(true);
    setError(null);
    console.log("Buscando clientes con término:", searchTerm);

    try {
      // Intentamos primero con la ruta cliente/search (si existe en tu API)
      console.log(`Realizando búsqueda con: cliente/search?query=${encodeURIComponent(searchTerm)}`);
      let response;
      
      try {
        // Intenta primero con el endpoint específico de búsqueda
        response = await apiRequest(`cliente/search?query=${encodeURIComponent(searchTerm)}`, "GET");
        console.log("Respuesta de búsqueda:", response);
      } catch (searchError) {
        console.log("Error con endpoint search, intentando con endpoint alternativo:", searchError);
        
        // Si falla, intentamos con el endpoint general que lista todos los clientes
        response = await apiRequest(`cliente/?query=${encodeURIComponent(searchTerm)}`, "GET");
        console.log("Respuesta de endpoint alternativo:", response);
      }

      // Procesamiento de la respuesta según su estructura
      if (response) {
        let clientesEncontrados = [];
        
        // Intentar diferentes estructuras de respuesta posibles
        if (Array.isArray(response)) {
          // Si la respuesta es directamente un array de clientes
          clientesEncontrados = response;
        } else if (response.data && Array.isArray(response.data)) {
          // Si la respuesta tiene un campo data que es un array
          clientesEncontrados = response.data;
        } else if (response.clientes && Array.isArray(response.clientes)) {
          // Si la respuesta tiene un campo clientes que es un array
          clientesEncontrados = response.clientes;
        } else if (response.results && Array.isArray(response.results)) {
          // Si la respuesta tiene un campo results que es un array
          clientesEncontrados = response.results;
        } else if (typeof response === 'object') {
          // Si la respuesta es un objeto, convertimos sus valores a un array
          clientesEncontrados = Object.values(response).filter(item => typeof item === 'object');
        }
        
        // Filtramos los resultados manualmente si es necesario
        if (clientesEncontrados.length > 0) {
          // Filtrar los resultados por el término de búsqueda (en caso de que la API no lo haga)
          clientesEncontrados = clientesEncontrados.filter(cliente => {
            const nombreCompleto = (cliente.nombre_completo || 
              `${cliente.nombre || ''} ${cliente.apellido || ''}`).toLowerCase();
            const email = (cliente.email || '').toLowerCase();
            const telefono = (cliente.telefono || '').toLowerCase();
            const documento = (cliente.documento_identidad || '').toLowerCase();
            
            const termino = searchTerm.toLowerCase();
            
            return nombreCompleto.includes(termino) || 
                   email.includes(termino) || 
                   telefono.includes(termino) || 
                   documento.includes(termino);
          });
        }
        
        console.log("Clientes encontrados después de procesar:", clientesEncontrados);
        
        if (clientesEncontrados.length > 0) {
          setSearchResults(clientesEncontrados);
          setTotalPages(Math.ceil(clientesEncontrados.length / itemsPerPage) || 1);
          setPage(1);
        } else {
          setSearchResults([]);
          setError(`No se encontraron resultados para "${searchTerm}"`);
        }
      } else {
        setSearchResults([]);
        setError("La respuesta de la API no tiene el formato esperado");
      }
    } catch (error) {
      console.error("Error al buscar clientes:", error);
      setError(`Error al buscar clientes: ${error.message || "Error desconocido"}`);
      setSearchResults([]);
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
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1); // Resetear página a 1 en nueva búsqueda
    buscarClientes(1);
  };

  // Manejador para seleccionar un cliente
  const handleSelectClient = (cliente) => {
    console.log("Cliente seleccionado:", cliente);
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

  // Obtenemos los clientes para la página actual
  const getCurrentPageClients = () => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return searchResults.slice(startIndex, endIndex);
  };

  return (
    <div>
      <Form onSubmit={handleSearchSubmit}>
        <Form.Group className="mb-3">
          <Form.Label>Buscar Cliente</Form.Label>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="Nombre, email, teléfono o documento de identidad"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                  />
                  <span className="ms-2">Buscando...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-search me-2"></i>
                  Buscar
                </>
              )}
            </Button>
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
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Social</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {getCurrentPageClients().map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.nombre_completo || `${cliente.nombre || ''} ${cliente.apellido || ''}`}</td>
                    <td>{cliente.email || "-"}</td>
                    <td>{cliente.telefono || "-"}</td>
                    <td>{cliente.social || cliente.social || "-"}</td>
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
            <p className="mt-2 text-muted">No se encontraron resultados para "{searchTerm}"</p>
          </div>
        )
      )}
    </div>
  );
};

export default ClienteExistente;