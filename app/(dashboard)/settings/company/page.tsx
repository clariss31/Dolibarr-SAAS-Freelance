'use client';

import { useState, useEffect } from 'react';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { Organization } from '../../../../types/dolibarr';

/**
 * Page de consultation de la fiche entreprise.
 * Lecture via GET /setup/company.
 * Note : La mise à jour n'est pas supportée par l'API REST Dolibarr standard.
 */
export default function CompanySettingsPage() {
  // --- États ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [org, setOrg] = useState<Organization | null>(null);

  // --- Pays ---
  const [countries, setCountries] = useState<
    { id: string | number; label: string }[]
  >([]);

  // --- Initialisation ---

  /** Charge le dictionnaire des pays pour la résolution des labels */
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await api.get(
          '/setup/dictionary/countries?sortfield=label&sortorder=ASC&lang=fr_FR'
        );
        if (Array.isArray(res.data)) {
          setCountries(res.data.filter((c: any) => String(c.active) === '1'));
        }
      } catch (err) {
        console.warn('Erreur chargement pays:', err);
      }
    };
    fetchCountries();
  }, []);

  /** Charge les informations de l'organisation */
  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const response = await api.get('/setup/company');
        if (response.data) {
          setOrg(response.data as Organization);
        } else {
          setError("Impossible de récupérer les informations de l'entreprise.");
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchOrg();
  }, []);

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted animate-pulse text-sm italic">
          Chargement des informations entreprise...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-border flex items-center gap-4 border-b pb-4">
        <div className="flex-1">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Entreprise
          </h1>
          <p className="text-muted mt-1 text-sm">
            Informations juridiques et fiscales de votre activité freelance.
          </p>
        </div>
        <div className="flex max-w-2xl items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3 shadow-sm">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-400 text-slate-900">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>
          <p className="text-[13px] leading-snug text-slate-300">
            <span className="font-semibold text-slate-100">Note :</span> Ces
            informations sont en lecture seule. Pour les modifier, utilisez
            l'administration Dolibarr.
          </p>
        </div>
      </div>

      {/* Alerte Erreur */}
      {error && (
        <div
          className="animate-in fade-in slide-in-from-top-2 rounded-lg border border-red-900/50 bg-[#2d1414] p-4 text-sm font-medium text-[#ff6b6b] shadow-lg duration-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Identité de l'entreprise */}
      <div className="bg-surface border-border overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-background border-border border-b px-5 py-4">
          <h2 className="text-foreground text-base leading-6 font-semibold">
            Identité de l'entreprise
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
          {/* Raison sociale */}
          <div className="sm:col-span-2">
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              Raison sociale / Nom commercial
            </span>
            <p className="text-foreground mt-1 text-base font-semibold">
              {org?.name || '-'}
            </p>
          </div>

          {/* Email */}
          <div>
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              E-mail
            </span>
            <p className="text-foreground mt-1 text-sm">{org?.email || '-'}</p>
          </div>

          {/* Téléphone */}
          <div>
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              Téléphone
            </span>
            <p className="text-foreground mt-1 text-sm">{org?.phone || '-'}</p>
          </div>

          {/* Site web */}
          <div className="sm:col-span-2">
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              Site web
            </span>
            <p className="text-foreground mt-1 text-sm">
              {org?.url ? (
                <a
                  href={org.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {org.url}
                </a>
              ) : (
                '-'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Adresse du siège */}
      <div className="bg-surface border-border overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-background border-border border-b px-5 py-4">
          <h2 className="text-foreground text-base leading-6 font-semibold">
            Adresse du siège social
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              Adresse
            </span>
            <p className="text-foreground mt-1 text-sm">
              {org?.address || '-'}
            </p>
          </div>
          <div>
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              Code postal
            </span>
            <p className="text-foreground mt-1 text-sm">{org?.zip || '-'}</p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              Ville
            </span>
            <p className="text-foreground mt-1 text-sm">{org?.town || '-'}</p>
          </div>
          <div>
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              Pays
            </span>
            <p className="text-foreground mt-1 text-sm">
              {countries.find((c) => String(c.id) === String(org?.country_id))
                ?.label || '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Informations légales et fiscales */}
      <div className="bg-surface border-border overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-background border-border border-b px-5 py-4">
          <h2 className="text-foreground text-base leading-6 font-semibold">
            Informations légales &amp; fiscales
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
          {/* SIRET */}
          <div>
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              SIRET
            </span>
            <p className="text-foreground mt-1 font-mono text-sm">
              {org?.idprof1 || '-'}
            </p>
          </div>

          {/* SIREN */}
          <div>
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              SIREN
            </span>
            <p className="text-foreground mt-1 font-mono text-sm">
              {org?.idprof2 || '-'}
            </p>
          </div>

          {/* Assujetti à la TVA */}
          <div>
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              Assujettissement à la TVA
            </span>
            <p className="mt-1">
              {org?.tva_assuj === '1' || org?.tva_assuj === 1 ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  Oui
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-900/30 dark:text-slate-300">
                  Non
                </span>
              )}
            </p>
          </div>

          {/* Numéro TVA intracommunautaire */}
          <div>
            <span className="text-muted text-xs font-medium tracking-wider uppercase">
              N° TVA intracommunautaire
            </span>
            <p className="text-foreground mt-1 font-mono text-sm">
              {org?.tva_intra || '-'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
