import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Team from "./pages/Team";
import Projects from "./pages/Projects";

const AppRoutes = () => {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/team" element={<Team />} />
          <Route path="/projects" element={<Projects />} />
          
        </Routes>
      </MainLayout>
    </Router>
  );
};

export default AppRoutes;

