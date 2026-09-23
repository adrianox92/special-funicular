import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer } from 'lucide-react';
import axios from '../../lib/axios';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Spinner } from '../ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const LeagueTimingSyncDialog = ({
  open,
  onOpenChange,
  leagueId,
  competitionId,
  competitionName,
  onApplied,
}) => {
  const { t } = useTranslation('leagues');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const loadPreview = useCallback(async () => {
    if (!leagueId || !competitionId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`/leagues/${leagueId}/competitions/${competitionId}/timing-sync`);
      setPreview(res.data);
    } catch (err) {
      setPreview(null);
      setError(err.response?.data?.error || t('timingSync.loadError'));
    } finally {
      setLoading(false);
    }
    // t de i18n es estable en runtime; no recargar el preview al re-renderizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, competitionId]);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setError(null);
    loadPreview();
  }, [open, loadPreview]);

  const handleApply = async () => {
    if (!leagueId || !competitionId || applying) return;
    try {
      setApplying(true);
      setError(null);
      const res = await axios.post(`/leagues/${leagueId}/competitions/${competitionId}/timing-sync`);
      setPreview(res.data);
      if (res.data.applied) {
        onApplied?.(res.data);
        onOpenChange?.(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || t('timingSync.applyError'));
    } finally {
      setApplying(false);
    }
  };

  const emptyReason = preview?.empty_reason;
  const canApply = Boolean(preview?.matched_count) && !loading && !applying;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="league-timing-sync-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="size-4" aria-hidden />
            {t('timingSync.title')}
          </DialogTitle>
          <DialogDescription>
            {competitionName
              ? t('timingSync.subtitleNamed', { name: competitionName })
              : t('timingSync.subtitle')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8" data-testid="league-timing-sync-loading">
            <Spinner className="size-6" />
          </div>
        ) : null}

        {error ? (
          <Alert variant="destructive" data-testid="league-timing-sync-error">
            <AlertTitle>{t('timingSync.errorTitle')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && preview ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground" data-testid="league-timing-sync-summary">
              {t('timingSync.summary', {
                matched: preview.matched_count || 0,
                unmatched: preview.unmatched_session_count || 0,
                skipped: preview.skipped_override_count || 0,
              })}
            </p>

            {emptyReason === 'no_vehicles' ? (
              <Alert data-testid="league-timing-sync-empty-vehicles">
                <AlertDescription>{t('timingSync.emptyVehicles')}</AlertDescription>
              </Alert>
            ) : null}
            {emptyReason === 'no_sessions' ? (
              <Alert data-testid="league-timing-sync-empty-sessions">
                <AlertDescription>{t('timingSync.emptySessions')}</AlertDescription>
              </Alert>
            ) : null}
            {emptyReason === 'no_matches' ? (
              <Alert data-testid="league-timing-sync-empty-matches">
                <AlertDescription>{t('timingSync.emptyMatches')}</AlertDescription>
              </Alert>
            ) : null}

            {(preview.matched || []).length > 0 ? (
              <ul className="space-y-1" data-testid="league-timing-sync-matched">
                {(preview.matched || []).map((row) => (
                  <li key={`${row.league_participant_id || row.competition_participant_id}-${row.name}`}>
                    <span className="font-medium">{row.name}</span>
                    <span className="text-muted-foreground">
                      {` · ${t('timingSync.roundsCount', { count: row.rounds?.length || 0 })}`}
                      {row.has_override ? ` · ${t('timingSync.overrideKept')}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {(preview.unmatched_participants || []).length > 0 ? (
              <p className="text-muted-foreground" data-testid="league-timing-sync-unmatched-pilots">
                {t('timingSync.unmatchedPilots', {
                  names: preview.unmatched_participants.map((row) => row.name).join(', '),
                })}
              </p>
            ) : null}

            <p className="text-xs text-muted-foreground" data-testid="league-timing-sync-dns-rule">
              {t('timingSync.dnsRule')}
            </p>
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
            {t('timingSync.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            data-testid="league-timing-sync-apply"
          >
            {applying ? <Spinner className="size-4" /> : t('timingSync.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeagueTimingSyncDialog;
