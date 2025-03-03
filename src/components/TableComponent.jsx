import React, { useEffect, useState } from "react";
import apiRequest from "../services/api"; // Importamos el servicio API
import "bootstrap/dist/css/bootstrap.min.css"; // Bootstrap para estilos
import "../styles/Table.css"; // Archivo CSS para la tabla

const TableComponent = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const data = await apiRequest("cliente"); // Llamada al servicio API
        setClientes(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClientes();
  }, []);

  return (
    <div className="table-container">
      <h4 className="table-title">Lista de Usuarios</h4>
      {loading ? (
        <p>Cargando datos...</p>
      ) : error ? (
        <p className="text-danger">Error: {error}</p>
      ) : (
        <table className="table table-hover table-striped table-bordered">
          <thead className="custom-header">
            <tr>
              <th scope="col">#</th>
              <th scope="col">Nombre Completo</th>
              <th scope="col">Fecha de Nacimiento</th>
              <th scope="col">Edad</th>
              <th scope="col">Género</th>
              <th scope="col">Social</th>
              <th scope="col">Idioma</th>
              <th scope="col">Telefono</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length > 0 ? (
              clientes.map((cliente, index) => (
                <tr key={cliente.id || index}>
                  <th scope="row">{index + 1}</th>
                  <td>{cliente.nombre_completo}</td>
                  <td>{cliente.fecha_nacimiento}</td>
                  <td>{cliente.edad}</td>
                  <td>{cliente.genero}</td>
                  <td>{cliente.social}</td>
                  <td>{cliente.idioma}</td>
                  <td>{cliente.telefono}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center">
                  No hay clientes disponibles
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default TableComponent;



