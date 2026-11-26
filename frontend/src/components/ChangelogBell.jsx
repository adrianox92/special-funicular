import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import api from '../lib/axios';
import { useLocale } from '../hooks/useLocale';
import { offerHref } from '../utils/offerHref';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const CHANGELOG_SEEN_EVENT = 'slotdb-changelog-seen';
const UNREAD_POLL_MS = 10 * 60 * 1000;

function formatRelativeTime(iso, locale) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 45) return rtf.format(diffSec, 'second');
  const mins = Math.round(diffSec / 60);
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return rtf.format(days, 'day');
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMoney(price, currency, intlLocale) {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return '';
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(amount);
  } catch {
    return `${amount} ${currency || ''}`.trim();
  }
}

export function ChangelogBell() {
  const { t } = useTranslation('nav');
  const { locale, intlLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [entries, setEntries] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const [changelog, prices] = await Promise.all([
        api.get('/changelog/unread-count'),
        api.get('/notifications/unread-count'),
      ]);
      const changelogCount = typeof changelog.data?.count === 'number' ? changelog.data.count : 0;
      const priceCount = typeof prices.data?.count === 'number' ? prices.data.count : 0;
      setCount(changelogCount + priceCount);
    } catch {
      setCount(0);
    }
  }, []);

  const fetchPreview = useCallback(async () => {
    setLoadingList(true);
    try {
      const [changelog, prices] = await Promise.all([
        api.get('/changelog', { params: { limit: 5 } }),
        api.get('/notifications', { params: { limit: 8 } }),
      ]);
      setEntries(Array.isArray(changelog.data?.entries) ? changelog.data.entries : []);
      setNotices(Array.isArray(prices.data?.notices) ? prices.data.notices : []);
    } catch {
      setEntries([]);
      setNotices([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    const timer = setInterval(() => void fetchCount(), UNREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [fetchCount]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchCount();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchCount]);

  useEffect(() => {
    const onSeen = () => void fetchCount();
    window.addEventListener(CHANGELOG_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(CHANGELOG_SEEN_EVENT, onSeen);
  }, [fetchCount]);

  useEffect(() => {
    if (open) void fetchPreview();
  }, [open, fetchPreview]);

  const handleMarkRead = async () => {
    try {
      await Promise.all([
        api.post('/changelog/mark-read'),
        api.post('/notifications/mark-read'),
      ]);
      setCount(0);
      setNotices([]);
      window.dispatchEvent(new CustomEvent(CHANGELOG_SEEN_EVENT));
    } catch {
      /* noop */
    }
  };

  const markNoticeRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotices((list) => list.filter((notice) => notice.id !== id));
      setCount((value) => Math.max(0, value - 1));
    } catch {
      /* la ficha sigue siendo el destino */
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label={t('bell.aria')}
        >
          <Bell className="size-5" aria-hidden />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(calc(100vw-2rem),22rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm font-semibold">{t('bell.title')}</span>
          {count > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={handleMarkRead}>
              {t('bell.markRead')}
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[min(60vh,320px)]">
          <div className="p-2">
            {loadingList && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('bell.loading')}</p>
            )}
            {!loadingList && notices.length === 0 && entries.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('bell.empty')}</p>
            )}
            {!loadingList && notices.length > 0 && (
              <div className="mb-2">
                <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('bell.prices')}
                </p>
                {notices.map((notice) => {
                  const href = offerHref(notice.short_code);
                  const label = t('bell.priceItem', {
                    shop: notice.shop_name,
                    price: formatMoney(notice.price, notice.currency, intlLocale),
                  });
                  return (
                    <div key={notice.id} className="rounded-md px-2 py-2 hover:bg-accent/60">
                      <span className="block text-right text-[10px] text-muted-foreground">
                        {formatRelativeTime(notice.created_at, locale)}
                      </span>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          className="block text-sm font-medium leading-snug text-foreground hover:underline"
                          onClick={() => {
                            void markNoticeRead(notice.id);
                            setOpen(false);
                          }}
                        >
                          {label}
                          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                            {t('bell.priceRedirect')}
                          </span>
                        </a>
                      ) : (
                        <p className="text-sm font-medium leading-snug">{label}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {!loadingList && entries.length > 0 && (
              <div>
                <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('bell.changelog')}
                </p>
                {entries.map((entry) => (
                  <div key={entry.id} className="rounded-md px-2 py-2 hover:bg-accent/60">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {t(`bell.category.${entry.category}`, { defaultValue: entry.category })}
                      </Badge>
                      {entry.version ? (
                        <span className="text-[10px] text-muted-foreground">{entry.version}</span>
                      ) : null}
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {formatRelativeTime(entry.published_at, locale)}
                      </span>
                    </div>
                    <Link
                      to={`/changelog#${entry.id}`}
                      className="mt-1 block text-sm font-medium leading-snug text-foreground hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      {entry.title}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
        <Separator />
        <div className="p-2">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link to="/changelog" onClick={() => setOpen(false)}>
              {t('bell.viewAll')}
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { CHANGELOG_SEEN_EVENT };
