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
import { logPWADiagnostics } from './utils/pwaDiagnostics';


// Componente principal de la aplicación
const AppContent = () => {
  const { user, loading } = useAuth();
  
  // Detectar si viene de PWA y logging para debug
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('source');
    
    if (source === 'pwa') {
      console.log('Aplicación abierta desde PWA icon');
      // Limpiar el parámetro de la URL sin recargar la página
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
    
    // Debug info para ayudar con el problema
    console.log('AppContent mounted:', {
      user: !!user,
      loading,
      pathname: window.location.pathname,
      search: window.location.search,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches
    });
    
    // Ejecutar diagnóstico PWA en desarrollo
    if (process.env.NODE_ENV === 'development') {
      logPWADiagnostics();
    }
  }, [user, loading]);

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
        
        {/* Rutas protegidas con layout */}
        <Route path="/dashboard" element={user ? (
          <>
            <Navbar />
            <Container className="flex-grow-1 pb-5" style={{ paddingTop: '80px' }}>
              <Dashboard />
            </Container>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />
        
        <Route path="/vehicles" element={user ? (
          <>
            <Navbar />
            <Container className="flex-grow-1 pb-5" style={{ paddingTop: '80px' }}>
              <VehicleList />
            </Container>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />
        
        <Route path="/vehicles/new" element={user ? (
          <>
            <Navbar />
            <Container className="flex-grow-1 pb-5" style={{ paddingTop: '80px' }}>
              <AddVehicle />
            </Container>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />
        
        <Route path="/vehicles/:id" element={user ? (
          <>
            <Navbar />
            <Container className="flex-grow-1 pb-5" style={{ paddingTop: '80px' }}>
              <EditVehicle />
            </Container>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />
        
        <Route path="/timings" element={user ? (
          <>
            <Navbar />
            <Container className="flex-grow-1 pb-5" style={{ paddingTop: '80px' }}>
              <TimingsList />
            </Container>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />
        
        <Route path="/competitions" element={user ? (
          <>
            <Navbar />
            <Container className="flex-grow-1 pb-5" style={{ paddingTop: '80px' }}>
              <Competitions />
            </Container>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />
        
        <Route path="/competitions/:id/participants" element={user ? (
          <>
            <Navbar />
            <Container className="flex-grow-1 pb-5" style={{ paddingTop: '80px' }}>
              <CompetitionParticipants />
            </Container>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />
        
        <Route path="/competitions/:id/timings" element={user ? (
          <>
            <Navbar />
            <Container className="flex-grow-1 pb-5" style={{ paddingTop: '80px' }}>
              <CompetitionTimings />
            </Container>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />
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