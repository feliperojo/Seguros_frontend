import React, { useEffect, useState } from "react";
import { Button, Spinner, Alert, Card } from "react-bootstrap";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import apiRequest from "../services/api";
import MediosPago from "../components/MediosPago";

const MediosPagoManager = () => {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const actionParam = queryParams.get("action");

  const [cliente, setCliente] = useState(null);
  const [loadingCliente, setLoadingCliente] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchClienteData();
  }, [clienteId]);

  const fetchClienteData = async () => {
    if (!clienteId) return;
    setLoadingCliente(true);
    try {
      const response = await apiRequest(`cliente/${clienteId}`, "GET");
      setCliente(response);
    } catch (error) {
      console.error("Error al cargar cliente:", error);
      setError("No se pudo cargar la información del cliente.");
    } finally {
      setLoadingCliente(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>Inicio</a>
              </li>
              <li className="breadcrumb-item">
                <a href="/clientes" onClick={(e) => { e.preventDefault(); navigate('/clientes') }}>Clientes</a>
              </li>
              {cliente && (
                <li className="breadcrumb-item">
                  <a href={`/clientes/${clienteId}`} onClick={(e) => { e.preventDefault(); navigate(`/clientes/${clienteId}`) }}>{cliente.nombre_completo}</a>
                </li>
              )}
              <li className="breadcrumb-item active" aria-current="page">Medios de Pago</li>
            </ol>
          </nav>
          <h4 className="mb-0">
            <i className="bi bi-credit-card me-2"></i>
            Gestión de Medios de Pago
          </h4>
        </div>
        <Button variant="outline-secondary" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left me-2"></i>
          Volver
        </Button>
      </div>

      <Card className="shadow-sm mb-4">
        <Card.Header className="bg-white d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-0">Medios de Pago</h5>
            {cliente && <p className="text-muted mb-0 small">Cliente: <strong>{cliente.nombre_completo}</strong></p>}
          </div>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger" className="d-flex align-items-center"><i className="bi bi-exclamation-triangle me-2"></i>{error}</Alert>}

          {loadingCliente ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted">Cargando información...</p>
            </div>
          ) : (
            <MediosPago clienteId={clienteId} />
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default MediosPagoManager;
