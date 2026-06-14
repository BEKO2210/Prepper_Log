import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { computePreparedness, computeShoppingList } from '../lib/preparedness';
import { useAppStore } from '../store/useAppStore';
import { StatRing } from './StatRing';
import {
  ArrowLeft,
  Minus,
  Plus,
  ShieldCheck,
  Droplets,
  CheckCircle2,
  XCircle,
  ListChecks,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}

function Stepper({ label, value, min, onChange }: StepperProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-primary-900/40 p-3">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-700 text-gray-200 transition-colors hover:bg-primary-600 disabled:opacity-40"
          aria-label={`${label} −`}
        >
          <Minus size={16} />
        </button>
        <span className="min-w-[2ch] text-center text-lg font-bold text-gray-100 stat-number">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-700 text-gray-200 transition-colors hover:bg-primary-600"
          aria-label={`${label} +`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export function Preparedness() {
  const { t } = useTranslation();
  const setPage = useAppStore((s) => s.setPage);
  const setEditingProductId = useAppStore((s) => s.setEditingProductId);
  const household = useAppStore((s) => s.household);
  const setHousehold = useAppStore((s) => s.setHousehold);

  const productsQuery = useLiveQuery(() => db.products.toArray());
  const products = useMemo(() => productsQuery ?? [], [productsQuery]);
  const [copied, setCopied] = useState(false);

  const { result, shopping } = useMemo(
    () => ({
      result: computePreparedness(products, household),
      shopping: computeShoppingList(products, household),
    }),
    [products, household]
  );

  async function handleCopy() {
    const lines = shopping.map(
      (item) => `- ${item.name}: ${item.needed} ${t(`units.${item.unit}`, item.unit)}`
    );
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silently ignore
    }
  }

  if (productsQuery === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-green-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPage('dashboard')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-700 bg-primary-800/60 text-gray-300 transition-colors hover:text-gray-100"
          aria-label={t('preparedness.back')}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-bold text-gray-100">{t('preparedness.title')}</h2>
          <p className="text-xs text-gray-400">{t('preparedness.subtitle')}</p>
        </div>
      </div>

      {/* Score + household */}
      <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-5">
        <div className="flex items-center gap-5">
          <StatRing value={result.score} max={100} label={t('preparedness.score')} color={scoreColor(result.score)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-gray-200">
              <ShieldCheck size={18} className="text-green-400" />
              <span className="text-sm font-semibold">
                {result.score >= 70
                  ? t('preparedness.scoreStrong')
                  : result.score >= 40
                    ? t('preparedness.scoreOk')
                    : t('preparedness.scoreWeak')}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {t('preparedness.coverageHint', { covered: result.essentialCovered, total: result.essentialTotal })}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stepper
            label={t('preparedness.persons')}
            value={household.persons}
            min={1}
            onChange={(persons) => setHousehold({ ...household, persons })}
          />
          <Stepper
            label={t('preparedness.targetDays')}
            value={household.days}
            min={1}
            onChange={(days) => setHousehold({ ...household, days })}
          />
        </div>
      </div>

      {/* Water range */}
      <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Droplets size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">{t('preparedness.waterTitle')}</h3>
        </div>
        <p className="text-2xl font-bold text-gray-100">
          {t('preparedness.waterDays', { count: result.waterDays })}
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary-700">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${Math.min(100, (result.waterDays / result.targetDays) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {t('preparedness.waterTarget', {
            liters: result.waterTargetLiters,
            persons: household.persons,
            days: household.days,
          })}
        </p>
        <p className={`mt-1 text-xs ${result.waterDeficitLiters > 0 ? 'text-orange-400' : 'text-green-400'}`}>
          {result.waterDeficitLiters > 0
            ? t('preparedness.waterDeficit', { liters: result.waterDeficitLiters })
            : t('preparedness.waterEnough')}
        </p>
        <p className="mt-2 text-[0.65rem] text-gray-500">{t('preparedness.waterNote')}</p>
      </div>

      {/* Coverage checklist */}
      <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">{t('preparedness.coverageTitle')}</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {result.coverage.map(({ key, present }) => (
            <div key={key} className="flex items-center gap-2">
              {present ? (
                <CheckCircle2 size={16} className="shrink-0 text-green-400" />
              ) : (
                <XCircle size={16} className="shrink-0 text-gray-500" />
              )}
              <span className={`text-sm ${present ? 'text-gray-200' : 'text-gray-500'}`}>{t(`categories.${key}`)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shopping list */}
      <div className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks size={16} className="text-green-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">{t('preparedness.shoppingTitle')}</h3>
          </div>
          {shopping.length > 0 && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-green-400 transition-colors hover:text-green-300"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('preparedness.copied') : t('preparedness.copy')}
            </button>
          )}
        </div>

        {shopping.length === 0 ? (
          <p className="text-sm text-gray-400">{t('preparedness.shoppingEmpty')}</p>
        ) : (
          <>
            <div className="space-y-2">
              {shopping.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-primary-900/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-200">{item.name}</p>
                    <p className="text-[0.65rem] text-gray-400">
                      {item.reason === 'water' ? t('preparedness.reasonWater') : t('preparedness.reasonLowStock')}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-gray-300">
                    {t('preparedness.needed', { amount: item.needed, unit: t(`units.${item.unit}`, item.unit) })}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[0.65rem] text-gray-500">{t('preparedness.shoppingHint')}</p>
          </>
        )}
      </div>

      {products.filter((p) => !p.archived).length === 0 && (
        <button
          onClick={() => { setEditingProductId(null); setPage('add'); }}
          className="w-full rounded-xl bg-green-700 px-5 py-3 font-medium text-white transition-transform hover:bg-green-600 active:scale-[0.98]"
        >
          {t('nav.add')}
        </button>
      )}
    </div>
  );
}
