import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";

import "bootstrap/dist/css/bootstrap.min.css";
import "react-toastify/dist/ReactToastify.css";
import "../styles/Login.css"; // Estilos personalizados
import logo from "../assets/tampa.jpg"; // Ruta del logo
import { useAuth } from "../context/AuthContext"; // Importa el contexto de autenticación

const Login = () => {
  const navigate = useNavigate(); // Hook para redireccionar
  const { login } = useAuth(); // Hook para login
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        toast.success("Inicio de sesión exitoso");
        navigate("/"); // Redirigir al Dashboard
      } else {
        // Mostrar el mensaje del backend directamente
        // No construir mensajes de negocio aquí
        const errorMessage = result.error || "Error al iniciar sesión";
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      // Manejar errores de conexión
      let errorMessage = "Error al iniciar sesión";
      
      if (err.message && err.message.includes("Failed to fetch")) {
        errorMessage = "Error de conexión con el servidor";
      } else {
        // Mostrar el mensaje del error directamente
        errorMessage = err.message || "Error al iniciar sesión";
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
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


          <button 
            type="submit" 
            className="btn custom-btn w-100 fw-bold"
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default Login;
