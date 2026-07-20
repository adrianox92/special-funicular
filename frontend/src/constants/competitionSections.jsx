import React from 'react';
import { Settings, Clock } from 'lucide-react';

export function buildCompetitionSectionOptions(t) {
  return [
    {
      value: 'setup',
      label: t('detail.sections.setup'),
      trigger: (
        <>
          <Settings className="size-4 shrink-0" />
          {t('detail.sections.setup')}
        </>
      ),
    },
    {
      value: 'timings',
      label: t('detail.sections.timings'),
      trigger: (
        <>
          <Clock className="size-4 shrink-0" />
          {t('detail.sections.timings')}
        </>
      ),
    },
  ];
}
