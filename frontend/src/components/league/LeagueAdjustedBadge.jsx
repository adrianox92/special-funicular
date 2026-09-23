import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatOverrideTooltip } from '../../utils/leagueParticipantSeason';

const LeagueAdjustedBadge = ({
  override = null,
  includeAuthor = false,
  className = '',
}) => {
  const { t } = useTranslation('leagues');
  const tooltip = formatOverrideTooltip(override, t, { includeAuthor });

  return (
    <Badge
      variant="secondary"
      className={`gap-1 font-normal ${className}`}
      title={tooltip}
      data-testid="league-adjusted-badge"
    >
      <Pencil className="size-2.5" aria-hidden />
      {t('standings.adjustedBadge')}
    </Badge>
  );
};

export default LeagueAdjustedBadge;
