import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useModal } from '../hooks/useModal';
import { version as appVersion } from '../../package.json';
import { Package, ScanBarcode, BellRing, HardDrive, Rocket } from 'lucide-react';

const ONBOARDED_KEY = 'preptrack-onboarded';
const LAST_SEEN_VERSION_KEY = 'preptrack-last-seen-version';

export function OnboardingModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(ONBOARDED_KEY) !== 'true') {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable — suppress modal
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(ONBOARDED_KEY, 'true');
      // New users have already seen the latest features here — don't immediately
      // pop the "What's new" modal on top of onboarding.
      localStorage.setItem(LAST_SEEN_VERSION_KEY, appVersion);
    } catch {
      // ignore
    }
    setOpen(false);
  }

  const modalRef = useModal(open, dismiss);

  if (!open) return null;

  const steps = [
    { icon: <ScanBarcode size={18} className="text-green-400" />, title: t('onboarding.step1Title'), desc: t('onboarding.step1Desc') },
    { icon: <BellRing size={18} className="text-yellow-400" />, title: t('onboarding.step2Title'), desc: t('onboarding.step2Desc') },
    { icon: <HardDrive size={18} className="text-blue-400" />, title: t('onboarding.step3Title'), desc: t('onboarding.step3Desc') },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      onClick={dismiss}
    >
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-primary-700 bg-primary-800 p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-green-500/30 bg-green-500/10">
            <Package size={32} className="text-green-400" />
          </div>
          <h2 id="onboarding-title" className="mt-4 text-xl font-bold text-gray-100">
            {t('onboarding.title')}
          </h2>
          <p className="mt-1 text-sm text-gray-400">{t('onboarding.subtitle')}</p>
        </div>

        <h3 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t('onboarding.getStarted')}
        </h3>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl bg-primary-900/40 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-700/60">
                {step.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-200">{step.title}</p>
                <p className="mt-0.5 text-xs text-gray-400">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={dismiss}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-3 font-medium text-white shadow-lg shadow-green-600/20 transition-colors hover:bg-green-600"
        >
          <Rocket size={18} />
          {t('onboarding.dismiss')}
        </button>
      </motion.div>
    </div>
  );
}
