'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../services/api';
import { ThirdParty, ApiError } from '../../../types/dolibarr';

export default function ThirdPartiesPage() {
  const router = useRouter();
  const [tiers, setTiers] = useState<ThirdParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const limit = 10;
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all, client, prospect, fournisseur

  // Handle Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchTiers = async (currentPage: number) => {
    setLoading(true);
    setError('');
    try {
      let query = `/thirdparties?sortfield=t.rowid&sortorder=DESC&limit=${limit}&page=${currentPage}`;

      const conditions = [];
      if (debouncedSearch) {
        conditions.push(`(t.nom:like:'%${debouncedSearch}%')`);
      }

      if (conditions.length > 0) {
        query += `&sqlfilters=${encodeURIComponent(conditions.join(' AND '))}`;
      }

      // Utilisation du paramètre natif "mode" de l'API Dolibarr pour filtrer les Tiers
      if (typeFilter === 'client') query += `&mode=1`;
      if (typeFilter === 'prospect') query += `&mode=2`;
      if (typeFilter === 'fournisseur') query += `&mode=4`;

      const response = await api.get(query);

      if (response.data && Array.isArray(response.data)) {
        setTiers(response.data);
        setHasMore(response.data.length === limit);
      } else {
        setTiers([]);
        setHasMore(false);
      }
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      if (apiErr.response?.status === 404) {
        // 404 means no records found for these filters/page
        setTiers([]);
        setHasMore(false);
      } else {
        setError(
          "Impossible de charger les tiers. Vérifiez votre connexion à l'API."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when page, search, or type changes
  useEffect(() => {
    fetchTiers(page);
  }, [page, debouncedSearch, typeFilter]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, typeFilter]);

  const getTierType = (tier: ThirdParty) => {
    const types = [];
    if (String(tier.client) === '1' || String(tier.client) === '3')
      types.push('Client');
    if (String(tier.client) === '2' || String(tier.client) === '3')
      types.push('Prospect');
    if (String(tier.fournisseur) === '1') types.push('Fournisseur');

    if (types.length === 0)
      return <span className="text-muted">Non défini</span>;
    return types.join(' / ');
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Tiers
          </h1>
          <p className="text-muted mt-2 text-sm">
            Recherchez et gérez vos clients, prospects et fournisseurs.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => router.push('/third-parties/create')}
            className="btn-primary block px-3 py-2 text-center"
          >
            + Nouveau tiers
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

      {/* Filters Bar */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Rechercher
          </label>
          <input
            id="search"
            type="search"
            placeholder="Recherche..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full max-w-md rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
          />
        </div>
        <div>
          <label htmlFor="type-filter" className="sr-only">
            Filtrer par type
          </label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
          >
            <option value="all">Tous les types</option>
            <option value="client">Client</option>
            <option value="prospect">Prospect</option>
            <option value="fournisseur">Fournisseur</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border-border bg-surface ring-border/50 overflow-hidden rounded-lg border shadow-sm ring-1">
        <div className="overflow-x-auto">
          <table className="divide-border min-w-full divide-y">
            <thead className="bg-background">
              <tr>
                <th
                  scope="col"
                  className="text-foreground w-[35%] py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pl-6"
                >
                  Nom
                </th>
                <th
                  scope="col"
                  className="text-foreground w-[15%] px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="text-foreground w-[25%] px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="text-foreground w-[15%] px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Téléphone
                </th>
              </tr>
            </thead>
            <tbody className="divide-border bg-surface divide-y">
              {loading && tiers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-muted py-10 text-center text-sm"
                  >
                    Recherche en cours...
                  </td>
                </tr>
              ) : tiers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-muted py-10 text-center text-sm"
                  >
                    Aucun tiers trouvé ne correspond à vos critères.
                  </td>
                </tr>
              ) : (
                tiers.map((tier) => (
                  <tr
                    key={tier.id}
                    onClick={() => router.push(`/third-parties/${tier.id}`)}
                    className="hover:bg-background/80 cursor-pointer transition-colors"
                  >
                    <td className="text-foreground py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap sm:pl-6">
                      {tier.name}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {getTierType(tier)}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {tier.email ? (
                        <a
                          href={`mailto:${tier.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                        >
                          {tier.email}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {tier.phone ? (
                        <a
                          href={`tel:${tier.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                        >
                          {tier.phone}
                        </a>
                      ) : (
                        '-'
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
