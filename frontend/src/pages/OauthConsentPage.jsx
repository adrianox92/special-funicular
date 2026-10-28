import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';

const REQUIRED = ['client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method'];

function readParams(searchParams) {
  const body = {};
  for (const key of ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource']) {
    const value = searchParams.get(key);
    if (value) body[key] = value;
  }
  return body;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

const OauthConsentPage = () => {
  const { t } = useTranslation('profile');
  const [searchParams] = useSearchParams();
  const params = readParams(searchParams);
  const missing = REQUIRED.some((key) => !params[key]);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(!missing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (missing) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/oauth/client-info', { params: { client_id: params.client_id } });
        if (!cancelled) setClientName(data.client_name || '');
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error_description || err.response?.data?.error || t('mcp.consentError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missing, params.client_id, t]);

  const finish = async (path) => {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post(path, params);
      if (!isHttpUrl(data.redirect_url)) {
        setError(t('mcp.consentError'));
        setSubmitting(false);
        return;
      }
      window.location.assign(data.redirect_url);
    } catch (err) {
      setError(err.response?.data?.error_description || err.response?.data?.error || t('mcp.consentError'));
      setSubmitting(false);
    }
  };

  const appName = clientName || t('mcp.unnamed');

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t('mcp.consentTitle')}</CardTitle>
          <CardDescription>{missing ? t('mcp.consentMissing') : t('mcp.consentLead', { name: appName })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {t('mcp.consentLoading')}
            </div>
          ) : null}
          {!missing && !loading ? (
            <p className="text-sm text-muted-foreground">{t('mcp.consentReadOnly')}</p>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!missing ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={() => finish('/oauth/approve')} disabled={loading || submitting}>
                {submitting ? <Spinner className="mr-2 size-4" /> : null}
                {t('mcp.consentApprove')}
              </Button>
              <Button type="button" variant="outline" onClick={() => finish('/oauth/deny')} disabled={loading || submitting}>
                {t('mcp.consentDeny')}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default OauthConsentPage;
