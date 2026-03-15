import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import VehicleList from './pages/VehicleList';
import Dashboard from './pages/Dashboard';
import AddVehicle from './components/AddVehicle';
import EditVehicle from './components/EditVehicle';
import TimingsList from './components/TimingsList';
import Competitions from './pages/Competitions';
import Circuits from './pages/Circuits';
import CompetitionParticipants from './pages/CompetitionParticipants';
import CompetitionTimings from './pages/CompetitionTimings';
import CompetitionSignup from './pages/CompetitionSignup';
import CompetitionStatus from './pages/CompetitionStatus';
import CompetitionPresentation from './pages/CompetitionPresentation';
import Profile from './pages/Profile';
import Login from './components/Login';
import LandingPage from './pages/LandingPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import InstallPWAButton from './components/InstallPWAButton';
import { logPWADiagnostics } from './utils/pwaDiagnostics';
import { Spinner } from './components/ui/spinner';

const PageLayout = ({ children }) => (
  <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-20">
    {children}
  </div>
);

const AppContent = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const noNavbarRoutes = ['/', '/login', '/competitions/signup', '/competitions/status', '/competitions/presentation'];
  const hasNavbar = user && !noNavbarRoutes.some(r => location.pathname === r || location.pathname.startsWith(r + '/'));

  React.useEffect(() => {
    document.body.style.paddingTop = hasNavbar ? '4rem' : '0';
    return () => { document.body.style.paddingTop = '4rem'; };
  }, [hasNavbar]);

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('source');

    if (source === 'pwa') {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }

    if (process.env.NODE_ENV === 'development') {
      logPWADiagnostics();
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner className="size-8" />
        <span className="sr-only">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/competitions/signup/:slug" element={<CompetitionSignup />} />
        <Route path="/competitions/status/:slug" element={<CompetitionStatus />} />
        <Route path="/competitions/presentation/:slug" element={<CompetitionPresentation />} />

        <Route path="/dashboard" element={user ? (
          <>
            <Navbar />
            <PageLayout><Dashboard /></PageLayout>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />

        <Route path="/vehicles" element={user ? (
          <>
            <Navbar />
            <PageLayout><VehicleList /></PageLayout>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />

        <Route path="/vehicles/new" element={user ? (
          <>
            <Navbar />
            <PageLayout><AddVehicle /></PageLayout>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />

        <Route path="/vehicles/:id" element={user ? (
          <>
            <Navbar />
            <PageLayout><EditVehicle /></PageLayout>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />

        <Route path="/timings" element={user ? (
          <>
            <Navbar />
            <PageLayout><TimingsList /></PageLayout>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />

        <Route path="/circuits" element={user ? (
          <>
            <Navbar />
            <PageLayout><Circuits /></PageLayout>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />

        <Route path="/profile" element={user ? (
          <>
            <Navbar />
            <PageLayout><Profile /></PageLayout>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />

        <Route path="/competitions" element={user ? (
          <>
            <Navbar />
            <PageLayout><Competitions /></PageLayout>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />

        <Route path="/competitions/:id/participants" element={user ? (
          <>
            <Navbar />
            <PageLayout><CompetitionParticipants /></PageLayout>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />

        <Route path="/competitions/:id/timings" element={user ? (
          <>
            <Navbar />
            <PageLayout><CompetitionTimings /></PageLayout>
            <Footer />
          </>
        ) : <Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

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
