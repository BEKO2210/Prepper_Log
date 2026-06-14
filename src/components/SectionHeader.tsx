import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Tone = 'green' | 'blue' | 'orange' | 'yellow' | 'purple' | 'cyan' | 'red';

const TONES: Record<Tone, string> = {
  green: 'bg-green-500/15 text-green-400',
  blue: 'bg-blue-500/15 text-blue-400',
  orange: 'bg-orange-500/15 text-orange-400',
  yellow: 'bg-yellow-500/15 text-yellow-400',
  purple: 'bg-purple-500/15 text-purple-400',
  cyan: 'bg-cyan-500/15 text-cyan-400',
  red: 'bg-red-500/15 text-red-400',
};

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  tone?: Tone;
  /** Optional trailing element (e.g. a "see all" link). */
  action?: ReactNode;
  className?: string;
}

/** Consistent section header: a tinted icon badge + title (matches the score page). */
export function SectionHeader({ icon: Icon, title, tone = 'green', action, className = 'mb-3' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <Icon size={16} />
        </span>
        <h3 className="truncate text-sm font-semibold text-gray-200">{title}</h3>
      </div>
      {action}
    </div>
  );
}
