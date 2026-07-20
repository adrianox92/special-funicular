import { Navigate, useLocation, useParams } from 'react-router-dom';
import { competitionDetailPath } from '../utils/competitionRoutes';

/** Compatibilidad con rutas antiguas /competitions/:id/participants|timings */
const CompetitionLegacyRedirect = ({ section = 'setup' }) => {
  const { id } = useParams();
  const location = useLocation();
  const tab = new URLSearchParams(location.search).get('tab');
  return <Navigate to={competitionDetailPath(id, { section, tab })} replace />;
};

export default CompetitionLegacyRedirect;
