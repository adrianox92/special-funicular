import { Navigate, useLocation, useParams } from 'react-router-dom';

/** Compatibilidad con la ruta antigua /clubs/:id/members */
const ClubLegacyMembersRedirect = () => {
  const { id } = useParams();
  const location = useLocation();
  return <Navigate to={`/clubs/${id}${location.search}`} replace />;
};

export default ClubLegacyMembersRedirect;
