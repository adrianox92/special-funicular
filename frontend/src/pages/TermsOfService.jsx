import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LegalDocumentLayout from '../components/LegalDocumentLayout';

const Section = ({ children }) => <div className="space-y-3">{children}</div>;

const TermsOfService = () => {
  const { t } = useTranslation('legal');

  return (
    <LegalDocumentLayout title={t('termsTitle')}>
      <p className="text-sm text-muted-foreground">{t('termsUpdated')}</p>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('terms.acceptTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.accept')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('terms.descTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.desc')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('terms.accountTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.account')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('terms.contentTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.content1')}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.content2')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('terms.ipTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.ip1')}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.ip2')}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.ip3')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('terms.prohibitedTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.prohibitedLead')}</p>
        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
          <li>{t('terms.prohibited1')}</li>
          <li>{t('terms.prohibited2')}</li>
          <li>{t('terms.prohibited3')}</li>
          <li>{t('terms.prohibited4')}</li>
        </ul>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('terms.liabilityTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.liability')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('terms.suspensionTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.suspension')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('terms.changesTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.changes')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('terms.lawTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('terms.law')}</p>
      </Section>

      <Section>
        <h2 className="text-xl font-semibold text-foreground">{t('terms.contactTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t('terms.contactBefore')}{' '}
          <Link to="/contacto" className="text-foreground underline underline-offset-4 hover:text-foreground/90">
            {t('terms.contactLink')}
          </Link>
          {t('terms.contactAfter')}
        </p>
      </Section>
    </LegalDocumentLayout>
  );
};

export default TermsOfService;
