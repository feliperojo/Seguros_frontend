import GruposFamiliaresListado from "./pages/GruposFamiliaresListado";
import ReporteGrupoFamiliar from "./components/Reports/ReporteGrupoFamiliar";
//aqui no son las rutas
const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Dashboard />} />
    
    {/* Rutas de Cliente */}
    <Route path="/clientes/lista" element={<ClientesLista />} />
    <Route path="/clientes/crear" element={<CrearCliente />} />
    <Route path="/clientes/editar/:id" element={<EditarCliente />} /> {/* Nueva ruta */}
    
    {/* Rutas de Grupo Familiar */}
    <Route path="/grupofamiliar" element={<Grupofamiliar />} />
    {/* <Route path="/grupofamiliar/crear" element={<CrearGrupoFamiliar />} /> */}
    <Route path="/grupofamiliar/vencimientos" element={<ProximosVencimientos />} />
    <Route path="/grupofamiliar/lista" element={<GruposFamiliaresListado />} />
    <Route path="/grupo-familiar/:id/reporte" element={<ReporteGrupoFamiliar />} />



    {/* Otras rutas... */}
    <Route path="/informes" element={<Informes />} />
    <Route path="/informes/clientes" element={<InformesClientes />} />
    <Route path="/informes/polizas" element={<InformesPolizas />} />
    <Route path="/herramientas" element={<Herramientas />} />
    <Route path="/exportar-datos" element={<ExportarDatos />} />
  </Routes>
);



export default AppRoutes;