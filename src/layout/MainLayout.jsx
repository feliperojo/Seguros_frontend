import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import "../styles/MainLayout.css";
import apiRequest from "../services/api";
import { Link } from "react-router-dom";

const MainLayout = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const sidebarRef = useRef(null);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (e) => {
    if (
      sidebarRef.current &&
      !sidebarRef.current.contains(e.target) &&
      isOpen
    ) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const fetchPendientes = async () => {
      try {
        const res = await apiRequest("tareas_operativas/pendientes", "GET");
        setPendientes(res.pendientes || 0);
      } catch (error) {
        console.warn("No se pudieron obtener tareas pendientes");
      }
    };
    fetchPendientes();
  }, []);

  return (
    <div className="dashboard-container">
      <div ref={sidebarRef}>
        <Sidebar isOpen={isOpen} toggleSidebar={toggleSidebar} />
      </div>
      <div className={`main-content ${isOpen ? "expanded" : "collapsed"}`}>
      <div className="topbar d-flex justify-content-end align-items-center p-0">

  {pendientes > 0 && (
   <div
   className="tarea-alerta-wrapper"
   data-tooltip={`Tienes ${pendientes} tarea${pendientes > 1 ? 's' : ''} pendiente${pendientes > 1 ? 's' : ''}`}
 >
   <Link
     to="/Herramientas/operaciones"
     className="tarea-alerta-button"
   >
     <i className="bi bi-bell-fill"></i>
     <span className="tarea-badge">
       {pendientes > 99 ? '99+' : pendientes}
     </span>
   </Link>
 </div>
 

  )}
</div>

        <div className="dashboard-content">{children}</div>
      </div>
    </div>
  );
};

export default MainLayout;