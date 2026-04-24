'use client';

import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PeriodType = 'week' | 'month' | 'year' | 'custom';

/**
 * Définit une période de temps pour le filtrage des données du dashboard.
 */
export interface Period {
  type: PeriodType;
  startDate?: Date;
  endDate?: Date;
}

interface PeriodFilterProps {
  /** Période actuellement sélectionnée */
  period: Period;
  /** Callback déclenché lors du changement de période */
  onChange: (period: Period) => void;
}

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

/**
 * Composant de sélection de période (Dernière semaine, mois, année ou personnalisé).
 * Gère l'affichage dynamique des champs de date pour le mode 'custom'.
 */
export default function PeriodFilter({ period, onChange }: PeriodFilterProps) {
  // --- États Locaux ---
  const [localType, setLocalType] = useState<PeriodType>(period.type);
  const [customStart, setCustomStart] = useState<string>(
    period.startDate ? period.startDate.toISOString().split('T')[0] : ''
  );
  const [customEnd, setCustomEnd] = useState<string>(
    period.endDate ? period.endDate.toISOString().split('T')[0] : ''
  );

  // Synchronisation avec les props externes
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

  // --- Handlers ---

  /**
   * Gère le changement de type de période prédéfini.
   */
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as PeriodType;
    setLocalType(newType);

    const now = new Date();
    let start: Date | undefined;
    const end: Date = now;

    // Calcul automatique des dates de début
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
      // En mode personnalisé, on attend que l'utilisateur choisisse ses dates
      return;
    }

    onChange({ type: newType, startDate: start, endDate: end });
  };

  /**
   * Déclenche la mise à jour globale si les deux dates personnalisées sont saisies.
   */
  const triggerCustomChange = (startStr: string, endStr: string) => {
    if (localType === 'custom' && startStr && endStr) {
      onChange({
        type: 'custom',
        startDate: new Date(startStr),
        endDate: new Date(endStr),
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-surface border-border flex flex-col items-start gap-4 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center">
      {/* Sélecteur de type */}
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
          className="bg-background border-input text-foreground focus:ring-primary focus:border-primary rounded-md border px-3 py-2 text-sm transition-all"
        >
          <option value="week">Dernière semaine</option>
          <option value="month">Dernier mois</option>
          <option value="year">Dernière année</option>
          <option value="custom">Date personnalisée</option>
        </select>
      </div>

      {/* Inputs Date (Mode Personnalisé) */}
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
                const val = e.target.value;
                setCustomStart(val);
                triggerCustomChange(val, customEnd);
              }}
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
                const val = e.target.value;
                setCustomEnd(val);
                triggerCustomChange(customStart, val);
              }}
              className="bg-background border-input text-foreground focus:ring-primary focus:border-primary max-h-[38px] rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

