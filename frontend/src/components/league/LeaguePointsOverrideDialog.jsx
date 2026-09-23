import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const LeaguePointsOverrideDialog = ({
  open,
  onOpenChange,
  target,
  busy = false,
  onSave,
  onClear,
}) => {
  const { t } = useTranslation('leagues');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    const current = target?.entry;
    const nextPoints = current?.overridden
      ? current.points
      : current?.points ?? '';
    setPoints(nextPoints === '' || nextPoints == null ? '' : String(nextPoints));
    setReason(current?.override?.reason || '');
  }, [open, target]);

  const hasOverride = Boolean(target?.entry?.overridden);
  const parsed = Number(points);
  const canSave = Number.isFinite(parsed) && parsed >= 0 && parsed <= 9999;

  const handleSave = (e) => {
    e.preventDefault();
    if (!canSave || busy) return;
    onSave?.({
      points: parsed,
      reason: reason.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="league-override-dialog">
        <form onSubmit={handleSave} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('standings.adjustPointsTitle')}</DialogTitle>
            <DialogDescription>{t('standings.adjustPointsHelp')}</DialogDescription>
          </DialogHeader>

          {target ? (
            <p className="text-sm text-muted-foreground">
              {target.row?.name}
              {target.competitionName ? ` · ${target.competitionName}` : ''}
            </p>
          ) : null}

          {hasOverride && target?.entry?.override ? (
            <p className="text-xs text-muted-foreground" data-testid="league-override-audit">
              {t('standings.adjustedBy', {
                name: target.entry.override.updated_by_label || t('standings.adjustedAuthorFallback'),
              })}
              {target.entry.override.updated_at
                ? ` · ${new Date(target.entry.override.updated_at).toLocaleString()}`
                : ''}
              {target.entry.override.reason ? ` · ${target.entry.override.reason}` : ''}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="league-override-points">{t('standings.adjustPointsField')}</Label>
            <Input
              id="league-override-points"
              type="number"
              inputMode="decimal"
              min="0"
              max="9999"
              step="0.1"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              required
              data-testid="league-override-points"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="league-override-reason">{t('standings.adjustReason')}</Label>
            <Textarea
              id="league-override-reason"
              maxLength={140}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('standings.adjustReasonHint')}
              data-testid="league-override-reason"
            />
          </div>

          <DialogFooter className="gap-2">
            {hasOverride ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onClear?.()}
                data-testid="league-override-clear"
              >
                {t('standings.adjustClear')}
              </Button>
            ) : null}
            <Button type="submit" disabled={!canSave || busy} data-testid="league-override-save">
              {t('standings.adjustSave')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LeaguePointsOverrideDialog;
