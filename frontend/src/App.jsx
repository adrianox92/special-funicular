import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import VehicleList from './pages/VehicleList';
import Dashboard from './pages/Dashboard';
import AddVehicle from './components/AddVehicle';
import EditVehicle from './components/EditVehicle';
import TimingsList from './components/TimingsList';
import Competitions from './pages/Competitions';
import CompetitionParticipants from './pages/CompetitionParticipants';
import CompetitionTimings from './pages/CompetitionTimings';
import CompetitionSignup from './pages/CompetitionSignup';
import CompetitionStatus from './pages/CompetitionStatus';
import CompetitionPresentation from './pages/CompetitionPresentation';
import Login from './components/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Componente para el layout protegido
const ProtectedLayout = () => {
  const { user, loading } = useAuth();

  // Si está cargando, mostrar un spinner
  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </Container>
    );
  }

  // Si no hay usuario, redirigir al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si hay usuario, mostrar el layout protegido
  return (
    <>
      <Navbar />
      <Container className="flex-grow-1 pb-5">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vehicles" element={<VehicleList />} />
          <Route path="/vehicles/new" element={<AddVehicle />} />
          <Route path="/vehicles/:id" element={<EditVehicle />} />
          <Route path="/timings" element={<TimingsList />} />
          <Route path="/competitions" element={<Competitions />} />
          <Route path="/competitions/:id/participants" element={<CompetitionParticipants />} />
          <Route path="/competitions/:id/timings" element={<CompetitionTimings />} />
        </Routes>
      </Container>
      <Footer />
    </>
  );
};

// Componente principal de la aplicación
const AppContent = () => {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/competitions/signup/:slug" element={<CompetitionSignup />} />
        <Route path="/competitions/status/:slug" element={<CompetitionStatus />} />
        <Route path="/competitions/presentation/:slug" element={<CompetitionPresentation />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </div>
  );
};

// Componente raíz que envuelve todo
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App; 