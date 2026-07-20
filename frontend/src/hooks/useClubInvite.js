import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from '../lib/axios';

export const PENDING_CLUB_INVITE_KEY = 'pending_club_invite';

/**
 * Une al usuario autenticado a un club con un token de invitación.
 * @returns {{ joinWithToken: (token: string) => Promise<{ ok: boolean, alreadyMember?: boolean }> }}
 */
export function useClubInvite() {
  const { t } = useTranslation('clubs');

  const joinWithToken = useCallback(
    async (rawToken) => {
      const token = rawToken?.trim();
      if (!token) return { ok: false };

      try {
        const { data } = await axios.post(`/clubs/join/${encodeURIComponent(token)}`);
        if (data?.already_member) {
          toast.info(t('alreadyMember'));
        } else {
          toast.success(t('joined'));
        }
        return { ok: true, alreadyMember: Boolean(data?.already_member) };
      } catch (e) {
        toast.error(e.response?.data?.error || t('joinError'));
        return { ok: false };
      }
    },
    [t],
  );

  return { joinWithToken };
}

export default useClubInvite;
