import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import apiRequest from "../../services/api";
import { Container } from "react-bootstrap";
import logo from "../../assets/tampa.jpg";
import "../../styles/ReporteGrupoFamiliar.css"; // Asegúrate de tener estilos base aquí

const ReporteGrupoFamiliar = () => {
  const { id } = useParams();
  const [grupo, setGrupo] = useState(null);

  useEffect(() => {
    const fetchGrupo = async () => {
      try {
        const response = await apiRequest(`grupo_familiar/grupos-familiares-full/${id}`, "GET");
        if (response.status === "success") {
          setGrupo(response.data);
        }
      } catch (error) {
        console.error("Error al cargar el grupo familiar:", error);
      }
    };

    fetchGrupo();
  }, [id]);

  if (!grupo) {
    return <div className="text-center p-4">Cargando reporte...</div>;
  }

  return (
    <Container fluid className="reporte-container p-4">
      {/* ENCABEZADO */}
      <header className="reporte-header d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
        <div>
          <img src={logo} alt="Logo" style={{ height: "80px" }} />
          <h5 className="mt-2">Tampa Seguros</h5>
        </div>
        <div className="text-end">
          <h4 className="fw-bold">REPORTE GRUPO FAMILIAR</h4>
          <p>Fecha: {new Date().toLocaleDateString()}</p>
          <p>ID Grupo: {grupo.id}</p>
        </div>
      </header>

      {/* INFO GENERAL */}
      <section className="mb-4">
        <h5 className="border-bottom pb-2">Información General</h5>
        <p><strong>Tomador:</strong> {grupo.coberturas.find(c => c.parentesco === "TOMADOR")?.cliente?.nombre_completo || "-"}</p>
        <p><strong>Persona de Contacto:</strong> {grupo.persona_contacto || "-"}</p>
        <p><strong>Telefono de contacto:</strong> {grupo.telefonos.telefono_1 || "-"}</p>
        <p><strong>Personas en Cobertura:</strong> {grupo.personas_cobertura}</p>
        <p><strong>Personas en Taxes:</strong> {grupo.personas_taxes}</p>
        <p><strong>Ingreso Familiar Anual:</strong> {grupo.ingreso_familiar_anual ? `$${parseFloat(grupo.ingreso_familiar_anual).toLocaleString()}` : "No especificado"}</p>
      </section>

      {/* INTEGRANTES */}
      <section className="mb-4">
        <h5 className="border-bottom pb-2">Integrantes del Grupo</h5>

        {grupo.coberturas.map((c, index) => {
          const esTomador = c.parentesco?.toUpperCase() === "TOMADOR";

          return (
            <div
              key={c.id || index}
              className="card border mb-4 p-4 shadow-sm"
              style={{ backgroundColor: "#f9fafb", borderRadius: "12px" }}
            >
              <h5 className="mb-3">
                <strong>{c.cliente?.nombre_completo || "-"}</strong>
                {esTomador && (
                  <span className="badge bg-warning text-dark ms-2">TOMADOR</span>
                )}
              </h5>

              <div className="row mb-2">
                <div className="col-md-4"><strong>Parentesco:</strong> {c.parentesco || "-"}</div>
                <div className="col-md-4"><strong>Elegibilidad:</strong> {c.elegibilidad || "-"}</div>
                <div className="col-md-4"><strong>Año:</strong> {c.ano_cobertura || "-"}</div>
              </div>

              <div className="row mb-2">
                <div className="col-md-4"><strong>Plan:</strong> {c.plan || "-"}</div>
                <div className="col-md-4"><strong>Metal:</strong> {c.metal || "-"}</div>
                <div className="col-md-4"><strong>Red:</strong> {c.red || "-"}</div>
              </div>

              <div className="row mb-2">
                <div className="col-md-4"><strong>Pagador:</strong> {c.nombre_pagador || "-"}</div>
                <div className="col-md-4"><strong>Precio:</strong> ${parseFloat(c.precio || 0).toFixed(2)}</div>
              </div>

              <div className="row mb-2">
                <div className="col-md-4"><strong>Activación:</strong> {c.fecha_activacion ? new Date(c.fecha_activacion).toLocaleDateString() : "-"}</div>
                <div className="col-md-4"><strong>Cancelación:</strong> {c.fecha_cancelacion ? new Date(c.fecha_cancelacion).toLocaleDateString() : "-"}</div>
                <div className="col-md-4"><strong>Retiro:</strong> {c.fecha_retiro ? new Date(c.fecha_retiro).toLocaleDateString() : "-"}</div>
              </div>
              <div className="row mb-2">
                <div className="col-md-4"><strong>Motivo cancelacion:</strong> {c.motivo_cancelacion || "-"}</div>
                <div className="col-md-4"><strong>Nota cancelacion:</strong> {c.Nota_cancel || "-"}</div>
                
              </div>
            </div>
          );
        })}
      </section>

      {/* PIE */}
      <footer className="mt-5 pt-3 border-top text-center">
        <p>Este reporte fue generado automáticamente por el sistema Tampa Seguros.</p>
      </footer>
    </Container>
  );
};

export default ReporteGrupoFamiliar;

