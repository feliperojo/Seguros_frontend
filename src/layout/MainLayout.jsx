// src/layout/MainLayout.jsx
import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import "../styles/MainLayout.css";

import apiRequest from "../services/api"; // o ajusta la ruta según tu proyecto
import { Link } from "react-router-dom";

const MainLayout = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [pendientes, setPendientes] = useState(0);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };



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
      <Sidebar isOpen={isOpen} toggleSidebar={toggleSidebar} />
      <div className={`main-content ${isOpen ? "expanded" : "collapsed"}`}>
       
      <div className="topbar d-flex justify-content-end align-items-center p-3">
            <Link
              to="/Herramientas/operaciones"
              className="position-relative text-decoration-none text-dark"
              title="Centro de Operaciones"
            >
              <i className="bi bi-bell fs-4"></i>
              {pendientes > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                  {pendientes}
                </span>
              )}
            </Link>
          </div>

        <div className="dashboard-content">{children}</div>
      </div>
    </div>
  );
};

export default MainLayout;

