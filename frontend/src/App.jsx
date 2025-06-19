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
import LandingPage from './pages/LandingPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import InstallPWAButton from './components/InstallPWAButton';


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

  // Si no hay usuario, redirigir a la página principal
  if (!user) {
    return <Navigate to="/" replace />;
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

  return (
    <div className="d-flex flex-column min-vh-100">
      <Routes>
        {/* Rutas públicas */}
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/competitions/signup/:slug" element={<CompetitionSignup />} />
        <Route path="/competitions/status/:slug" element={<CompetitionStatus />} />
        <Route path="/competitions/presentation/:slug" element={<CompetitionPresentation />} />
        
        {/* Rutas protegidas */}
        <Route path="/dashboard" element={user ? <ProtectedLayout /> : <Navigate to="/" replace />} />
        <Route path="/vehicles/*" element={user ? <ProtectedLayout /> : <Navigate to="/" replace />} />
        <Route path="/timings" element={user ? <ProtectedLayout /> : <Navigate to="/" replace />} />
        <Route path="/competitions" element={user ? <ProtectedLayout /> : <Navigate to="/" replace />} />
        <Route path="/competitions/:id/*" element={user ? <ProtectedLayout /> : <Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

// Componente raíz que envuelve todo
function App() {
  return (
    <AuthProvider>
      <Router>
        <div>
          <InstallPWAButton />
          <AppContent />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App; 