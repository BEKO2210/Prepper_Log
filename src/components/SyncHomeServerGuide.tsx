import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, Copy, Home, ShieldAlert, Wrench } from 'lucide-react';

interface SyncHomeServerGuideProps {
  onBack: () => void;
}

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-300">
          {step}
        </span>
        <h3 className="font-semibold text-gray-100">{title}</h3>
      </div>
      <div className="space-y-2 text-sm text-gray-300">{children}</div>
    </article>
  );
}

function CodeLine({ value }: { value: string }) {
  return (
    <code className="inline-flex items-center gap-1 rounded-md border border-primary-600 bg-primary-900 px-2 py-1 font-mono text-xs text-sky-300">
      <Copy size={12} />
      {value}
    </code>
  );
}

export function SyncHomeServerGuide({ onBack }: SyncHomeServerGuideProps) {
  const { t } = useTranslation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-2 rounded-lg bg-primary-700 px-3 py-2 text-sm text-gray-200 hover:bg-primary-600"
        >
          <ArrowLeft size={16} />
          {t('sync.guideBack')}
        </button>
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-100">
          <Home size={20} className="text-sky-400" />
          {t('sync.guideTitle')}
        </h2>
        <p className="mt-2 text-sm text-gray-300">{t('sync.guideIntro')}</p>
      </section>

      <section className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-sm text-gray-300">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-100">
          <CheckCircle2 size={18} className="text-green-400" />
          {t('sync.guideChecklistTitle')}
        </h3>
        <ul className="list-inside list-disc space-y-1">
          <li>{t('sync.guideCheck1')}</li>
          <li>{t('sync.guideCheck2')}</li>
          <li>{t('sync.guideCheck3')}</li>
          <li>{t('sync.guideCheck4')}</li>
        </ul>
      </section>

      <StepCard step={1} title={t('sync.guideStep1Title')}>
        <p>{t('sync.guideStep1a')}</p>
        <p><CodeLine value="docker compose -f docker-compose.sync.yml up -d --build" /></p>
        <p>{t('sync.guideStep1b')}</p>
        <p><CodeLine value="docker compose -f docker-compose.sync.yml ps" /></p>
      </StepCard>

      <StepCard step={2} title={t('sync.guideStep2Title')}>
        <p>{t('sync.guideStep2a')}</p>
        <p>{t('sync.guideStep2Example')} <CodeLine value="http://192.168.0.20:8787" /></p>
        <p>{t('sync.guideStep2Note')}</p>
      </StepCard>

      <StepCard step={3} title={t('sync.guideStep3Title')}>
        <p>{t('sync.guideStep3a')} <CodeLine value={t('sync.guideDeviceExample1')} />.</p>
        <p>{t('sync.guideStep3Code')}</p>
        <p>{t('sync.guideStep3Pair')}</p>
      </StepCard>

      <StepCard step={4} title={t('sync.guideStep4Title')}>
        <p>{t('sync.guideStep4a')}</p>
        <p>{t('sync.guideStep4b')} <CodeLine value={t('sync.guideDeviceExample2')} />.</p>
        <p>{t('sync.guideStep4c')}</p>
      </StepCard>

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-100">
          <ShieldAlert size={18} className="text-amber-400" />
          {t('sync.guideErrorsTitle')}
        </h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p><strong>E_CONN_REFUSED:</strong> {t('sync.guideErrConnRefused')}</p>
          <p><strong>E_TIMEOUT:</strong> {t('sync.guideErrTimeout')}</p>
          <p><strong>E_BAD_CODE / 401:</strong> {t('sync.guideErrBadCode')}</p>
          <p><strong>E_CONFLICT / 409:</strong> {t('sync.guideErrConflict')}</p>
          <p><strong>E_SCHEMA / 422:</strong> {t('sync.guideErrSchema')}</p>
          <p><strong>E_SERVER / 500:</strong> {t('sync.guideErrServer')}</p>
          <p><CodeLine value="docker compose -f docker-compose.sync.yml logs -f" /></p>
        </div>
      </section>

      <section className="rounded-xl border border-primary-700 bg-primary-800/60 p-4">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-gray-100">
          <Wrench size={18} className="text-sky-400" />
          {t('sync.guideMaintenanceTitle')}
        </h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-gray-300">
          <li>{t('sync.guideMaint1')}</li>
          <li>{t('sync.guideMaint2')}</li>
          <li>{t('sync.guideMaint3')}</li>
          <li>{t('sync.guideMaint4')}</li>
        </ul>
        <p className="mt-3 text-sm text-gray-400">
          {t('sync.guideTipBefore')}{' '}
          <code className="rounded bg-primary-900 px-1 py-0.5 text-xs text-sky-300">sync-backend/README.md</code>{' '}
          {t('sync.guideTipAfter')}
        </p>
      </section>
    </div>
  );
}
