import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { db } from '../lib/db';
import { computePreparedness, computeShoppingList } from '../lib/preparedness';
import { useAppStore } from '../store/useAppStore';
import { StatRing } from './StatRing';
import {
  ArrowLeft,
  Minus,
  Plus,
  Users,
  CalendarDays,
  Droplets,
  CheckCircle2,
  XCircle,
  ShoppingCart,
  PackagePlus,
  Copy,
  Check,
} from 'lucide-react';
import { PageSkeleton } from './Skeleton';

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

const card = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

interface StepperProps {
  label: string;
  icon: ReactNode;
  value: number;
  min: number;
  onChange: (value: number) => void;
}

function Stepper({ label, icon, value, min, onChange }: StepperProps) {
  return (
    <div className="rounded-xl bg-primary-900/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-gray-400">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-700 text-gray-200 transition-colors hover:bg-primary-600 disabled:opacity-40"
          aria-label={`${label} −`}
        >
          <Minus size={16} />
        </button>
        <span className="stat-number min-w-[2ch] text-center text-2xl font-bold text-gray-100">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-700 text-gray-200 transition-colors hover:bg-primary-600"
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
    const text = shopping
      .map((item) => `- ${item.name}: ${item.needed} ${t(`units.${item.unit}`, item.unit)}`)
      .join('\n');
    // Prefer the native share sheet on mobile, fall back to clipboard.
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t('preparedness.shoppingTitle'), text });
        return;
      } catch {
        // user cancelled or share unavailable — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silently ignore
    }
  }

  if (productsQuery === undefined) {
    return <PageSkeleton />;
  }

  const color = scoreColor(result.score);
  const statusLabel =
    result.score >= 70
      ? t('preparedness.scoreStrong')
      : result.score >= 40
        ? t('preparedness.scoreOk')
        : t('preparedness.scoreWeak');
  const waterPct = Math.min(100, Math.round((result.waterDays / result.targetDays) * 100));

  return (
    <div className="space-y-4 pb-4">
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

      {/* Hero: score */}
      <motion.div
        variants={card}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl border border-primary-700 bg-primary-800/60 p-6"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 end-0 h-48 w-48 rounded-full opacity-20 blur-3xl"
          style={{ background: color }}
        />
        <div className="relative flex flex-col items-center text-center">
          <StatRing value={result.score} max={100} label={t('preparedness.score')} color={color} size={144} strokeWidth={11} />
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary-600 bg-primary-900/40 px-3.5 py-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            <span className="text-sm font-bold text-gray-100">{statusLabel}</span>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {t('preparedness.coverageHint', { covered: result.essentialCovered, total: result.essentialTotal })}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stepper
            label={t('preparedness.persons')}
            icon={<Users size={14} />}
            value={household.persons}
            min={1}
            onChange={(persons) => setHousehold({ ...household, persons })}
          />
          <Stepper
            label={t('preparedness.targetDays')}
            icon={<CalendarDays size={14} />}
            value={household.days}
            min={1}
            onChange={(days) => setHousehold({ ...household, days })}
          />
        </div>
      </motion.div>

      {/* Water range */}
      <motion.div
        variants={card}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, delay: 0.05 }}
        className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
              <Droplets size={16} className="text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-200">{t('preparedness.waterTitle')}</h3>
          </div>
          <span className="text-2xl font-bold text-gray-100">{t('preparedness.waterDays', { count: result.waterDays })}</span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-primary-700">
          <motion.div
            className="h-full rounded-full bg-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${waterPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {t('preparedness.waterTarget', {
              liters: result.waterTargetLiters,
              persons: household.persons,
              days: household.days,
            })}
          </p>
          <span className="shrink-0 text-xs font-semibold text-blue-400">{waterPct}%</span>
        </div>
        <p className={`mt-2 inline-flex items-center gap-1 text-xs ${result.waterDeficitLiters > 0 ? 'text-orange-400' : 'text-green-400'}`}>
          {result.waterDeficitLiters > 0 ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
          {result.waterDeficitLiters > 0
            ? t('preparedness.waterDeficit', { liters: result.waterDeficitLiters })
            : t('preparedness.waterEnough')}
        </p>
        <p className="mt-2 text-[0.65rem] text-gray-500">{t('preparedness.waterNote')}</p>
      </motion.div>

      {/* Coverage chips */}
      <motion.div
        variants={card}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, delay: 0.1 }}
        className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4"
      >
        <h3 className="mb-3 text-sm font-semibold text-gray-200">{t('preparedness.coverageTitle')}</h3>
        <div className="flex flex-wrap gap-2">
          {result.coverage.map(({ key, present }) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                present
                  ? 'border-green-500/30 bg-green-500/10 text-green-300'
                  : 'border-primary-600 bg-primary-900/40 text-gray-500'
              }`}
            >
              {present ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {t(`categories.${key}`)}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Shopping list */}
      <motion.div
        variants={card}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.3, delay: 0.15 }}
        className="rounded-2xl border border-primary-700 bg-primary-800/60 p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/15">
              <ShoppingCart size={16} className="text-green-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-200">{t('preparedness.shoppingTitle')}</h3>
          </div>
          {shopping.length > 0 && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg border border-primary-600 px-2.5 py-1.5 text-xs text-green-400 transition-colors hover:bg-primary-700/50 hover:text-green-300"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('preparedness.copied') : t('preparedness.copy')}
            </button>
          )}
        </div>

        {shopping.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <Check size={22} className="text-green-400" />
            </div>
            <p className="mt-3 text-sm text-gray-400">{t('preparedness.shoppingEmpty')}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {shopping.map((item, i) => {
                const isWater = item.reason === 'water';
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-primary-900/40 px-3 py-2.5">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isWater ? 'bg-blue-500/15' : 'bg-amber-500/15'}`}>
                      {isWater ? <Droplets size={15} className="text-blue-400" /> : <PackagePlus size={15} className="text-amber-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-200">{item.name}</p>
                      <p className={`text-[0.65rem] ${isWater ? 'text-blue-400' : 'text-amber-400'}`}>
                        {isWater ? t('preparedness.reasonWater') : t('preparedness.reasonLowStock')}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-primary-700/60 px-2 py-1 text-xs font-semibold text-gray-200">
                      {t('preparedness.needed', { amount: item.needed, unit: t(`units.${item.unit}`, item.unit) })}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[0.65rem] text-gray-500">{t('preparedness.shoppingHint')}</p>
          </>
        )}
      </motion.div>

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
