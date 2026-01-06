// src/services/axios.js
// Configuración de Axios con interceptores para autenticación

import axios from 'axios';

// Obtener la URL base desde las variables de entorno
const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Crear instancia de axios
const axiosInstance = axios.create({
  baseURL: API_BASE_URL.replace(/\/+$/, ''), // Eliminar barras finales
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Interceptor para agregar token Bearer en cada petición
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores 401 (redirigir a login)
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Limpiar token inválido
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('roles');
      localStorage.removeItem('permissions');
      
      // Redirigir a login si no estamos ya ahí
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

