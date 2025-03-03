// src/layout/MainLayout.jsx
import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import "../styles/MainLayout.css";

const MainLayout = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="dashboard-container">
      <Sidebar isOpen={isOpen} toggleSidebar={toggleSidebar} />
      <div className={`main-content ${isOpen ? "expanded" : "collapsed"}`}>
        <div className="dashboard-content">{children}</div>
      </div>
    </div>
  );
};

export default MainLayout;

