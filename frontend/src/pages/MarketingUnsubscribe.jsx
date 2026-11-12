import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Button } from '../components/ui/button';

export default function MarketingUnsubscribe() {
  const { t } = useTranslation('profile');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState(token ? 'loading' : 'missing');

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await api.get('/public/marketing-consent/unsubscribe', { params: { token } });
        if (!cancelled) setStatus('ok');
      } catch {
        if (!cancelled) setStatus('missing');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex justify-center items-center min-h-[60vh] py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('marketing.unsubscribeTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Spinner className="size-4" />
              {t('marketing.loading')}
            </p>
          )}
          {status === 'ok' && (
            <Alert>
              <AlertDescription>
                {t('marketing.unsubscribeOk')} {t('marketing.unsubscribeHint')}
              </AlertDescription>
            </Alert>
          )}
          {status === 'missing' && (
            <Alert variant="destructive">
              <AlertDescription>{t('marketing.unsubscribeMissing')}</AlertDescription>
            </Alert>
          )}
          <Button asChild variant="outline">
            <Link to="/profile">{t('title')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
