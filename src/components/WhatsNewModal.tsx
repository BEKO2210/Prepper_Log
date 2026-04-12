import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { version as appVersion } from '../../package.json';
import releaseNotes from '../generated/release-notes.json';
import { Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'preptrack-last-seen-version';

type ReleaseItem = { message: string; sha: string };

export function WhatsNewModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen !== appVersion) {
        setOpen(true);
      }
    } catch {
      // localStorage nicht verfügbar — Modal unterdrücken
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, appVersion);
    } catch {
      // ignore
    }
    setOpen(false);
  }

  const items = useMemo<ReleaseItem[]>(
    () => (Array.isArray(releaseNotes.items) ? (releaseNotes.items as ReleaseItem[]) : []),
    []
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
      onClick={dismiss}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-primary-700 bg-primary-800 p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={22} className="text-green-400" />
            <h2 id="whatsnew-title" className="text-lg font-bold text-gray-100">
              {t('whatsNew.title')}
            </h2>
          </div>
          <button
            onClick={dismiss}
            className="rounded-lg p-1 text-gray-400 hover:bg-primary-700 hover:text-gray-200"
            aria-label={t('whatsNew.close')}
          >
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-400">
          {t('whatsNew.subtitle', { version: appVersion })}
        </p>

        {items.length > 0 ? (
          <ul className="mb-5 space-y-2">
            {items.map((item) => (
              <li
                key={item.sha}
                className="flex items-start gap-2 rounded-lg bg-primary-700/40 px-3 py-2 text-sm text-gray-200"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                <span className="flex-1 break-words">{item.message}</span>
                <code className="mt-0.5 shrink-0 rounded bg-primary-900/60 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                  {item.sha}
                </code>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-5 rounded-lg bg-primary-700/30 px-3 py-4 text-center text-sm text-gray-400">
            {t('whatsNew.empty', { defaultValue: '—' })}
          </p>
        )}

        <button
          onClick={dismiss}
          className="w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white shadow-lg shadow-green-600/20 transition-colors hover:bg-green-500"
        >
          {t('whatsNew.close')}
        </button>
      </div>
    </div>
  );
}
