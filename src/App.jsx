import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Cliente from "./pages/Clientes";
import Grupofamiliar from "./pages/Grupofamiliar";
import Informes from "./pages/Informes";
import ImportarClientesPage from "./pages/ImportarClientesPage";
import Login from "./pages/login";
import MediosPago from "./components/MediosPago";
import MediosPagoManager from './pages/MediosPagoManager';
import GruposFamiliaresListado from "./pages/GruposFamiliaresListado";

import ListaClientes from "./pages/ListaClientes";

// Función para verificar si el usuario está autenticado
const isAuthenticated = () => {
  return localStorage.getItem("auth_token") !== null;
};

// Layout protegido que envuelve todas las páginas
const ProtectedLayout = () => {
  return isAuthenticated() ? <MainLayout><Outlet /></MainLayout> : <Navigate to="/login" />;
};

const App = () => {
  return (
    <Routes>
      {/* Página de Login (pública) */}
      <Route path="/login" element={<Login />} />

      {/* Rutas protegidas dentro del MainLayout */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes/crear" element={<Cliente />} />
        <Route path="/grupofamiliar/crear" element={<Grupofamiliar />} />
        <Route path="/informes" element={<Informes />} />
        <Route path="/Herramientas" element={<ImportarClientesPage />} />
        <Route path="/Mediospago" element={<MediosPago />} />
        <Route path="clientes/mediopago/:clienteId" element={<MediosPagoManager />} />
        <Route path="/grupofamiliar/lista" element={<GruposFamiliaresListado/>}/>
        <Route path="/clientes/lista" element={<ListaClientes/>}/>
      
      </Route>

      {/* Redirigir a login si la ruta no existe */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
};

export default App;
