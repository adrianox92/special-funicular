import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LegalDocumentLayout from '../components/LegalDocumentLayout';

const Section = ({ children }) => <div className="space-y-3">{children}</div>;

const PrivacyPolicy = () => {
  const { t } = useTranslation('legal');

  return (
    <LegalDocumentLayout title={t('privacyTitle')}>
      <p className="text-sm text-muted-foreground">{t('privacyUpdated')}</p>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('privacy.introTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('privacy.intro')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('privacy.controllerTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t('privacy.controllerBefore')}{' '}
          <Link to="/contacto" className="text-foreground underline underline-offset-4 hover:text-foreground/90">
            {t('privacy.controllerLink')}
          </Link>
          {t('privacy.controllerAfter')}
        </p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('privacy.dataTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('privacy.dataLead')}</p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>
            <strong className="text-foreground">{t('privacy.dataAccountLabel')}</strong>{' '}
            {t('privacy.dataAccount')}
          </li>
          <li>
            <strong className="text-foreground">{t('privacy.dataAppLabel')}</strong>{' '}
            {t('privacy.dataApp')}
          </li>
          <li>
            <strong className="text-foreground">{t('privacy.dataTechLabel')}</strong>{' '}
            {t('privacy.dataTech')}
          </li>
        </ul>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('privacy.purposeTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('privacy.purpose')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('privacy.cookiesTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('privacy.cookiesLead')}</p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>
            <strong className="text-foreground">{t('privacy.cookiesNecessaryLabel')}</strong>{' '}
            {t('privacy.cookiesNecessary')}
          </li>
          <li>
            <strong className="text-foreground">{t('privacy.cookiesFunctionalLabel')}</strong>{' '}
            {t('privacy.cookiesFunctional')}
          </li>
          <li>
            <strong className="text-foreground">{t('privacy.cookiesAnalyticsLabel')}</strong>{' '}
            {t('privacy.cookiesAnalytics')}
          </li>
        </ul>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('privacy.processorsTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('privacy.processorsLead')}</p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>
            <strong className="text-foreground">Supabase</strong> — {t('privacy.supabaseRole')}{' '}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:text-foreground"
            >
              {t('privacy.supabasePrivacy')}
            </a>
          </li>
          <li>
            <strong className="text-foreground">Vercel</strong> — {t('privacy.vercelRole')}{' '}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:text-foreground"
            >
              {t('privacy.vercelPrivacy')}
            </a>
          </li>
        </ul>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('privacy.noSell')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('privacy.retentionTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('privacy.retention')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('privacy.rightsTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('privacy.rights')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('privacy.changesTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('privacy.changes')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('privacy.contactTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('privacy.contact')}</p>
      </Section>
    </LegalDocumentLayout>
  );
};

export default PrivacyPolicy;
