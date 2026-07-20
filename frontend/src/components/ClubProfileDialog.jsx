import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '../lib/axios';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

const ClubProfileDialog = ({ open, onOpenChange, clubId, club, onSaved }) => {
  const { t } = useTranslation('clubs');
  const [form, setForm] = useState({ description: '', city: '', website_url: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !club) return;
    setForm({
      description: club.description || '',
      city: club.city || '',
      website_url: club.website_url || '',
    });
  }, [open, club]);

  const handleSave = async () => {
    if (!clubId) return;
    try {
      setSaving(true);
      await axios.patch(`/clubs/${clubId}`, {
        description: form.description.trim() || null,
        city: form.city.trim() || null,
        website_url: form.website_url.trim() || null,
      });
      toast.success(t('detail.profileSaved'));
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e.response?.data?.error || t('detail.profileSaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('detail.profileTitle')}</DialogTitle>
          <DialogDescription>{t('detail.profileDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="club-desc">{t('detail.profileDescriptionLabel')}</Label>
            <Textarea
              id="club-desc"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('detail.profileDescriptionPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="club-city">{t('detail.profileCity')}</Label>
            <Input
              id="club-city"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder={t('detail.profileCityPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="club-web">{t('detail.profileWebsite')}</Label>
            <Input
              id="club-web"
              type="url"
              value={form.website_url}
              onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('guestMembers.cancel')}
          </Button>
          <Button type="button" disabled={saving} onClick={handleSave}>
            {saving ? t('guestMembers.saving') : t('guestMembers.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClubProfileDialog;
