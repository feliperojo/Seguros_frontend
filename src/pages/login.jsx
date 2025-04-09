import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";

import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Login.css"; // Estilos personalizados
import logo from "../assets/tampa.jpg"; // Ruta del logo
import apiRequest from "../services/api"; // Importa el servicio de API

const Login = () => {
  const navigate = useNavigate(); // Hook para redireccionar
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState(null); // Estado para mensajes de error

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Reiniciar el estado de error antes de la petición

    try {
      const response = await apiRequest("login", "POST", formData);

      if (response.token) {
        localStorage.setItem("auth_token", response.token); // Guardar token en localStorage
        localStorage.setItem("name", response.user.name);
        navigate("/"); // Redirigir al Dashboard
      } else {
        throw new Error("Datos de usuario incorrectos");
      }
    } catch (err) {
      if (err.message.includes("Failed to fetch")) {
        setError("No se pudo conectar con el servidor. Intente más tarde.");
      } else {
        setError("Datos de usuario incorrectos");
      }
    }
  };

  return (
    <div className="container-fluid d-flex justify-content-center align-items-center vh-100 bg-light ">
      <div
        className="card p-4 shadow text-center"
        style={{
          width: "100%",
          maxWidth: "400px",
          borderRadius: "15px",
          border: "1px solid #e0e0e0",
        }}
      >
        {/* Logo centrado más grande */}
        <div className="text-center mb-4">
          <img
            src={logo}
            alt="Logo"
            className="img-fluid"
            style={{
              maxWidth: "150px", // Se aumentó el tamaño
              height: "auto",
            }}
          />
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="alert alert-danger text-center py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4 text-start ">
            <label className="form-label fw-bold label-custom">Usuario</label>
            <input
              type="email"
              name="email"
              className="form-control rounded-3"
              placeholder="Correo"
              value={formData.email}
              onChange={handleChange}
              required
              style={{ padding: "12px", border: "1px solid #ccc" }}
            />
          </div>

          <div className="mb-4 text-start position-relative">
  <label className="form-label fw-bold label-custom">Contraseña</label>
  <input
    type={showPassword ? "text" : "password"}
    name="password"
    className="form-control rounded-3 pe-5"
    placeholder="Contraseña"
    value={formData.password}
    onChange={handleChange}
    required
    style={{ padding: "12px", border: "1px solid #ccc" }}
  />
  <span
    onClick={() => setShowPassword(!showPassword)}
    style={{
      position: "absolute",
      right: "15px",
      top: "42px",
      cursor: "pointer",
      color: "#666",
    }}
  >
    {showPassword ? <FaEyeSlash /> : <FaEye />}
  </span>
</div>


          <button type="submit" className="btn custom-btn w-100 fw-bold">
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
