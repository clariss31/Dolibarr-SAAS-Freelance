'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { ThirdParty, ApiError } from '../../../../types/dolibarr';

export default function ThirdPartyDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [tier, setTier] = useState<ThirdParty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer définitivement ce tiers ?')) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/thirdparties/${id}`);
      router.push('/third-parties');
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      setError(apiErr.response?.data?.error?.message || 'Impossible de supprimer ce tiers. Il est probablement lié à des factures ou propositions commerciales existantes.');
      setDeleting(false);
    }
  };

  useEffect(() => {
    const fetchTier = async () => {
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
    };
    if (id) fetchTier();
  }, [id]);

  const getTierType = (tier: ThirdParty) => {
    const types = [];
    if (String(tier.client) === '1' || String(tier.client) === '3')
      types.push('Client');
    if (String(tier.client) === '2' || String(tier.client) === '3')
      types.push('Prospect');
    if (String(tier.fournisseur) === '1') types.push('Fournisseur');
    return types.length > 0 ? types.join(' / ') : 'Non défini';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted text-center text-sm">
          Chargement des détails de la fiche...
        </div>
      </div>
    );
  }

  if (error || !tier) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/third-parties')}
          className="text-primary decoration-primary text-sm hover:underline"
        >
          &larr; Retour à la liste
        </button>
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset">
          {error || 'Introuvable'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center">
        <button
          onClick={() => router.push('/third-parties')}
          className="text-muted hover:text-foreground text-sm transition-colors hover:underline"
        >
          &larr; Retour à la liste
        </button>
      </div>

      {/* Title Header */}
      <div className="border-border border-b py-2 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-foreground text-3xl font-bold tracking-tight">
            {tier.name}
          </h1>
          <span className="bg-primary/10 text-primary ring-primary/20 inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset">
            {getTierType(tier)}
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

      {/* Grid panels */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {/* Contact */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
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

        {/* Address Card */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
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

        {/* Identifiants Légaux Card */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md sm:col-span-2">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
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
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Code Client
              </p>
              <p className="text-foreground bg-background border-border mt-1 rounded border px-2 py-0.5 font-mono text-sm">
                {tier.code_client || 'Généré automatiquement'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
