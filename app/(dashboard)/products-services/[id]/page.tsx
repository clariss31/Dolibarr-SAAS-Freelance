'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { Product, ApiError } from '../../../../types/dolibarr';

export default function ProductDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer définitivement ce produit ?')) return;
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

  useEffect(() => {
    const fetchProduct = async () => {
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
    };
    if (id) fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted text-center text-sm">
          Chargement des détails de la fiche...
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/products-services')}
          className="text-primary decoration-primary text-sm hover:underline"
        >
          &larr; Retour au catalogue
        </button>
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset">
          {error || 'Introuvable'}
        </div>
      </div>
    );
  }

  const isService = String(product.type) === '1';

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

      {/* Title Header */}
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

      {/* Grid panels */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Paramètres d'État */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
              Situation & Nature
            </h3>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Type
              </p>
              <p className="text-foreground mt-1 font-medium">
                {isService ? 'Service' : 'Produit physique'}
              </p>
            </div>
            <div className="flex space-x-6">
              <div>
                <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                  État (Vente)
                </p>
                {String(product.tosell) === '1' ? (
                  <span className="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
                    En vente
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Hors vente
                  </span>
                )}
              </div>
              <div>
                <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                  État (Achat)
                </p>
                {String(product.tobuy) === '1' ? (
                  <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    En achat
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    Hors achat
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Info */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
              Tarification
            </h3>
          </div>
          <div className="space-y-4 p-5">
            <div className="bg-background border-border flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-muted text-xs font-medium tracking-wider uppercase">
                  Prix hors taxe (HT)
                </p>
                <p className="text-foreground mt-1 text-2xl font-bold">
                  {product.price
                    ? `${parseFloat(String(product.price)).toFixed(2)} €`
                    : '0.00 €'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted text-xs font-medium tracking-wider uppercase">
                  Taux TVA
                </p>
                <p className="text-foreground mt-1 text-sm font-medium">
                  {product.tva_tx
                    ? `${parseFloat(String(product.tva_tx))} %`
                    : 'Non défini'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Prix Toutes Taxes Comprises (TTC)
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {product.price_ttc
                  ? `${parseFloat(String(product.price_ttc)).toFixed(2)} €`
                  : '0.00 €'}
              </p>
            </div>
          </div>
        </div>

        {/* Description Description */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md sm:col-span-2">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
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
              <p className="text-muted text-sm italic">
                Aucune description fournie pour ce produit/service.
              </p>
            )}
          </div>
        </div>

        {/* Stock Info (for products only) */}
        {!isService && (
          <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md sm:col-span-2">
            <div className="border-border bg-background border-b px-5 py-4">
              <h3 className="text-foreground text-base leading-6 font-semibold">
                Gestion des stocks
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <div>
                <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                  Stock physique (réel)
                </p>
                <div className="bg-background border-border text-foreground inline-flex items-center rounded-md border px-4 py-2 font-bold">
                  {product.stock_reel || '0'}
                </div>
              </div>
              <div>
                <p className="text-muted mb-2 text-xs font-medium tracking-wider uppercase">
                  Stock virtuel (théorique)
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
