import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Download, Share2, Info, ChevronDown, UserRound } from 'lucide-react';
import axios from '../../lib/axios';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { toast } from 'sonner';
import LeagueMySeason from './LeagueMySeason';
import LeagueAdjustedBadge from './LeagueAdjustedBadge';
import LeaguePointsOverrideDialog from './LeaguePointsOverrideDialog';
import LeagueRulesHelp from './LeagueRulesHelp';
import {
  buildParticipantSeason,
  findMyStandingRow,
  findStandingRow,
  isSelfStanding,
  matcherFromParticipantKey,
  participantKeyFromRow,
} from '../../utils/leagueParticipantSeason';

const isLeagueCompetitionVisible = (comp) =>
  comp.competition_status === 'closed' ||
  ((comp.competition_status === 'running' || comp.competition_status === 'published') &&
    comp.has_results);

const triggerBlobDownload = (data, filename) => {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const RESULT_STATUS_LABEL = {
  dns: 'DNS',
  dsq: 'DSQ',
};

const standingsEmptyKind = (competitions, standings) => {
  const list = competitions || [];
  if (!list.length) return 'noEvents';
  if (!list.some(isLeagueCompetitionVisible)) return 'noResults';
  if (!(standings || []).length) return 'noParticipants';
  return null;
};

const StandingCellContent = ({ entry, includeAuthor = false }) => {
  if (!entry) {
    return <span className="text-muted-foreground">—</span>;
  }

  const dropped = Boolean(entry.dropped);
  const statusLabel = !entry.overridden ? RESULT_STATUS_LABEL[entry.result_status] : null;
  const pts = entry.points;
  const vehicle = entry.vehicle;

  return (
    <div className="space-y-0.5">
      <div className={dropped ? 'line-through text-muted-foreground' : 'font-medium'}>
        {statusLabel || pts}
      </div>
      {entry.overridden ? (
        <div className="flex justify-center">
          <LeagueAdjustedBadge override={entry.override} includeAuthor={includeAuthor} />
        </div>
      ) : null}
      {entry.overridden && RESULT_STATUS_LABEL[entry.result_status] ? (
        <div className="text-[10px] leading-tight text-muted-foreground">
          {RESULT_STATUS_LABEL[entry.result_status]}
        </div>
      ) : null}
      {(entry.power_stage_points || 0) > 0 && (
        <div
          className={`text-[10px] leading-tight ${
            dropped ? 'line-through opacity-70' : 'text-muted-foreground'
          }`}
        >
          ⚡ +{entry.power_stage_points} PS
        </div>
      )}
      {vehicle ? (
        <div
          className={`text-[10px] leading-tight truncate max-w-[7rem] mx-auto ${
            dropped ? 'line-through opacity-70' : 'text-muted-foreground'
          }`}
          title={vehicle}
        >
          {vehicle}
        </div>
      ) : null}
    </div>
  );
};

const LeagueStandingsTable = ({
  standings = [],
  competitions = [],
  countingRaces = null,
  tiebreakMode = null,
  exportBasePath = null,
  leagueName = '',
  leagueSlug = null,
  canManage = false,
  leagueId = null,
  onResultUpdated,
  viewer = null,
  selectedParticipantKey = null,
  onSelectParticipant,
}) => {
  const { t } = useTranslation('leagues');
  const closedCompetitions = (competitions || []).filter(isLeagueCompetitionVisible);
  const [markingKey, setMarkingKey] = useState(null);
  const [internalSelectedKey, setInternalSelectedKey] = useState(null);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overrideBusy, setOverrideBusy] = useState(false);

  const selectedKey = onSelectParticipant ? selectedParticipantKey : internalSelectedKey;
  const myRow = useMemo(() => findMyStandingRow(standings, viewer), [standings, viewer]);

  const selectedRow = useMemo(() => {
    if (!selectedKey) return null;
    return findStandingRow(standings, matcherFromParticipantKey(selectedKey));
  }, [selectedKey, standings]);

  const season = useMemo(() => {
    if (!selectedRow) return null;
    const isSelf = isSelfStanding(selectedRow, viewer);
    return buildParticipantSeason(
      {
        league: {
          id: leagueId,
          name: leagueName,
          slug: leagueSlug,
          counting_races: countingRaces,
          tiebreak_mode: tiebreakMode,
        },
        competitions,
        standings,
      },
      {
        leagueParticipantId: selectedRow.league_participant_id,
        name: selectedRow.name,
        email: selectedRow.email,
      },
      { isSelf, includeEmail: Boolean(canManage || isSelf), viewer },
    );
  }, [selectedRow, viewer, leagueId, leagueName, leagueSlug, countingRaces, tiebreakMode, competitions, standings, canManage]);

  const openRow = (row) => {
    const key = participantKeyFromRow(row);
    if (onSelectParticipant) onSelectParticipant(key);
    else setInternalSelectedKey(key);
  };

  const closeSeason = () => {
    if (onSelectParticipant) onSelectParticipant(null);
    else setInternalSelectedKey(null);
  };

  const handleExport = async (type) => {
    if (!exportBasePath) return;
    try {
      const response = await axios.get(`${exportBasePath}/export/${type}`, { responseType: 'blob' });
      const base = (leagueName || 'liga').replace(/[^a-zA-Z0-9]/g, '_');
      const day = new Date().toISOString().split('T')[0];
      const ext = type === 'csv' ? 'csv' : 'pdf';
      triggerBlobDownload(response.data, `liga_${base}_${type === 'social' ? 'social_' : ''}${day}.${ext}`);
      toast.success(t('standings.exportStarted'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('standings.exportError'));
    }
  };

  const handleSetResult = async (row, competitionId, resultStatus) => {
    if (!leagueId || !row.league_participant_id) return;
    const key = `${row.league_participant_id}:${competitionId}`;
    try {
      setMarkingKey(key);
      await axios.put(`/leagues/${leagueId}/competitions/${competitionId}/results`, {
        league_participant_id: row.league_participant_id,
        result_status: resultStatus,
      });
      const okMsg =
        resultStatus === 'dns'
          ? t('standings.markedDns')
          : resultStatus === 'dsq'
            ? t('standings.markedDsq')
            : t('standings.clearedMark');
      toast.success(okMsg);
      onResultUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.error || t('standings.saveError'));
    } finally {
      setMarkingKey(null);
    }
  };

  const openOverride = (row, competition) => {
    setOverrideTarget({
      row,
      competitionId: competition.competition_id,
      competitionName: competition.competition_name,
      entry: row.by_competition?.[competition.competition_id] || null,
    });
  };

  const handleSaveOverride = async ({ points, reason }) => {
    if (!leagueId || !overrideTarget?.row?.league_participant_id) return;
    try {
      setOverrideBusy(true);
      await axios.put(
        `/leagues/${leagueId}/competitions/${overrideTarget.competitionId}/overrides`,
        {
          league_participant_id: overrideTarget.row.league_participant_id,
          points,
          reason,
        },
      );
      toast.success(t('standings.adjustSaved'));
      setOverrideTarget(null);
      onResultUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.error || t('standings.saveError'));
    } finally {
      setOverrideBusy(false);
    }
  };

  const handleClearOverride = async () => {
    if (!leagueId || !overrideTarget?.row?.league_participant_id) return;
    try {
      setOverrideBusy(true);
      await axios.delete(
        `/leagues/${leagueId}/competitions/${overrideTarget.competitionId}/overrides/${overrideTarget.row.league_participant_id}`,
      );
      toast.success(t('standings.adjustCleared'));
      setOverrideTarget(null);
      onResultUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.error || t('standings.saveError'));
    } finally {
      setOverrideBusy(false);
    }
  };

  const emptyKind = standingsEmptyKind(competitions, standings);
  const emptyTitleKey = {
    noEvents: 'standings.emptyNoEvents',
    noResults: 'standings.emptyNoResults',
    noParticipants: 'standings.emptyNoParticipants',
  }[emptyKind] || 'standings.empty';
  const emptyHintKey = {
    noEvents: 'standings.emptyNoEventsHint',
    noResults: 'standings.emptyNoResultsHint',
    noParticipants: 'standings.emptyNoParticipantsHint',
  }[emptyKind];

  return (
    <div className="space-y-4">
      <Alert data-testid="league-rules-help-banner">
        <Info className="size-4" />
        <AlertTitle>{t('standings.helpTitle')}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {countingRaces
              ? t('standings.countingSummary', { count: countingRaces })
              : t('standings.emptyCountingUnset')}
          </p>
          <LeagueRulesHelp
            countingRaces={countingRaces}
            tiebreakMode={tiebreakMode}
            context="standings"
          />
        </AlertDescription>
      </Alert>

      {emptyKind ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-3">
            <Trophy className="size-8 mx-auto opacity-50" />
            <p data-testid="league-standings-empty">{t(emptyTitleKey)}</p>
            {emptyHintKey ? (
              <p className="text-xs max-w-md mx-auto">{t(emptyHintKey)}</p>
            ) : null}
            {!countingRaces && canManage ? (
              <p className="text-xs">{t('standings.emptyCountingUnsetOrganizer')}</p>
            ) : null}
            {canManage && emptyKind !== 'noEvents' ? (
              <p className="text-xs">{t('standings.emptyOrganizerHint')}</p>
            ) : null}
            <div className="flex justify-center pt-1">
              <LeagueRulesHelp
                countingRaces={countingRaces}
                tiebreakMode={tiebreakMode}
                variant="link"
                context="standings"
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Trophy className="size-4" />
                {t('standings.title')}
              </h3>
              {countingRaces ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('standings.countingSummary', { count: countingRaces })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('standings.emptyCountingUnset')}
                </p>
              )}
              {canManage ? (
                <p className="text-xs text-muted-foreground mt-1">{t('standings.organizerHint')}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {myRow ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openRow(myRow)}
                  data-testid="league-my-season-cta"
                >
                  <UserRound className="size-4 mr-2" />
                  {t('mySeason.cta')}
                </Button>
              ) : null}
              {exportBasePath ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                    <Download className="size-4 mr-2" />
                    {t('standings.csv')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('social')}>
                    <Share2 className="size-4 mr-2" />
                    {t('standings.socialImage')}
                  </Button>
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t('standings.pos')}</TableHead>
                  <TableHead>{t('standings.driver')}</TableHead>
                  {closedCompetitions.map((comp) => (
                    <TableHead key={comp.competition_id} className="text-center min-w-[80px]">
                      <span className="text-xs">{comp.competition_name}</span>
                    </TableHead>
                  ))}
                  <TableHead className="text-right font-bold">{t('standings.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.map((row) => (
                  <TableRow key={`${row.name}-${row.email || ''}-${row.league_participant_id || ''}`}>
                    <TableCell>
                      <Badge variant={row.position === 1 ? 'default' : 'outline'}>{row.position}</Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => openRow(row)}
                        title={t('standings.openSeasonHint')}
                        data-testid="league-standings-driver"
                      >
                        <div className="font-medium">{row.name}</div>
                      </button>
                      {row.email ? (
                        <div className="text-xs text-muted-foreground">{row.email}</div>
                      ) : null}
                    </TableCell>
                    {closedCompetitions.map((comp) => {
                      const entry = row.by_competition?.[comp.competition_id];
                      const dropped = entry?.dropped;
                      const canMark = Boolean(
                        canManage && leagueId && row.league_participant_id,
                      );
                      const cellKey = `${row.league_participant_id}:${comp.competition_id}`;
                      const busy = markingKey === cellKey;

                      return (
                        <TableCell
                          key={comp.competition_id}
                          className={`text-center align-top ${dropped ? 'text-muted-foreground' : ''}`}
                        >
                          {canMark ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="w-full rounded-md px-1 py-0.5 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  title={t('standings.markTitle')}
                                >
                                  <StandingCellContent entry={entry} includeAuthor={canManage} />
                                  <ChevronDown className="size-3 mx-auto mt-0.5 opacity-50" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="center">
                                <DropdownMenuItem
                                  onClick={() => handleSetResult(row, comp.competition_id, 'dns')}
                                >
                                  {t('standings.markDns')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleSetResult(row, comp.competition_id, 'dsq')}
                                >
                                  {t('standings.markDsq')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openOverride(row, comp)}
                                  data-testid="league-adjust-points"
                                >
                                  {t('standings.adjustPoints')}
                                </DropdownMenuItem>
                                {entry?.result_status_source === 'explicit' ? (
                                  <DropdownMenuItem
                                    onClick={() => handleSetResult(row, comp.competition_id, null)}
                                  >
                                    {t('standings.clearMark')}
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <StandingCellContent entry={entry} includeAuthor={canManage} />
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-bold">{row.total_points}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Sheet open={Boolean(season)} onOpenChange={(open) => { if (!open) closeSeason(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>{season?.is_self ? t('mySeason.titleSelf') : t('mySeason.titleFallback')}</SheetTitle>
            <SheetDescription>{t('standings.openSeasonHint')}</SheetDescription>
          </SheetHeader>
          <LeagueMySeason
            season={season}
            showEmail={Boolean(canManage || season?.is_self)}
            showOverrideAuthor={canManage}
          />
        </SheetContent>
      </Sheet>

      <LeaguePointsOverrideDialog
        open={Boolean(overrideTarget)}
        onOpenChange={(next) => { if (!next) setOverrideTarget(null); }}
        target={overrideTarget}
        busy={overrideBusy}
        onSave={handleSaveOverride}
        onClear={handleClearOverride}
      />
    </div>
  );
};

export default LeagueStandingsTable;
