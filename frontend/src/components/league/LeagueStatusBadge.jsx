import React from 'react';
import { Badge } from '../ui/badge';

const LABEL = {
  draft: 'Borrador',
  published: 'Publicada',
  running: 'En curso',
  closed: 'Cerrada',
};

export default function LeagueStatusBadge({ status, className }) {
  const s = status || 'draft';
  const variant =
    s === 'draft'
      ? 'secondary'
      : s === 'published'
        ? 'outline'
        : s === 'running'
          ? 'default'
          : 'destructive';
  return (
    <Badge variant={variant} className={className}>
      {LABEL[s] || s}
    </Badge>
  );
}
