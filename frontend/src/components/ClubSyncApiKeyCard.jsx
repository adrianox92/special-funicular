import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, RefreshCw } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Spinner } from './ui/spinner';

const ClubSyncApiKeyCard = ({ clubId }) => {
  const { t } = useTranslation('clubs');
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [plain, setPlain] = useState(null);

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      setError(null);
      const { data } = await axios.get(`/clubs/${clubId}/sync-api-key`);
      setMeta(data);
    } catch (e) {
      setError(e.response?.data?.error || t('syncApiKey.loadError'));
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [clubId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const rotate = async () => {
    setRotating(true);
    setError(null);
    try {
      const { data } = await axios.post(`/clubs/${clubId}/sync-api-key/rotate`);
      setPlain(data.api_key);
      setMeta({
        key_exists: true,
        key_prefix: data.key_prefix,
        created_at: data.created_at,
        last_used_at: null,
      });
      setConfirm(false);
    } catch (e) {
      setError(e.response?.data?.error || t('syncApiKey.rotateError'));
    } finally {
      setRotating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4" />
          {t('syncApiKey.title')}
        </CardTitle>
        <CardDescription>{t('syncApiKey.lead')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {t('syncApiKey.loading')}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {meta?.key_exists
                ? t('syncApiKey.exists', { prefix: meta.key_prefix ? `${meta.key_prefix}…` : '—' })
                : t('syncApiKey.missing')}
            </p>
            {plain && (
              <Alert>
                <AlertDescription>
                  <span className="mb-2 block">{t('syncApiKey.copyNow')}</span>
                  <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{plain}</code>
                </AlertDescription>
              </Alert>
            )}
            {confirm ? (
              <Alert variant="destructive">
                <AlertDescription>
                  <span className="mb-2 block">{t('syncApiKey.confirm')}</span>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="destructive" onClick={rotate} disabled={rotating}>
                      {rotating ? <Spinner className="size-4 mr-2" /> : <RefreshCw className="size-4 mr-2" />}
                      {t('syncApiKey.confirmYes')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirm(false)} disabled={rotating}>
                      {t('syncApiKey.cancel')}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(true)} disabled={rotating}>
                <RefreshCw className="size-4 mr-2" />
                {meta?.key_exists ? t('syncApiKey.rotate') : t('syncApiKey.create')}
              </Button>
            )}
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default ClubSyncApiKeyCard;
