'use client';

/**
 * @file app/(dashboard)/third-parties/[id]/page.tsx
 *
 * Page de détail d'un tiers (Client, Prospect, Fournisseur) Dolibarr.
 *
 * Fonctionnalités :
 * - Affichage exhaustif des coordonnées (Contact, Adresse).
 * - Visualisation des identifiants légaux (SIRET, TVA).
 * - Démodulation du type de tiers (Client/Prospect/Fournisseur).
 * - Actions rapides : Modification, Suppression.
 * - Support responsive pour les grilles d'informations.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { ThirdParty, ApiError } from '../../../../types/dolibarr';

// ---------------------------------------------------------------------------
// Helpers (Extract outside component for purity)
// ---------------------------------------------------------------------------

/** Détermine le type de tiers sous forme de texte lisible */
function getTierTypeLabels(tier: ThirdParty): string {
  const types: string[] = [];
  const clientStatus = String(tier.client);

  if (clientStatus === '1' || clientStatus === '3') types.push('Client');
  if (clientStatus === '2' || clientStatus === '3') types.push('Prospect');
  if (String(tier.fournisseur) === '1') types.push('Fournisseur');

  return types.length > 0 ? types.join(' / ') : 'Non défini';
}

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

export default function ThirdPartyDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // --- États ---
  const [tier, setTier] = useState<ThirdParty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // --- Logique de récupération ---

  /** Charge les informations du tiers depuis l'API */
  const fetchTier = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/thirdparties/${id}`);
      if (response.data) {
        setTier(response.data);
      } else {
        setError('Tiers introuvable.');
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.response?.status === 404) {
        notFound();
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTier();
  }, [fetchTier]);

  // --- Handlers ---

  /** Supprime définitivement le tiers */
  const handleDelete = async () => {
    const confirmMsg =
      'Êtes-vous sûr de vouloir supprimer définitivement ce tiers ?';
    if (!window.confirm(confirmMsg)) return;

    setDeleting(true);
    setError('');
    try {
      await api.delete(`/thirdparties/${id}`);
      router.push('/third-parties');
    } catch (err: unknown) {
      const apiErr = err as any;
      let detailMsg = 'Une erreur est survenue lors de la suppression.';
      
      const rawMessage = apiErr.response?.data?.error?.message || '';
      if (rawMessage.includes('product is probably used') || apiErr.response?.status === 409) {
        detailMsg = 'Impossible de supprimer ce tiers car il est lié à des documents (factures, devis, etc.).';
      } else if (rawMessage) {
        detailMsg = rawMessage;
      }

      setError(detailMsg);
      setDeleting(false);
      // Remonter en haut de page pour voir l'erreur
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- Rendu conditionnel ---

  if (loading) {
    return (
      <div className="text-muted flex items-center justify-center py-20 text-sm italic">
        Chargement des détails de la fiche...
      </div>
    );
  }

  if (!tier) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/third-parties')}
          className="text-primary text-sm hover:underline"
        >
          &larr; Retour à la liste
        </button>
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200">
          Tiers introuvable
        </div>
      </div>
    );
  }

  // --- Rendu Principal ---

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane / Retour */}
      <div className="flex items-center">
        <button
          onClick={() => router.push('/third-parties')}
          className="text-muted hover:text-foreground text-sm transition-colors hover:underline"
        >
          &larr; Retour à la liste
        </button>
      </div>

      {/* Alertes d'erreur (ex: échec de suppression) */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200" role="alert">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="font-semibold">{error}</p>
          </div>
        </div>
      )}

      {/* Header : Titre et Actions */}
      <div className="border-border border-b py-2 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-foreground text-3xl font-bold tracking-tight">
            {tier.name}
          </h1>
          <span className="bg-primary/10 text-primary ring-primary/20 inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset">
            {getTierTypeLabels(tier)}
          </span>
        </div>
        <div className="mt-4 sm:mt-0 sm:flex sm:items-center sm:space-x-4">
          <button
            onClick={() => router.push(`/third-parties/${id}/edit`)}
            className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 transition-colors ring-inset hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700"
          >
            Modifier
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm font-semibold text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
          >
            {deleting ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>

      {/* Contenu : Grille de fiches */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Panneau : Coordonnées */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base font-semibold">
              Coordonnées de contact
            </h3>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Email Principal
              </p>
              <p className="text-foreground mt-1 text-sm">
                {tier.email ? (
                  <a
                    href={`mailto:${tier.email}`}
                    className="text-primary hover:underline"
                  >
                    {tier.email}
                  </a>
                ) : (
                  <span className="text-muted italic">Non renseigné</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Téléphone
              </p>
              <p className="text-foreground mt-1 text-sm">
                {tier.phone ? (
                  <a
                    href={`tel:${tier.phone}`}
                    className="text-primary hover:underline"
                  >
                    {tier.phone}
                  </a>
                ) : (
                  <span className="text-muted italic">Non renseigné</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Site Web
              </p>
              <p className="text-foreground mt-1 text-sm">
                {tier.url ? (
                  <a
                    href={
                      tier.url.startsWith('http')
                        ? tier.url
                        : `https://${tier.url}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary block truncate hover:underline"
                  >
                    {tier.url}
                  </a>
                ) : (
                  <span className="text-muted italic">Non renseigné</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Panneau : Adresse */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base font-semibold">
              Adresse postale
            </h3>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Rue / Voie
              </p>
              <p className="text-foreground mt-1 text-sm">
                {tier.address || (
                  <span className="text-muted italic">Non renseignée</span>
                )}
              </p>
            </div>
            <div className="flex space-x-8">
              <div>
                <p className="text-muted text-xs font-medium tracking-wider uppercase">
                  Code postal
                </p>
                <p className="text-foreground mt-1 text-sm">
                  {tier.zip || '-'}
                </p>
              </div>
              <div>
                <p className="text-muted text-xs font-medium tracking-wider uppercase">
                  Ville
                </p>
                <p className="text-foreground mt-1 text-sm">
                  {tier.town || '-'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Pays
              </p>
              <p className="text-foreground mt-1 text-sm">
                {tier.country || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Panneau : Identifiants Légaux */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md sm:col-span-2">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base font-semibold">
              Identifiants Légaux & Informations Référentiel
            </h3>
          </div>
          <div className="flex flex-col space-y-4 p-5 sm:flex-row sm:space-y-0 sm:space-x-12">
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Numéro de TVA
              </p>
              <p className="text-foreground mt-1 text-sm">
                {tier.tva_intra || (
                  <span className="text-muted italic">Non renseigné</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                SIRET
              </p>
              <p className="text-foreground mt-1 text-sm">
                {tier.idprof2 || (
                  <span className="text-muted italic">Non renseigné</span>
                )}
              </p>
            </div>
            {/* Code Client */}
            {(String(tier.client) !== '0') && (
              <div>
                <p className="text-muted text-xs font-medium tracking-wider uppercase">
                  Code client
                </p>
                <p className="text-foreground bg-background border-border mt-1 max-w-fit rounded border px-2 py-0.5 font-mono text-sm">
                  {tier.code_client || 'Non défini'}
                </p>
              </div>
            )}

            {/* Code Fournisseur */}
            {String(tier.fournisseur) === '1' && (
              <div>
                <p className="text-muted text-xs font-medium tracking-wider uppercase">
                  Code fournisseur
                </p>
                <p className="text-foreground bg-background border-border mt-1 max-w-fit rounded border px-2 py-0.5 font-mono text-sm">
                  {tier.code_fournisseur || 'Non défini'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
