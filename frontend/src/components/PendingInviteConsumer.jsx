import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import axios from '../lib/axios';
import { useAuth } from '../context/AuthContext';

export const PENDING_CLUB_INVITE_KEY = 'pending_club_invite';

/**
 * Tras iniciar sesión, aplica la invitación al club guardada en sessionStorage
 * (p. ej. usuario anónimo abrió /clubs/join?token=...).
 */
const PendingInviteConsumer = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (loading || !user) return;

    const token = sessionStorage.getItem(PENDING_CLUB_INVITE_KEY)?.trim();
    if (!token || inFlightRef.current) return;

    inFlightRef.current = true;
    (async () => {
      try {
        const { data } = await axios.post(`/clubs/join/${encodeURIComponent(token)}`);
        sessionStorage.removeItem(PENDING_CLUB_INVITE_KEY);
        if (data?.already_member) {
          toast.info('Ya eras miembro de este club');
        } else {
          toast.success('Te has unido al club');
        }
        navigate('/clubs', { replace: true });
      } catch (e) {
        sessionStorage.removeItem(PENDING_CLUB_INVITE_KEY);
        toast.error(e.response?.data?.error || 'No se pudo unir al club con la invitación guardada');
        navigate('/clubs', { replace: true });
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [user, loading, navigate]);

  return null;
};

export default PendingInviteConsumer;
