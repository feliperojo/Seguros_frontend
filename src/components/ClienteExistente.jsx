// ClienteExistente.jsx
import React, { useState, useEffect } from "react";
import { Form, Button, Table, InputGroup, Alert, Spinner } from "react-bootstrap";
import apiRequest from "../services/api";
import { formatPhone334, formatDateForDisplay } from "../utils/formatters";
import { getListFromApi } from "../utils/apiResponse";

const ClienteExistente = ({ onClienteSeleccionado }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  const buscarClientes = async () => {
    // Normalizar el término de búsqueda: eliminar espacios múltiples y espacios al inicio/final
    // Esto permite buscar "Juan Pérez" aunque en la BD esté "Juan  Pérez" (con doble espacio)
    const termino = searchTerm.trim().replace(/\s+/g, ' ').trim();
    
    if (termino.length < 2) {
      setError("Ingrese al menos 2 caracteres para buscar");
      setSearchResults([]);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Estrategia de búsqueda: intentar primero con el término completo
      // Si no hay resultados y hay múltiples palabras, intentar variaciones
      let response = await apiRequest(
        `cliente/buscar?nombre=${encodeURIComponent(termino)}&incluir_prospectos=false`,
        "GET"
      );
      
      let clientes = getListFromApi(response);
      
      // Si no hay resultados y el término tiene múltiples palabras, intentar estrategias alternativas
      if (clientes.length === 0 && termino.includes(' ')) {
        const palabras = termino.split(' ').filter(p => p.length > 0);
        const terminoLower = termino.toLowerCase();
        const palabrasBusqueda = terminoLower.split(' ').filter(p => p.length > 0);
        
        // Función auxiliar para normalizar el nombre completo de un cliente
        const normalizarNombreCompleto = (cliente) => {
          let nombreCompleto = "";
          if (cliente.nombre_completo) {
            nombreCompleto = cliente.nombre_completo;
          } else if (cliente.primer_nombre || cliente.apellidos) {
            nombreCompleto = `${cliente.primer_nombre || ""} ${cliente.segundo_nombre || ""} ${cliente.apellidos || ""}`.trim();
          } else if (cliente.nombre || cliente.apellido) {
            nombreCompleto = `${cliente.nombre || ""} ${cliente.apellido || ""}`.trim();
          }
          return nombreCompleto
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
        };
        
        // Función auxiliar para filtrar clientes que coincidan con todas las palabras
        const filtrarPorPalabras = (clientesArray) => {
          return clientesArray.filter(cliente => {
            const nombreNormalizado = normalizarNombreCompleto(cliente);
            return palabrasBusqueda.every(palabra => nombreNormalizado.includes(palabra));
          });
        };
        
        // Estrategia 1: Buscar solo con la primera palabra (nombre)
        if (palabras.length > 0 && palabras[0].length >= 2) {
          try {
            const res1 = await apiRequest(
              `cliente/buscar?nombre=${encodeURIComponent(palabras[0])}&incluir_prospectos=false`,
              "GET"
            );
            const clientes1 = getListFromApi(res1);
            if (clientes1.length > 0) {
              const filtrados = filtrarPorPalabras(clientes1);
              if (filtrados.length > 0) {
                clientes = filtrados;
              } else {
                // Si no hay coincidencias exactas, usar todos los resultados de la primera palabra
                clientes = clientes1;
              }
            }
          } catch (e) {
            console.warn("Error en búsqueda alternativa (primera palabra):", e);
          }
        }
        
        // Estrategia 2: Si aún no hay resultados, buscar con la última palabra (apellido)
        if (clientes.length === 0 && palabras.length > 1 && palabras[palabras.length - 1].length >= 2) {
          try {
            const ultimaPalabra = palabras[palabras.length - 1];
            const res2 = await apiRequest(
              `cliente/buscar?nombre=${encodeURIComponent(ultimaPalabra)}&incluir_prospectos=false`,
              "GET"
            );
            const clientes2 = getListFromApi(res2);
            if (clientes2.length > 0) {
              const filtrados = filtrarPorPalabras(clientes2);
              if (filtrados.length > 0) {
                clientes = filtrados;
              } else {
                // Si no hay coincidencias exactas, usar todos los resultados de la última palabra
                clientes = clientes2;
              }
            }
          } catch (e) {
            console.warn("Error en búsqueda alternativa (última palabra):", e);
          }
        }
      }
      
      if (clientes.length > 0) {
        setSearchResults(clientes);
        setTotalPages(Math.ceil(clientes.length / itemsPerPage));
        setPage(1);
      } else {
        setSearchResults([]);
        setError(`No se encontraron resultados para "${termino}".`);
      }
    } catch (err) {
      console.error("Error al buscar clientes:", err);
      setSearchResults([]);
      setError("Error al buscar clientes. Por favor, intente nuevamente.");
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
      const terminoNormalizado = searchTerm.trim().replace(/\s+/g, ' ').trim();
      if (terminoNormalizado.length >= 2) {
        buscarClientes();
      } else {
        setSearchResults([]);
        setError(null);
      }
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
              placeholder="Nombre completo o apellido (ej: Juan Pérez)"
              value={searchTerm}
              onChange={handleSearchChange}
              autoFocus
            />
          </InputGroup>
          <Form.Text className="text-muted">Ingrese al menos 2 caracteres. Puede buscar por nombre, apellido o nombre completo.</Form.Text>
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
                  <th>Producto / Vigencia</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {getCurrentPageClients().map((cliente) => {
                  // Soporta uno o varios registros de cobertura
                  const coberturas = Array.isArray(cliente.coberturas)
                    ? cliente.coberturas
                    : (cliente.cobertura_tipo || cliente.vigente || cliente.activo)
                    ? [{
                        cobertura_tipo: cliente.cobertura_tipo,
                        vigente: cliente.vigente,
                        activo: cliente.activo,
                        fecha_cancelacion: cliente.fecha_cancelacion,
                        fecha_retiro: cliente.fecha_retiro,
                      }]
                    : [];

                  return (
                    <tr key={cliente.id}>
                      <td>{cliente.nombre_completo || `${cliente.nombre || ""} ${cliente.apellido || ""}`}</td>
                      <td>{cliente.estado_cliente || "-"}</td>
                      <td>{formatTelefonos(cliente)}</td>
                      <td>{formatDateForDisplay(cliente.fecha_nacimiento)}</td>
                      <td>
                        {coberturas.length === 0 ? (
                          <span className="text-muted small">Sin coberturas</span>
                        ) : (
                          <div className="d-flex flex-column gap-1 small">
                            {coberturas.map((cob, idx) => {
                              const producto = cob.cobertura_tipo || "-";
                              const esActiva = cob.vigente || cob.activo;
                              const textoVigencia = esActiva
                                ? "Activa"
                                : cob.fecha_cancelacion || cob.fecha_retiro
                                ? "Finalizada"
                                : "Sin estado";

                              return (
                                <div key={idx} className="d-flex align-items-center">
                                  <span className="badge bg-light text-dark me-2">
                                    {producto}
                                  </span>
                                  <span className={esActiva ? "text-success" : "text-muted"}>
                                    {textoVigencia}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td>
                        <Button variant="success" size="sm" onClick={() => onClienteSeleccionado?.(cliente)}>
                          <i className="bi bi-plus-circle me-1"></i> Agregar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
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
