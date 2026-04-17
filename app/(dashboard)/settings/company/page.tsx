'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { Organization } from '../../../../types/dolibarr';

/**
 * Page de consultation de la fiche entreprise (société freelance).
 * Lecture via GET /setup/company.
 * Note : La mise à jour n'est pas supportée par l'API REST Dolibarr standard.
 */
export default function CompanySettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [org, setOrg] = useState<Organization | null>(null);

  // Chargement des infos organisation
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted text-sm">
          Chargement des informations entreprise...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="border-border flex items-center gap-4 border-b pb-4">
        <div className="flex-1">
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Entreprise
          </h1>
          <p className="text-muted mt-1 text-sm">
            Informations juridiques et fiscales de votre activité freelance.
          </p>
        </div>
        <div className="max-w-xs rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <p>
            <strong>Note :</strong> Ces informations sont en lecture seule. Pour
            les modifier, veuillez vous rendre dans l'interface d'administration
            de Dolibarr.
          </p>
        </div>
      </div>

      {/* Alerte Erreur */}
      {error && (
        <div
          className="rounded-md bg-red-50 p-4 dark:bg-red-900/30"
          role="alert"
        >
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error}
          </p>
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
              E-mail de contact
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
