import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Tone = 'green' | 'blue' | 'orange' | 'yellow' | 'purple' | 'cyan' | 'red';

/* Struktur spricht in Messing, Farbe bleibt dem Status vorbehalten:
   nur "orange" und "red" faerben wirklich, alles andere ist Beschriftung. */
const TONES: Record<Tone, string> = {
  green: 'text-[color:var(--pt-accent)]',
  blue: 'text-[color:var(--pt-accent)]',
  orange: 'text-[color:var(--pt-warn)]',
  yellow: 'text-[color:var(--pt-accent)]',
  purple: 'text-[color:var(--pt-accent)]',
  cyan: 'text-[color:var(--pt-accent)]',
  red: 'text-[color:var(--pt-crit)]',
};

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  tone?: Tone;
  /** Optional trailing element (e.g. a "see all" link). */
  action?: ReactNode;
  className?: string;
}

/** Abschnittskopf im Inventarblatt-Stil: Symbol, Versalien-Beschriftung, feine Linie. */
export function SectionHeader({ icon: Icon, title, tone = 'green', action, className = 'mb-3' }: SectionHeaderProps) {
  const toneClass = TONES[tone];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Icon size={15} className={`shrink-0 ${toneClass}`} />
      <h3 className={`eyebrow shrink-0 ${toneClass}`}>{title}</h3>
      <span className="h-px min-w-4 flex-1 bg-primary-700" aria-hidden="true" />
      {action}
    </div>
  );
}
