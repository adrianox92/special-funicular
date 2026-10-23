import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LegalDocumentLayout from '../components/LegalDocumentLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import api from '../lib/axios';
import { toast } from 'sonner';

const Contact = () => {
  const { t } = useTranslation('legal');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/public/contact', {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        website: honeypot,
      });
      toast.success(t('contact.success'));
      setName('');
      setEmail('');
      setMessage('');
      setHoneypot('');
    } catch (err) {
      const data = err.response?.data;
      const msg =
        data?.error ||
        data?.errors?.[0]?.msg ||
        (err.message === 'Network Error'
          ? t('contact.networkError')
          : t('contact.sendError'));
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LegalDocumentLayout title={t('contactTitle')}>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t('contact.intro')}
      </p>

      <p className="text-sm text-muted-foreground leading-relaxed">
        {t('contact.alsoReview')}{' '}
        <Link to="/privacidad" className="text-foreground underline underline-offset-4">
          {t('contact.privacyLink')}
        </Link>{' '}
        {t('contact.andThe')}{' '}
        <Link to="/terminos" className="text-foreground underline underline-offset-4">
          {t('contact.termsLink')}
        </Link>
        .
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
        <div className="hidden" aria-hidden="true">
          <label htmlFor="contact-website">{t('contact.honeypot')}</label>
          <input
            id="contact-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-name">{t('contact.name')}</Label>
          <Input
            id="contact-name"
            name="name"
            type="text"
            required
            maxLength={200}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-email">{t('contact.email')}</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={320}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-message">{t('contact.message')}</Label>
          <Textarea
            id="contact-message"
            name="message"
            required
            minLength={10}
            maxLength={10000}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
            placeholder={t('contact.placeholder')}
          />
          <p className="text-xs text-muted-foreground">{message.length} / 10000</p>
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? t('contact.sending') : t('contact.submit')}
        </Button>
      </form>

      <Alert className="max-w-lg border-muted">
        <AlertDescription className="text-xs text-muted-foreground">
          {t('contact.privacyNote')}
        </AlertDescription>
      </Alert>
    </LegalDocumentLayout>
  );
};

export default Contact;
