'use client';

/**
 * @file app/(dashboard)/products-services/page.tsx
 *
 * Page de liste du catalogue Produits & Services.
 *
 * Fonctionnalités :
 * - Navigation par onglets (Produits vs Services).
 * - Recherche textuelle debouncée sur référence et libellé.
 * - Pagination fluide (style Dolibarr / Facturation).
 * - Affichage dynamique des colonnes de stock selon le type.
 * - Badges de statut (Vente/Achat) avec codes couleurs.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../services/api';
import { getErrorMessage } from '../../../utils/error-handler';
import { Product, ApiError } from '../../../types/dolibarr';

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

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 400;

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

export default function ProductsServicesPage() {
  const router = useRouter();

  // --- États : Liste & Données ---
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- États : Pagination ---
  const [page, setPage] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // --- États : Filtres ---
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('product'); // product, service

  // --- Effets ---

  /** Gestion du Debounce pour la recherche textuelle */
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  /** Reset de la pagination lors du changement de filtres */
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, typeFilter]);

  /** Chargement des données depuis l'API Dolibarr */
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let query = `/products?sortfield=t.rowid&sortorder=DESC&limit=${PAGE_LIMIT}&page=${page}`;

      // 1. Filtre par type (mode=1 pour produits, mode=2 pour services)
      query += typeFilter === 'product' ? '&mode=1' : '&mode=2';

      // 2. Filtre de recherche SQL
      if (debouncedSearch) {
        const cleanTerm = debouncedSearch.replace(/'/g, "''");
        const sqlFilters = `(t.ref:like:'%${cleanTerm}%') OR (t.label:like:'%${cleanTerm}%')`;
        query += `&sqlfilters=${encodeURIComponent(sqlFilters)}`;
      }

      const response = await api.get(query);

      if (response.data && Array.isArray(response.data)) {
        setProducts(response.data);
        setHasMore(response.data.length === PAGE_LIMIT);

        // Récupération du total pour la pagination
        const total = response.headers?.get('X-Total-Count');
        if (total) {
          setTotalItems(parseInt(total, 10));
        } else {
          // Fallback d'estimation si le header est manquant
          setTotalItems(
            response.data.length +
              (response.data.length === PAGE_LIMIT ? PAGE_LIMIT : 0)
          );
        }
      } else {
        setProducts([]);
        setHasMore(false);
        setTotalItems(0);
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.response?.status === 404) {
        setProducts([]);
        setHasMore(false);
        setTotalItems(page === 0 ? 0 : totalItems);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, totalItems]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // --- Rendu ---

  return (
    <div className="space-y-6">
      {/* En-tête de page */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Produits & Services
          </h1>
          <p className="text-muted mt-2 text-sm">
            Gérez votre catalogue, consultez les stocks et statuts de vente.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => router.push('/products-services/create')}
            className="btn-primary block px-3 py-2 text-center"
          >
            + Nouveau produit / service
          </button>
        </div>
      </div>

      {error && (
        <div
          className="rounded-md bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Onglets (Tabs) */}
      <div className="border-border border-b">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setTypeFilter('product')}
            className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              typeFilter === 'product'
                ? 'border-primary text-primary'
                : 'text-muted hover:border-border hover:text-foreground border-transparent'
            }`}
          >
            📦 Produits
          </button>
          <button
            onClick={() => setTypeFilter('service')}
            className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              typeFilter === 'service'
                ? 'border-primary text-primary'
                : 'text-muted hover:border-border hover:text-foreground border-transparent'
            }`}
          >
            ⚙️ Services
          </button>
        </nav>
      </div>

      {/* Barre de recherche */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="max-w-md flex-1">
          <input
            id="search"
            type="search"
            placeholder={`Rechercher...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md px-3 py-2 text-sm shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
          />
        </div>
      </div>

      {/* Tableau des données */}
      <div className="border-border bg-surface ring-border/50 overflow-hidden rounded-lg border shadow-sm ring-1">
        <div className="overflow-x-auto">
          <table className="divide-border min-w-full table-fixed divide-y">
            <thead className="bg-background">
              <tr>
                <th
                  scope="col"
                  className="text-foreground w-40 py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pl-6"
                >
                  Référence
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Libellé
                </th>
                <th
                  scope="col"
                  className="text-foreground w-32 px-3 py-3.5 text-right text-sm font-semibold"
                >
                  Prix HT
                </th>
                {typeFilter !== 'service' && (
                  <>
                    <th
                      scope="col"
                      className="text-foreground w-32 px-3 py-3.5 text-center text-sm font-semibold"
                    >
                      Stock phys.
                    </th>
                    <th
                      scope="col"
                      className="text-foreground w-32 px-3 py-3.5 text-center text-sm font-semibold"
                    >
                      Stock virt.
                    </th>
                  </>
                )}
                <th
                  scope="col"
                  className="text-foreground w-32 px-3 py-3.5 text-center text-sm font-semibold"
                >
                  État (Vente)
                </th>
                <th
                  scope="col"
                  className="text-foreground w-32 px-3 py-3.5 text-center text-sm font-semibold"
                >
                  État (Achat)
                </th>
              </tr>
            </thead>
            <tbody className="divide-border bg-surface divide-y">
              {loading && products.length === 0 ? (
                <tr>
                  <td
                    colSpan={typeFilter === 'service' ? 5 : 7}
                    className="text-muted py-10 text-center text-sm italic"
                  >
                    Recherche en cours...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td
                    colSpan={typeFilter === 'service' ? 5 : 7}
                    className="text-muted py-10 text-center text-sm"
                  >
                    Aucun élément trouvé.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/products-services/${p.id}`)}
                    className="hover:bg-background/80 cursor-pointer transition-colors"
                  >
                    <td className="text-foreground py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap sm:pl-6">
                      <span>{p.ref}</span>
                    </td>
                    <td className="text-muted max-w-xs truncate px-3 py-4 text-sm">
                      {p.label}
                    </td>
                    <td className="text-muted px-3 py-4 text-right text-sm font-medium whitespace-nowrap">
                      {formatCurrency(p.price)}
                    </td>
                    {typeFilter !== 'service' && (
                      <>
                        <td className="text-muted px-3 py-4 text-center text-sm whitespace-nowrap">
                          {p.stock_reel || '0'}
                        </td>
                        <td className="text-muted px-3 py-4 text-center text-sm whitespace-nowrap">
                          {p.stock_theorique || '0'}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-4 text-center text-sm whitespace-nowrap">
                      {String(p.status ?? p.tosell) === '1' ? (
                        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-green-600/20 ring-inset dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
                          En vente
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                          Hors vente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-center text-sm whitespace-nowrap">
                      {String(p.status_buy ?? p.tobuy) === '1' ? (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
                          En achat
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                          Hors achat
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Style Facturation */}
        <div className="border-border bg-surface flex items-center justify-between border-t px-4 py-3 sm:px-6">
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <p className="text-muted text-sm">
              Page <span className="font-medium">{page + 1}</span>
              {totalItems > 0 && (
                <span>
                  {' '}
                  /{' '}
                  <span className="font-medium">
                    {Math.ceil(totalItems / PAGE_LIMIT)}
                  </span>
                </span>
              )}
            </p>
            <nav
              className="isolate inline-flex -space-x-px rounded-md shadow-sm"
              aria-label="Pagination"
            >
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="text-muted ring-border hover:bg-background hover:text-foreground relative inline-flex items-center rounded-l-md px-2 py-2 ring-1 ring-inset focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="sr-only">Précédent</span>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore || loading}
                className="text-muted ring-border hover:bg-background hover:text-foreground relative inline-flex items-center rounded-r-md px-2 py-2 ring-1 ring-inset focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="sr-only">Suivant</span>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </nav>
          </div>

          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="border-border bg-surface text-foreground hover:bg-background relative inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore || loading}
              className="border-border bg-surface text-foreground hover:bg-background relative ml-3 inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
