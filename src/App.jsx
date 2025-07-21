import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Cliente from "./pages/Clientes";
import Grupofamiliar from "./pages/Grupofamiliar";

import ImportarClientesPage from "./pages/ImportarClientesPage";
import Login from "./pages/login";
import MediosPago from "./components/MediosPago";
import MediosPagoManager from './pages/MediosPagoManager';
import GruposFamiliaresListado from "./pages/GruposFamiliaresListado";
import ReporteGrupoFamiliar from "../src/components/Reports/ReporteGrupoFamiliar";
import ListaClientes from "./pages/ListaClientes";
import GrupofamiliarCreate from "./components/GrupoFamiliar/GrupofamiliarCreate";
import GrupofamiliarEdit from "./components/GrupoFamiliar/GrupofamiliarEdit";
import Auditoria from "./components/Auditoria";
import CentroOperaciones from "./pages/CentroOperaciones";
import PagosGenerar from './pages/PagosGenerar';
import PagosActualizar from './pages/PagosActualizar';
import PagosInforme from './pages/PagosInforme';
import InformeCliente from './pages/InformeCliente'
import GrupoFamiliarHistorial from "./components/Reports/GrupoFamiliarHistorial";
import RequerimientosAdmin from "./pages/RequerimientosAdmin";
import DetalleClientePage from "./pages/DetalleClientePage";


// Función para verificar si el usuario está autenticado
const isAuthenticated = () => {
  return localStorage.getItem("auth_token") !== null;
};

// Layout protegido que envuelve todas las páginas
const ProtectedLayout = () => {
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [isAuth, setIsAuth] = React.useState(false);

  React.useEffect(() => {
    const token = localStorage.getItem("auth_token");
    setIsAuth(!!token); // true si existe token
    setCheckingAuth(false);
  }, []);

  if (checkingAuth) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <p>Verificando sesión...</p>
      </div>
    );
  }

  return isAuth ? <MainLayout><Outlet /></MainLayout> : <Navigate to="/login" />;
};


const App = () => {
  return (
    <Routes>
      {/* Página de Login (pública) */}
      <Route path="/login" element={<Login />} />
      <Route path="/grupo-familiar/:id/reporte" element={<ReporteGrupoFamiliar />} />
      <Route path="/grupo-familiar/:id/historial" element={<GrupoFamiliarHistorial />} />
      {/* Rutas protegidas dentro del MainLayout */}
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes/crear" element={<Cliente />} />
        
     
        <Route path="/Herramientas" element={<ImportarClientesPage />} />
        <Route path="/Herramientas/auditoria" element={<Auditoria />} />
        <Route path="/herramientas/operaciones" element={<CentroOperaciones />} />
        

        <Route path="/Mediospago" element={<MediosPago />} />
        <Route path="clientes/mediopago/:clienteId" element={<MediosPagoManager />} />
        <Route path="/grupofamiliar/lista" element={<GruposFamiliaresListado/>}/>
        <Route path="/clientes/lista" element={<ListaClientes/>}/>
        <Route path="/grupofamiliar/crear" element={<GrupofamiliarCreate />} />
        <Route path="/grupo-familiar/:id/editar" element={<GrupofamiliarEdit />} />
        <Route path="/grupofamiliar/RequerimientosAdmin" element={<RequerimientosAdmin />} />

        <Route path="/Pagos/Generarpagos" element={<PagosGenerar />} />
        <Route path="/Pagos/pagos" element={<PagosActualizar />} />
        <Route path="/Pagos/cartera" element={<PagosInforme />} />

        <Route path="/informes/historialCliente" element={<InformeCliente />} />
        <Route path="/clientes/:id/detalle" element={<DetalleClientePage />} />

      
      </Route>

      {/* Redirigir a login si la ruta no existe */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
};

export default App;
