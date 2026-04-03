'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../services/api';
import { getErrorMessage } from '../../../utils/error-handler';
import { Product, ApiError } from '../../../types/dolibarr';

export default function ProductsServicesPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const limit = 10;
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('product'); // product, service

  // Debounce de la recherche textuelle
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchProducts = async (currentPage: number) => {
    setLoading(true);
    setError('');
    try {
      let query = `/products?sortfield=t.rowid&sortorder=DESC&limit=${limit}&page=${currentPage}`;

      // Recherche multi-champs sur Réf et Libellé (Encodage URI obligatoire)
      if (debouncedSearch) {
        const cleanTerm = debouncedSearch.replace(/'/g, "''");
        const sqlFilters = `(t.ref:like:'%${cleanTerm}%') OR (t.label:like:'%${cleanTerm}%')`;
        query += `&sqlfilters=${encodeURIComponent(sqlFilters)}`;
      }

      // L'API Dolibarr attend mode=1 (produit) et mode=2 (service)
      if (typeFilter === 'product') query += `&mode=1`;
      if (typeFilter === 'service') query += `&mode=2`;

      const response = await api.get(query);

      if (response.data && Array.isArray(response.data)) {
        setProducts(response.data);
        setHasMore(response.data.length === limit);
      } else {
        setProducts([]);
        setHasMore(false);
      }
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      if (apiErr.response?.status === 404) {
        setProducts([]);
        setHasMore(false);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(page);
  }, [page, debouncedSearch, typeFilter]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, typeFilter]);

  return (
    <div className="space-y-6">
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
          className="rounded-md bg-red-50 p-4 dark:bg-red-900/30"
          role="alert"
        >
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error}
          </p>
        </div>
      )}

      {/* Onglets Switcher */}
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

      {/* Recherche et filtres */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="max-w-md flex-1">
          <label htmlFor="search" className="sr-only">
            Rechercher
          </label>
          <input
            id="search"
            type="search"
            placeholder={`Rechercher un ${typeFilter === 'product' ? 'produit' : 'service'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
          />
        </div>
      </div>

      {/* Tableau */}
      <div className="border-border bg-surface ring-border/50 overflow-hidden rounded-lg border shadow-sm ring-1">
        <div className="overflow-x-auto">
          <table className="divide-border min-w-full divide-y">
            <thead className="bg-background">
              <tr>
                <th
                  scope="col"
                  className="text-foreground w-[15%] py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pl-6"
                >
                  Référence
                </th>
                <th
                  scope="col"
                  className="text-foreground w-[25%] px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Libellé
                </th>
                <th
                  scope="col"
                  className="text-foreground w-[10%] px-3 py-3.5 text-right text-sm font-semibold"
                >
                  Prix HT
                </th>
                {typeFilter !== 'service' && (
                  <>
                    <th
                      scope="col"
                      className="text-foreground w-[10%] px-3 py-3.5 text-center text-sm font-semibold"
                    >
                      Stock physique
                    </th>
                    <th
                      scope="col"
                      className="text-foreground w-[10%] px-3 py-3.5 text-center text-sm font-semibold"
                    >
                      Stock virtuel
                    </th>
                  </>
                )}
                <th
                  scope="col"
                  className="text-foreground w-[15%] px-3 py-3.5 text-center text-sm font-semibold"
                >
                  État (Vente)
                </th>
                <th
                  scope="col"
                  className="text-foreground w-[15%] px-3 py-3.5 text-center text-sm font-semibold"
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
                    className="text-muted py-10 text-center text-sm"
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
                    Aucun produit trouvé ne correspond à vos critères.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() =>
                      router.push(`/products-services/${product.id}`)
                    }
                    className="hover:bg-background/80 cursor-pointer transition-colors"
                  >
                    <td className="text-foreground py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap sm:pl-6">
                      <span>{product.ref}</span>
                    </td>
                    <td className="text-muted max-w-xs truncate px-3 py-4 text-sm">
                      {product.label}
                    </td>
                    <td className="text-muted px-3 py-4 text-right text-sm font-medium whitespace-nowrap">
                      {product.price
                        ? `${parseFloat(String(product.price)).toFixed(2)} €`
                        : '0.00 €'}
                    </td>
                    {typeFilter !== 'service' && (
                      <>
                        <td className="text-muted px-3 py-4 text-center text-sm whitespace-nowrap">
                          {product.reel_stock || '0'}
                        </td>
                        <td className="text-muted px-3 py-4 text-center text-sm whitespace-nowrap">
                          {product.virtual_stock || '0'}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-4 text-center text-sm whitespace-nowrap">
                      {String(product.tosell) === '1' ? (
                        <span className="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
                          En vente
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                          Hors vente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-center text-sm whitespace-nowrap">
                      {String(product.tobuy) === '1' ? (
                        <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          En achat
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
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

        {/* Pagination Controls */}
        <div className="border-border bg-surface flex items-center justify-between border-t px-4 py-3 sm:px-6">
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-muted text-sm">
                Affichage de la page{' '}
                <span className="font-medium">{page + 1}</span>
              </p>
            </div>
            <div>
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
