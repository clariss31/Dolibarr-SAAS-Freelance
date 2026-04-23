'use client';

/**
 * @file app/(dashboard)/products-services/[id]/page.tsx
 *
 * Page de détail d'un produit ou d'un service Dolibarr.
 *
 * Fonctionnalités :
 * - Affichage complet des informations (Réf, Libellé, Type).
 * - Visualisation des prix HT, TTC et taux de TVA.
 * - Suivi des stocks physiques et virtuels pour les produits.
 * - Rendu de la description détaillée (support HTML).
 * - Actions de modification et de suppression.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { Product, ApiError } from '../../../../types/dolibarr';

// ---------------------------------------------------------------------------
// Helpers (Extract outside component for purity and performance)
// ---------------------------------------------------------------------------

/** Formate un montant en Euros. */
function formatCurrency(price: string | number | undefined): string {
  if (price === undefined) return '0,00 €';
  const num = typeof price === 'string' ? parseFloat(price) : Number(price);
  if (isNaN(num)) return '0,00 €';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num);
}

/** Formate un taux de TVA. */
function formatPercent(value: string | number | undefined): string {
  if (value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num)) return '—';
  return `${num} %`;
}

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

export default function ProductDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // --- États ---
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // --- Logique de récupération ---

  /** Charge les données du produit */
  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/products/${id}`);
      if (response.data) {
        setProduct(response.data);
      } else {
        setError('Produit/Service introuvable.');
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
    fetchProduct();
  }, [fetchProduct]);

  // --- Handlers ---

  /** Supprime définitivement le produit après confirmation */
  const handleDelete = async () => {
    if (
      !window.confirm(
        'Êtes-vous sûr de vouloir supprimer définitivement ce produit ?'
      )
    )
      return;

    setDeleting(true);
    setError('');
    try {
      await api.delete(`/products/${id}`);
      router.push('/products-services');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  };

  // --- Rendu conditionnel (Chargement / Erreur) ---

  if (loading) {
    return (
      <div className="text-muted flex items-center justify-center py-20 text-sm italic">
        Chargement des détails de la fiche...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/products-services')}
          className="text-primary text-sm hover:underline"
        >
          &larr; Retour au catalogue
        </button>
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200">
          {error || 'Introuvable'}
        </div>
      </div>
    );
  }

  const isService = String(product.type) === '1';

  // --- Rendu Principal ---

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <button
          onClick={() => router.push('/products-services')}
          className="text-muted hover:text-foreground text-sm transition-colors hover:underline"
        >
          &larr; Retour au catalogue
        </button>
      </div>

      {/* Header : Titre et Actions */}
      <div className="border-border border-b py-2 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-4xl">{isService ? '⚙️' : '📦'}</span>
          <div>
            <h1 className="text-foreground text-3xl font-bold tracking-tight">
              {product.ref}
            </h1>
            <p className="text-muted mt-1 text-lg">{product.label}</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 sm:flex sm:items-center sm:space-x-4">
          <button
            onClick={() => router.push(`/products-services/${id}/edit`)}
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

      {/* Contenu Principal : Grille d'informations */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Panneau : Type & état */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base font-semibold">
              Type & état
            </h3>
          </div>
          <div className="flex flex-wrap items-start gap-x-12 gap-y-6 p-5">
            <div>
              <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                Type
              </p>
              <p className="text-foreground font-medium">
                {isService ? 'Service' : 'Produit'}
              </p>
            </div>
            <div>
              <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                État (Vente)
              </p>
              {String(product.status ?? product.tosell) === '1' ? (
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-green-600/20 ring-inset dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
                  En vente
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                  Hors vente
                </span>
              )}
            </div>
            <div>
              <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                État (Achat)
              </p>
              {String(product.status_buy ?? product.tobuy) === '1' ? (
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
                  En achat
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                  Hors achat
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Panneau : Tarification */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base font-semibold">
              Prix de vente
            </h3>
          </div>
          <div className="flex flex-wrap items-start gap-x-12 gap-y-6 p-5">
            <div>
              <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                Prix HT
              </p>
              <p className="text-foreground text-2xl font-bold">
                {formatCurrency(product.price)}
              </p>
            </div>
            <div>
              <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                TVA
              </p>
              <p className="text-foreground text-2xl font-bold">
                {formatPercent(product.tva_tx)}
              </p>
            </div>
            <div>
              <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                Prix TTC
              </p>
              <p className="text-foreground text-2xl font-bold">
                {formatCurrency(product.price_ttc)}
              </p>
            </div>
          </div>
        </div>

        {/* Panneau : Description détaillée */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md sm:col-span-2">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base font-semibold">
              Description détaillée
            </h3>
          </div>
          <div className="p-5">
            {product.description ? (
              <div
                className="prose prose-sm dark:prose-invert text-foreground/80 max-w-none"
                dangerouslySetInnerHTML={{
                  __html: product.description.replace(/\n/g, '<br/>'),
                }}
              />
            ) : (
              <p className="text-muted text-sm italic">Aucune description.</p>
            )}
          </div>
        </div>

        {/* Panneau : Stocks (Produits uniquement) */}
        {!isService && (
          <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md sm:col-span-2">
            <div className="border-border bg-background border-b px-5 py-4">
              <h3 className="text-foreground text-base font-semibold">
                Gestion des stocks
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <div>
                <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                  Stock physique
                </p>
                <div className="bg-background border-border text-foreground inline-flex items-center rounded-md border px-4 py-2 font-bold">
                  {product.stock_reel || '0'}
                </div>
              </div>
              <div>
                <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                  Stock virtuel
                </p>
                <div className="bg-background border-border text-foreground inline-flex items-center rounded-md border px-4 py-2 font-bold">
                  {product.stock_theorique || '0'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
