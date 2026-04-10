'use client';

import { useState, useEffect } from 'react';

export type PeriodType = 'week' | 'month' | 'year' | 'custom';

export interface Period {
  type: PeriodType;
  startDate?: Date;
  endDate?: Date;
}

interface PeriodFilterProps {
  period: Period;
  onChange: (period: Period) => void;
}

export default function PeriodFilter({ period, onChange }: PeriodFilterProps) {
  const [localType, setLocalType] = useState<PeriodType>(period.type);
  const [customStart, setCustomStart] = useState<string>(
    period.startDate ? period.startDate.toISOString().split('T')[0] : ''
  );
  const [customEnd, setCustomEnd] = useState<string>(
    period.endDate ? period.endDate.toISOString().split('T')[0] : ''
  );

  useEffect(() => {
    setLocalType(period.type);
    if (period.type === 'custom') {
      setCustomStart(
        period.startDate ? period.startDate.toISOString().split('T')[0] : ''
      );
      setCustomEnd(
        period.endDate ? period.endDate.toISOString().split('T')[0] : ''
      );
    }
  }, [period]);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as PeriodType;
    setLocalType(newType);

    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined = now;

    if (newType === 'week') {
      start = new Date();
      start.setDate(now.getDate() - 7);
    } else if (newType === 'month') {
      start = new Date();
      start.setDate(now.getDate() - 30);
    } else if (newType === 'year') {
      start = new Date();
      start.setDate(now.getDate() - 365);
    } else if (newType === 'custom') {
      // Pour custom, on ne déclenche pas onChange tout de suite,
      // on attend que l'utilisateur remplisse les dates.
      return;
    }

    onChange({ type: newType, startDate: start, endDate: end });
  };

  const handleCustomDateChange = () => {
    if (localType === 'custom' && customStart && customEnd) {
      onChange({
        type: 'custom',
        startDate: new Date(customStart),
        endDate: new Date(customEnd),
      });
    }
  };

  return (
    <div className="bg-surface border-border flex flex-col items-start gap-4 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="flex flex-col">
        <label
          htmlFor="period-select"
          className="text-foreground mb-1 text-sm font-medium"
        >
          Période (CA)
        </label>
        <select
          id="period-select"
          value={localType}
          onChange={handleTypeChange}
          className="bg-background border-input text-foreground focus:ring-primary focus:border-primary rounded-md border px-3 py-2 text-sm"
        >
          <option value="week">Dernière semaine (7 jours)</option>
          <option value="month">Dernier mois (30 jours)</option>
          <option value="year">Dernière année (365 jours)</option>
          <option value="custom">Date personnalisée</option>
        </select>
      </div>

      {localType === 'custom' && (
        <div className="mt-2 flex flex-wrap items-end gap-3 sm:mt-0">
          <div className="flex flex-col">
            <label
              htmlFor="start-date"
              className="text-foreground mb-1 text-xs font-medium"
            >
              Du
            </label>
            <input
              type="date"
              id="start-date"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                // Déclencher le changement dans un setTimeout pour avoir la valeur la plus récente
                setTimeout(handleCustomDateChange, 0);
              }}
              onBlur={handleCustomDateChange}
              className="bg-background border-input text-foreground focus:ring-primary focus:border-primary max-h-[38px] rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label
              htmlFor="end-date"
              className="text-foreground mb-1 text-xs font-medium"
            >
              Au
            </label>
            <input
              type="date"
              id="end-date"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setTimeout(handleCustomDateChange, 0);
              }}
              onBlur={handleCustomDateChange}
              className="bg-background border-input text-foreground focus:ring-primary focus:border-primary max-h-[38px] rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
