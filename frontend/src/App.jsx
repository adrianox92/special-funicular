import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PrivateRoute from './components/PrivateRoute';
import VehicleList from './pages/VehicleList';
import Dashboard from './pages/Dashboard';
import AddVehicle from './components/AddVehicle';
import EditVehicle from './components/EditVehicle';
import TimingsList from './components/TimingsList';
import Competitions from './pages/Competitions';
import Circuits from './pages/Circuits';
import Inventory from './pages/Inventory';
import CompetitionParticipants from './pages/CompetitionParticipants';
import CompetitionTimings from './pages/CompetitionTimings';
import CompetitionSignup from './pages/CompetitionSignup';
import CompetitionStatus from './pages/CompetitionStatus';
import CompetitionPresentation from './pages/CompetitionPresentation';
import Profile from './pages/Profile';
import PublicPilotProfile from './pages/PublicPilotProfile';
import SettingsPage from './pages/SettingsPage';
import HelpPage from './pages/HelpPage';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Contact from './pages/Contact';
import SlotRaceManagerPage from './pages/SlotRaceManagerPage';
import AdminSlotRaceLicenses from './pages/AdminSlotRaceLicenses';
import AdminSlotCatalog from './pages/AdminSlotCatalog';
import SellerDashboard from './pages/SellerDashboard';
import PublicCatalogList from './pages/PublicCatalogList';
import PublicCatalogDetail from './pages/PublicCatalogDetail';
import CatalogMySuggestions from './pages/CatalogMySuggestions';
import ProposeCatalogInsert from './pages/ProposeCatalogInsert';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useCookieConsent } from './context/CookieConsentContext';
import CookieBanner from './components/CookieBanner';
import CookieSettingsDialog from './components/CookieSettingsDialog';
import InstallPWAButton from './components/InstallPWAButton';
import { logPWADiagnostics } from './utils/pwaDiagnostics';
import { Spinner } from './components/ui/spinner';
import { Toaster } from './components/ui/sonner';
import GlobalCommandPalette from './components/GlobalCommandPalette';
import HomeRoute from './components/HomeRoute';
import { CommandPaletteProvider } from './context/CommandPaletteContext';
import { getDocumentTitle, isPublicCatalogDetailPath } from './utils/documentTitle';

const PageLayout = ({ children }) => (
  <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-20">
    {children}
  </div>
);

const AuthedShell = ({ children }) => (
  <CommandPaletteProvider>
    <Navbar />
    <PageLayout>{children}</PageLayout>
    <Footer />
    <GlobalCommandPalette />
  </CommandPaletteProvider>
);

const AppContent = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const noNavbarRoutes = [
    '/',
    '/login',
    '/reset-password',
    '/slot-race-manager',
    '/competitions/signup',
    '/competitions/status',
    '/competitions/presentation',
    '/piloto',
    '/privacidad',
    '/terminos',
    '/contacto',
    '/catalogo',
  ];
  const hasNavbar = user && !noNavbarRoutes.some(r => location.pathname === r || location.pathname.startsWith(r + '/'));

  React.useEffect(() => {
    document.body.style.paddingTop = hasNavbar ? '4rem' : '0';
    return () => { document.body.style.paddingTop = '4rem'; };
  }, [hasNavbar]);

  React.useEffect(() => {
    // La ficha pública del catálogo fija título y metadescripción en `applyCatalogItemPageSeo`.
    if (isPublicCatalogDetailPath(location.pathname)) return;
    document.title = getDocumentTitle(location.pathname);
  }, [location.pathname]);

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
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacidad" element={<PrivacyPolicy />} />
        <Route path="/terminos" element={<TermsOfService />} />
        <Route path="/contacto" element={<Contact />} />
        <Route path="/slot-race-manager" element={<SlotRaceManagerPage />} />
        <Route path="/competitions/signup/:slug" element={<CompetitionSignup />} />
        <Route path="/competitions/status/:slug" element={<CompetitionStatus />} />
        <Route path="/competitions/presentation/:slug" element={<CompetitionPresentation />} />
        <Route path="/piloto/:slug" element={<PublicPilotProfile />} />
        <Route path="/catalogo/:id/:slug" element={<PublicCatalogDetail />} />
        <Route path="/catalogo/:id" element={<PublicCatalogDetail />} />
        <Route path="/catalogo" element={<PublicCatalogList />} />

        <Route
          path="/mis-sugerencias-catalogo"
          element={
            <PrivateRoute>
              <AuthedShell>
                <CatalogMySuggestions />
              </AuthedShell>
            </PrivateRoute>
          }
        />
        <Route
          path="/proponer-alta-catalogo"
          element={
            <PrivateRoute>
              <AuthedShell>
                <ProposeCatalogInsert />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <AuthedShell>
                <Dashboard />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/vehicles"
          element={
            <PrivateRoute>
              <AuthedShell>
                <VehicleList />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/vehicles/new"
          element={
            <PrivateRoute>
              <AuthedShell>
                <AddVehicle />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/vehicles/:id"
          element={
            <PrivateRoute>
              <AuthedShell>
                <EditVehicle />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/timings"
          element={
            <PrivateRoute>
              <AuthedShell>
                <TimingsList />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/circuits"
          element={
            <PrivateRoute>
              <AuthedShell>
                <Circuits />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/inventory"
          element={
            <PrivateRoute>
              <AuthedShell>
                <Inventory />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <AuthedShell>
                <Profile />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <AuthedShell>
                <SettingsPage />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/help"
          element={
            <PrivateRoute>
              <AuthedShell>
                <HelpPage />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/slot-race-licenses"
          element={
            <PrivateRoute>
              <AuthedShell>
                <AdminSlotRaceLicenses />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/slot-catalog"
          element={
            <PrivateRoute>
              <AuthedShell>
                <AdminSlotCatalog />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/seller"
          element={
            <PrivateRoute>
              <AuthedShell>
                <SellerDashboard />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/competitions"
          element={
            <PrivateRoute>
              <AuthedShell>
                <Competitions />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/competitions/:id/participants"
          element={
            <PrivateRoute>
              <AuthedShell>
                <CompetitionParticipants />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/competitions/:id/timings"
          element={
            <PrivateRoute>
              <AuthedShell>
                <CompetitionTimings />
              </AuthedShell>
            </PrivateRoute>
          }
        />
      </Routes>
    </div>
  );
};

const ConsentAwareVercelMetrics = () => {
  const { consent } = useCookieConsent();
  if (!consent.analytics) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div>
          <CookieBanner />
          <CookieSettingsDialog />
          <InstallPWAButton />
          <AppContent />
          <Toaster richColors position="top-right" />
          <ConsentAwareVercelMetrics />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
