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
import GruposFamiliaresConTags from "./pages/GruposFamiliaresConTags";
import ReporteGrupoFamiliar from "../src/components/Reports/ReporteGrupoFamiliar";
import ReporteGruposFamiliaresClasificados from "./components/Reports/ReporteGruposFamiliaresClasificados";
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
import ReporteCoberturasPage from "./pages/ReporteCoberturasPage";
import DetalleClientePage from "./pages/DetalleClientePage";
import Porspectopage from "./pages/Prospecto";
import GrupoFamiliarDetail from "./pages/GrupoFamiliarDetail";
import ContactosAdmin from "./pages/ContactosAdmin";
import AuditoriasPage from "./pages/AuditoriasPage";
import AuditoriaRunDetallePage from "./pages/AuditoriaRunDetallePage";

import FichaClienteLayout from "./pages/FichaClienteLayout";
import FichaClienteGeneral from "./pages/tabs/FichaClienteGeneral";
import FichaClienteHistorial from "./pages/tabs/FichaClienteHistorial";
import FichaClienteRingCentral from "./pages/tabs/FichaClienteRingCentral";
import FichaClienteComentarios from "./pages/tabs/FichaClienteComentarios";
import FichaClienteCalendario from "./pages/tabs/FichaClienteCalendario";
import FichaClienteAuditorias from "./pages/tabs/FichaClienteAuditorias";

// Módulo de Administración
import UsersList from "./pages/admin/UsersList";
import RolesList from "./pages/admin/RolesList";
import RolePermissions from "./pages/admin/RolePermissions";
import PermissionsList from "./pages/admin/PermissionsList";
import AuditLogsList from "./pages/admin/AuditLogsList";
import OperationalConceptsAdmin from "./pages/admin/OperationalConceptsAdmin";

import { ProtectedRoute, PermissionRoute } from "./routes/ProtectedRoute";
import CallIdentifierContainer from "./components/CallIdentifier/CallIdentifierContainer";

// Layout protegido que envuelve todas las páginas
const ProtectedLayout = () => {
  return (
    <ProtectedRoute>
      <MainLayout>
        <Outlet />
      </MainLayout>
    </ProtectedRoute>
  );
};


const App = () => {
  return (
    <>
      {/* Identificador de llamadas (siempre activo) */}
      <CallIdentifierContainer />
      
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
        <Route path="/grupofamiliar/lista-etiquetas" element={<GruposFamiliaresConTags/>}/>
        <Route path="/grupofamiliar/reporte-clasificado" element={<ReporteGruposFamiliaresClasificados/>}/>
        <Route path="/clientes/lista" element={<ListaClientes/>}/>
        <Route path="/grupofamiliar/crear" element={<GrupofamiliarCreate />} />
        <Route path="/grupo-familiar/:id/editar" element={<GrupofamiliarEdit />} />
        <Route path="/grupofamiliar/RequerimientosAdmin" element={<RequerimientosAdmin />} />
        <Route path="/grupofamiliar/prospecto" element={<Porspectopage />} />
        <Route path="/grupo_familiar/:id" element={<GrupoFamiliarDetail />} />

        <Route path="/Pagos/Generarpagos" element={<PagosGenerar />} />
        <Route path="/Pagos/pagos" element={<PagosActualizar />} />
        <Route path="/Pagos/cartera" element={<PagosInforme />} />

        <Route path="/informes/historialCliente" element={<InformeCliente />} />
        <Route path="/informes/coberturas" element={<ReporteCoberturasPage />} />
        <Route path="/clientes/:id/detalle" element={<DetalleClientePage />} />
        <Route path="/grupodamiliar/prospecto" element={<DetalleClientePage />} />
        <Route path="/clientes/contacto" element={<ContactosAdmin />} />
        
        {/* Rutas de Auditorías */}
        <Route path="/auditorias" element={<AuditoriasPage />} />
        <Route path="/auditorias/:runId" element={<AuditoriaRunDetallePage />} />
        
        {/* Rutas del Módulo de Administración - Protegidas por permisos */}
        <Route
          path="/admin/users"
          element={
            <PermissionRoute permission="users.view">
              <UsersList />
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <PermissionRoute permission="roles.view">
              <RolesList />
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/roles/:id/permissions"
          element={
            <PermissionRoute permission="roles.assign_permissions">
              <RolePermissions />
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/permissions"
          element={
            <PermissionRoute permission="permissions.view">
              <PermissionsList />
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <PermissionRoute permission="users.view">
              <AuditLogsList />
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/operational-concepts"
          element={
            <OperationalConceptsAdmin />
          }
        />
      
      </Route>
      {/* 🔹 Ficha con tabs: layout + rutas hijas */}
      <Route path="/clientes/:id/ficha" element={<FichaClienteLayout />}>
          {/* index = pestaña "General" */}
          <Route path="clientes" element={<ListaClientes />} />

          <Route index element={<FichaClienteGeneral />} />
          <Route path="historial" element={<FichaClienteHistorial />} />
          <Route path="ringcentral" element={<FichaClienteRingCentral />} />
          <Route path="calendario" element={<FichaClienteCalendario />} />
          <Route path="comentarios" element={<FichaClienteComentarios />} />
          <Route path="auditorias" element={<FichaClienteAuditorias />} />
          <Route path="directorio" element={<ContactosAdmin />} />
          {/* cuando tengas más pestañas, las agregas aquí:
              <Route path="historial" element={<FichaClienteHistorial />} />
              <Route path="tareas" element={<FichaClienteTareas />} />
              ...
          */}
        </Route>
     
      {/* Redirigir a login si la ruta no existe */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
    </>
  );
};

export default App;
