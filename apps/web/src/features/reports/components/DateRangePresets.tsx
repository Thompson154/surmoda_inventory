// Preset buttons for the report date range selector.
// Each preset fills the from/to inputs with a pre-computed range.

import { cn } from '@/shared/ui/cn';

export type PresetKey = 'today' | '7d' | '1m' | '4m' | '6m' | 'custom';

interface Preset {
  key: PresetKey;
  label: string;
}

const PRESETS: Preset[] = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '1m', label: '1 mes' },
  { key: '4m', label: '4 meses' },
  { key: '6m', label: '6 meses' },
  { key: 'custom', label: 'Personalizado' },
];

interface DateRangePresetsProps {
  selected: PresetKey;
  onChange: (preset: PresetKey) => void;
}

export function DateRangePresets({ selected, onChange }: DateRangePresetsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => onChange(preset.key)}
          className={cn(
            'rounded-md border text-xs font-medium px-2 py-1.5 transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1',
            selected === preset.key
              ? 'bg-brand-primary border-brand-primary text-white'
              : 'bg-surface-raised border-surface-border text-text-secondary hover:bg-surface-sunken',
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
