import React from 'react';
import { Users, Megaphone, CalendarDays, Flag, Trophy } from 'lucide-react';

export const ADMIN_TABS = new Set(['members', 'board', 'calendar', 'leagues', 'circuits']);
export const MEMBER_TABS = new Set(['board', 'calendar', 'leagues', 'circuits']);

export const CLUB_TAB_ICONS = {
  members: Users,
  board: Megaphone,
  calendar: CalendarDays,
  circuits: Flag,
  leagues: Trophy,
};

export function buildClubTabOptions(canManage, t) {
  const tabs = canManage
    ? ['members', 'board', 'calendar', 'circuits', 'leagues']
    : ['board', 'calendar', 'circuits', 'leagues'];

  return tabs.map((value) => {
    const Icon = CLUB_TAB_ICONS[value];
    const label = t(`detail.tabs.${value}`);
    return {
      value,
      label,
      trigger: (
        <>
          <Icon className="size-4 shrink-0" />
          {label}
        </>
      ),
    };
  });
}

export function resolveClubTab(tabParam, canManage) {
  const allowed = canManage ? ADMIN_TABS : MEMBER_TABS;
  const fallback = canManage ? 'members' : 'board';
  return allowed.has(tabParam) ? tabParam : fallback;
}
