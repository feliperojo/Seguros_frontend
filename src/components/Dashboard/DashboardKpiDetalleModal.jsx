import React, { useEffect, useState } from "react";
import { Modal, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import apiRequest from "../../services/api";
import { ordenarResumenGrupos } from "../../constants/estadosGrupoFamiliar";

const COBERTURA_ITEMS = [
  {
    key: "si",
    label: "Sí",
    color: "#34a853",
    descripcion: "Con cobertura activa y vigente",
    activo: true,
    vigente: true,
  },
  {
    key: "no",
    label: "No",
    color: "#6c757d",
    descripcion: "Sin cobertura",
    activo: true,
    vigente: false,
  },
  {
    key: "medicare",
    label: "Medicare",
    color: "#4285f4",
    descripcion: "Estado Medicare",
    activo: true,
    vigente: false,
  },
  {
    key: "medicaid",
    label: "Medicaid",
    color: "#1a73e8",
    descripcion: "Estado Medicaid",
    activo: true,
    vigente: false,
  },
  {
    key: "cotizacion",
    label: "Cotización",
    color: "#f9ab00",
    descripcion: "Grupo familiar en flujo de cotización (estados 1–4)",
    activo: true,
  },
];

function formatearCriterioBooleano(valor) {
  if (valor === null || valor === undefined) return "cualquiera";
  return valor ? "true" : "false";
}

function DetalleFila({ label, valor, color, descripcion, criterios, icon: Icon }) {
  return (
    <div
      className="dashboard-kpi-detalle-item"
      style={{ borderLeftColor: color || "#1a3964" }}
    >
      <div className="dashboard-kpi-detalle-item__info">
        {Icon && (
          <span className="dashboard-kpi-detalle-item__icon" style={{ color: color || "#1a3964" }}>
            <Icon />
          </span>
        )}
        <div>
          <span className="dashboard-kpi-detalle-item__label">{label}</span>
          {descripcion && (
            <span className="dashboard-kpi-detalle-item__desc">{descripcion}</span>
          )}
          {criterios && (
            <span className="dashboard-kpi-detalle-item__criterios">
              <span>activo: <strong>{formatearCriterioBooleano(criterios.activo)}</strong></span>
              {"vigente" in criterios && (
                <span>vigente: <strong>{formatearCriterioBooleano(criterios.vigente)}</strong></span>
              )}
            </span>
          )}
        </div>
      </div>
      <span className="dashboard-kpi-detalle-item__value">{valor}</span>
    </div>
  );
}

export default function DashboardKpiDetalleModal({
  show,
  tipo,
  onHide,
  estadisticas,
}) {
  const [resumenGrupos, setResumenGrupos] = useState([]);
  const [cargandoGrupos, setCargandoGrupos] = useState(false);
  const [errorGrupos, setErrorGrupos] = useState(null);

  useEffect(() => {
    if (!show || tipo !== "grupos") return;

    let activo = true;
    setCargandoGrupos(true);
    setErrorGrupos(null);

    apiRequest("estados/resumen-grupos", "GET")
      .then((res) => {
        if (!activo) return;
        const datos = res?.data || res || [];
        setResumenGrupos(Array.isArray(datos) ? datos : []);
      })
      .catch(() => {
        if (!activo) return;
        setErrorGrupos("No se pudo cargar el detalle de grupos.");
        setResumenGrupos([]);
      })
      .finally(() => {
        if (activo) setCargandoGrupos(false);
      });

    return () => {
      activo = false;
    };
  }, [show, tipo]);

  const titulos = {
    clientes: "Detalle de Clientes",
    grupos: "Detalle de Grupos Familiares",
    coberturas: "Detalle — Estado de Coberturas",
    canceladas: "Coberturas Canceladas",
    retiradas: "Coberturas Retiradas",
  };

  const enlaces = {
    clientes: "/clientes/lista",
    grupos: "/Grupofamiliar/lista",
  };

  const detalleClientes = estadisticas?.detalleClientes || {};
  const polizasActivas = estadisticas?.polizasActivas || {};
  const estadosGrupo = ordenarResumenGrupos(resumenGrupos);

  const renderContenido = () => {
    if (tipo === "clientes") {
      return (
        <>
          <p className="dashboard-kpi-detalle-intro">
            Personas registradas según su tipo en el sistema.
          </p>
          <div className="dashboard-kpi-detalle-list">
            <DetalleFila
              label="Clientes"
              valor={detalleClientes.clientes ?? estadisticas?.totalClientes ?? 0}
              color="#1a73e8"
              descripcion="Personas con estado Cliente"
            />
            <DetalleFila
              label="Contactos"
              valor={detalleClientes.contactos ?? 0}
              color="#34a853"
              descripcion="Personas de contacto registradas"
            />
            {(detalleClientes.empresas ?? 0) > 0 && (
              <DetalleFila
                label="Empresas"
                valor={detalleClientes.empresas}
                color="#9334e6"
                descripcion="Contactos tipo empresa"
              />
            )}
            {(detalleClientes.prospectos ?? 0) > 0 && (
              <DetalleFila
                label="Prospectos"
                valor={detalleClientes.prospectos}
                color="#fbbc04"
                descripcion="Personas en etapa prospecto"
              />
            )}
          </div>
        </>
      );
    }

    if (tipo === "grupos") {
      if (cargandoGrupos) {
        return (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            Cargando estados...
          </div>
        );
      }

      if (errorGrupos) {
        return <p className="text-muted mb-0">{errorGrupos}</p>;
      }

      return (
        <>
          <p className="dashboard-kpi-detalle-intro">
            Grupos familiares según su estado actual en el flujo de trabajo.
          </p>
          <div className="dashboard-kpi-detalle-list">
            {estadosGrupo.map(({ key, valor, config }) => (
              <DetalleFila
                key={key}
                label={config.label}
                valor={valor}
                color={config.color}
                icon={config.icon}
              />
            ))}
          </div>
          <p className="dashboard-kpi-detalle-total mt-3 mb-0">
            Total grupos: <strong>{estadisticas?.totalGruposFamiliares ?? 0}</strong>
          </p>
        </>
      );
    }

    if (tipo === "coberturas") {
      return (
        <>
          <p className="dashboard-kpi-detalle-intro">
            Pólizas con <strong>activo = true</strong>, clasificadas por estado de cobertura.
          </p>
          <div className="dashboard-kpi-detalle-list">
            {COBERTURA_ITEMS.map(({ key, label, color, descripcion, activo, vigente }) => (
              <DetalleFila
                key={key}
                label={label}
                valor={polizasActivas[key] ?? 0}
                color={color}
                descripcion={descripcion}
                criterios={vigente != null ? { activo, vigente } : { activo }}
              />
            ))}
          </div>
          <p className="dashboard-kpi-detalle-total mt-3 mb-0">
            Total: <strong>{polizasActivas.total ?? 0}</strong>
          </p>
        </>
      );
    }

    if (tipo === "canceladas") {
      return (
        <>
          <p className="dashboard-kpi-detalle-intro">
            Pólizas con <strong>estado_cobertura = No</strong>,{" "}
            <strong>activo = true</strong>, <strong>vigente = false</strong> y{" "}
            <strong>fecha de cancelación</strong> registrada.
          </p>
          <div className="dashboard-kpi-detalle-list">
            <DetalleFila
              label="Canceladas"
              valor={estadisticas?.polizasCanceladas ?? 0}
              color="#ea4335"
              criterios={{ activo: true, vigente: false }}
              descripcion="estado_cobertura = No + fecha_cancelacion"
            />
          </div>
        </>
      );
    }

    if (tipo === "retiradas") {
      return (
        <>
          <p className="dashboard-kpi-detalle-intro">
            Pólizas con <strong>activo = false</strong>, <strong>vigente = false</strong>,{" "}
            <strong>fecha de cancelación</strong> y <strong>fecha de retiro</strong> registradas.
          </p>
          <div className="dashboard-kpi-detalle-list">
            <DetalleFila
              label="Retiradas"
              valor={estadisticas?.polizasRetiradas ?? 0}
              color="#ea4335"
              criterios={{ activo: false, vigente: false }}
              descripcion="fecha_cancelacion + fecha_retiro"
            />
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <Modal show={show} onHide={onHide} centered size="md" className="dashboard-kpi-modal">
      <Modal.Header closeButton>
        <Modal.Title>{titulos[tipo] || "Detalle"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{renderContenido()}</Modal.Body>
      {enlaces[tipo] && (
        <Modal.Footer className="border-0 pt-0">
          <Link to={enlaces[tipo]} className="btn btn-sm btn-outline-primary" onClick={onHide}>
            Ver listado completo
          </Link>
        </Modal.Footer>
      )}
    </Modal>
  );
}
