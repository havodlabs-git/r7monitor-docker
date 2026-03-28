import { Clock } from "lucide-react";

export const TIME_RANGES = [
  { value: 15,    label: "15 min" },
  { value: 30,    label: "30 min" },
  { value: 60,    label: "1 hora" },
  { value: 360,   label: "6 horas" },
  { value: 1440,  label: "24 horas" },
  { value: 10080, label: "7 dias" },
] as const;

export type TimeRangeMinutes = typeof TIME_RANGES[number]["value"];

interface TimeRangeSelectorProps {
  value: TimeRangeMinutes;
  onChange: (value: TimeRangeMinutes) => void;
  className?: string;
}

export function TimeRangeSelector({ value, onChange, className = "" }: TimeRangeSelectorProps) {
  return (
    <div className={`flex items-center gap-1 rounded-lg border border-border bg-card p-1 ${className}`}>
      <Clock className="w-3.5 h-3.5 text-muted-foreground ml-1.5 mr-0.5 shrink-0" />
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 whitespace-nowrap ${
            value === range.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

/** Converte minutesAgo para uma label legível */
export function timeRangeLabel(minutes: TimeRangeMinutes): string {
  return TIME_RANGES.find((r) => r.value === minutes)?.label ?? `${minutes} min`;
}
