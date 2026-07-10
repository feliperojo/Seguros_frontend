import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import DetalleClienteModal from "../components/DetalleClienteModal";
import apiRequest from "../services/api";

const DetalleClientePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [clienteData, setClienteData] = useState(null);
  const [grupoFamiliarId, setGrupoFamiliarId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCliente = async () => {
        try {
          console.log("✅ Buscando cliente con ID:", id);
          const response = await apiRequest(`cliente/with-cobertura?cliente_id=${id}`, "GET");
          console.log("response", response);
      
          if (response && response.data && response.data.length > 0) {
            const cliente = response.data[0]; 
            setClienteData(cliente);
            setGrupoFamiliarId(cliente.grupo_familiar_id || null);
          } else {
            console.warn("⚠ No se encontró cliente en la respuesta");
          }
        } catch (error) {
          console.error("❌ Error al obtener cliente:", error.message);
        } finally {
          setLoading(false);
        }
      };
      

    if (id) fetchCliente();
  }, [id]);

  if (loading) {
    return <p style={{ padding: "20px" }}>Cargando información del cliente...</p>;
  }

  if (!clienteData) {
    return (
      <div style={{ padding: "20px" }}>
        <p>No se encontró información para el cliente con ID {id}</p>
        <button onClick={() => navigate(-1)}>Volver</button>
      </div>
    );
  }

  return (
    <DetalleClienteModal
      show={true}
      onHide={() => navigate("/clientes/lista")}
      clienteData={clienteData}
      grupoFamiliarId={grupoFamiliarId} // ✅ Se envía para cargar pólizas
    />
  );
};

export default DetalleClientePage;
