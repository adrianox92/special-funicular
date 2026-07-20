import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PENDING_CLUB_INVITE_KEY, useClubInvite } from '../hooks/useClubInvite';

export { PENDING_CLUB_INVITE_KEY };

/**
 * Tras iniciar sesión, aplica la invitación al club guardada en sessionStorage
 * (p. ej. usuario anónimo abrió /clubs/join?token=...).
 */
const PendingInviteConsumer = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { joinWithToken } = useClubInvite();
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (loading || !user) return;

    const token = sessionStorage.getItem(PENDING_CLUB_INVITE_KEY)?.trim();
    if (!token || inFlightRef.current) return;

    inFlightRef.current = true;
    (async () => {
      try {
        await joinWithToken(token);
        sessionStorage.removeItem(PENDING_CLUB_INVITE_KEY);
        navigate('/clubs', { replace: true });
      } catch {
        sessionStorage.removeItem(PENDING_CLUB_INVITE_KEY);
        navigate('/clubs', { replace: true });
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [user, loading, navigate, joinWithToken]);

  return null;
};

export default PendingInviteConsumer;
