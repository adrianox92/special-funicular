import React from 'react';
import { I18nextProvider } from 'react-i18next';
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
import Leagues from './pages/Leagues';
import LeagueCreate from './pages/LeagueCreate';
import LeagueDetail from './pages/LeagueDetail';
import LeagueSignup from './pages/LeagueSignup';
import LeagueStandings from './pages/LeagueStandings';
import Clubs from './pages/Clubs';
import ClubMembers from './pages/ClubMembers';
import PendingInviteConsumer from './components/PendingInviteConsumer';
import Circuits from './pages/Circuits';
import Inventory from './pages/Inventory';
import CompetitionParticipants from './pages/CompetitionParticipants';
import FavoritePilots from './pages/FavoritePilots';
import CompetitionTimings from './pages/CompetitionTimings';
import CompetitionRefereeView from './pages/CompetitionRefereeView';
import PublicRefereeView from './pages/PublicRefereeView';
import CompetitionSignup from './pages/CompetitionSignup';
import PublicClubProfile from './pages/PublicClubProfile';
import CompetitionStatus from './pages/CompetitionStatus';
import CompetitionPresentation from './pages/CompetitionPresentation';
import AppTimingRedirect from './pages/AppTimingRedirect';
import Profile from './pages/Profile';
import PublicPilotProfile from './pages/PublicPilotProfile';
import SettingsPage from './pages/SettingsPage';
import DebugDataPathPage from './pages/DebugDataPathPage';
import HelpPage from './pages/HelpPage';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Contact from './pages/Contact';
import SlotRaceManagerPage from './pages/SlotRaceManagerPage';
import AdminSlotRaceLicenses from './pages/AdminSlotRaceLicenses';
import AdminSlotCatalog from './pages/AdminSlotCatalog';
import Changelog from './pages/Changelog';
import AdminChangelog from './pages/AdminChangelog';
import AdminPlatformDashboard from './pages/AdminPlatformDashboard';
import AdminLapTimerLicensesPage from './pages/AdminLapTimerLicensesPage';
import SellerDashboard from './pages/SellerDashboard';
import PublicCatalogList from './pages/PublicCatalogList';
import PublicCatalogEntry from './pages/PublicCatalogEntry';
import CatalogMySuggestions from './pages/CatalogMySuggestions';
import ProposeCatalogInsert from './pages/ProposeCatalogInsert';
import PoliciesPage from './pages/PoliciesPage';
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
import i18n from './i18n';
import { useTranslation } from 'react-i18next';
import { stripLocalePrefix } from './i18n/localeUtils';
import LocalePrefixRedirect from './components/LocalePrefixRedirect';

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
  const { t, i18n: i18nInstance } = useTranslation('common');
  const location = useLocation();
  const noNavbarRoutes = [
    '/',
    '/login',
    '/reset-password',
    '/slot-race-manager',
    '/competitions/signup',
    '/competitions/status',
    '/competitions/presentation',
    '/leagues/signup',
    '/leagues/standings',
    '/referee',
    '/club',
    '/piloto',
    '/privacidad',
    '/terminos',
    '/contacto',
    '/catalogo',
    '/politicas',
  ];
  const hasNavbar = user && !noNavbarRoutes.some((r) => {
    const p = stripLocalePrefix(location.pathname);
    return p === r || p.startsWith(`${r}/`);
  });

  React.useEffect(() => {
    document.body.style.paddingTop = hasNavbar ? '4rem' : '0';
    return () => { document.body.style.paddingTop = '4rem'; };
  }, [hasNavbar]);

  React.useEffect(() => {
    // La ficha pública del catálogo fija título y metadescripción en `applyCatalogItemPageSeo`.
    const pathNorm = stripLocalePrefix(location.pathname);
    if (isPublicCatalogDetailPath(location.pathname)) return;
    if (pathNorm !== '/catalogo' && pathNorm.startsWith('/catalogo/')) return;
    document.title = getDocumentTitle(location.pathname);
  }, [location.pathname, i18nInstance.language]);

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
        <span className="sr-only">{t('loading')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PendingInviteConsumer />
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/en" element={<HomeRoute />} />
        <Route path="/de" element={<HomeRoute />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacidad" element={<PrivacyPolicy />} />
        <Route path="/terminos" element={<TermsOfService />} />
        <Route path="/contacto" element={<Contact />} />
        <Route path="/politicas/:slug" element={<PoliciesPage />} />
        <Route path="/slot-race-manager" element={<SlotRaceManagerPage />} />
        <Route path="/competitions/signup/:slug" element={<CompetitionSignup />} />
        <Route path="/competitions/status/:slug" element={<CompetitionStatus />} />
        <Route path="/competitions/presentation/:slug" element={<CompetitionPresentation />} />
        <Route path="/leagues/signup/:slug" element={<LeagueSignup />} />
        <Route path="/leagues/standings/:slug" element={<LeagueStandings />} />
        <Route path="/referee/:token" element={<PublicRefereeView />} />
        <Route path="/club/:slug" element={<PublicClubProfile />} />
        <Route path="/piloto/:slug" element={<PublicPilotProfile />} />
        {/* Catálogo: índice + splat; PublicCatalogEntry distingue UUID (ficha) vs slugs SEO (listado). */}
        <Route path="/catalogo" element={<PublicCatalogList />} />
        <Route path="/catalogo/*" element={<PublicCatalogEntry />} />
        <Route path="/en/catalog" element={<PublicCatalogList />} />
        <Route path="/en/catalog/*" element={<PublicCatalogEntry />} />
        <Route path="/de/katalog" element={<PublicCatalogList />} />
        <Route path="/de/katalog/*" element={<PublicCatalogEntry />} />

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
          path="/app/timing"
          element={
            <PrivateRoute>
              <AuthedShell>
                <AppTimingRedirect />
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
          path="/settings/debug-data"
          element={
            <PrivateRoute>
              <AuthedShell>
                <DebugDataPathPage />
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
          path="/changelog"
          element={
            <PrivateRoute>
              <AuthedShell>
                <Changelog />
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
          path="/admin/changelog"
          element={
            <PrivateRoute>
              <AuthedShell>
                <AdminChangelog />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <PrivateRoute>
              <AuthedShell>
                <AdminPlatformDashboard />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/lap-timer-licenses"
          element={
            <PrivateRoute>
              <AuthedShell>
                <AdminLapTimerLicensesPage />
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
          path="/leagues"
          element={
            <PrivateRoute>
              <AuthedShell>
                <Leagues />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/leagues/create"
          element={
            <PrivateRoute>
              <AuthedShell>
                <LeagueCreate />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/leagues/:id"
          element={
            <PrivateRoute>
              <AuthedShell>
                <LeagueDetail />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/clubs"
          element={
            <PrivateRoute>
              <AuthedShell>
                <Clubs />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/clubs/join"
          element={
            <PrivateRoute>
              <AuthedShell>
                <Clubs />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/clubs/:id/members"
          element={
            <PrivateRoute>
              <AuthedShell>
                <ClubMembers />
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
          path="/pilots/favorites"
          element={
            <PrivateRoute>
              <AuthedShell>
                <FavoritePilots />
              </AuthedShell>
            </PrivateRoute>
          }
        />

        <Route
          path="/competitions/:id/referee"
          element={
            <PrivateRoute>
              <AuthedShell>
                <CompetitionRefereeView />
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

        {/* /en/profile, /de/dashboard, etc. → ruta sin prefijo (solo landing/catálogo usan prefijo URL) */}
        <Route path="/en/*" element={<LocalePrefixRedirect />} />
        <Route path="/de/*" element={<LocalePrefixRedirect />} />
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
    <I18nextProvider i18n={i18n}>
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
    </I18nextProvider>
  );
}

export default App;
