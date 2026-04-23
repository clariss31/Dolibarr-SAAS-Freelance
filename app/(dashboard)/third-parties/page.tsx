'use client';

/**
 * @file app/(dashboard)/third-parties/page.tsx
 *
 * Page de liste des tiers (Clients, Prospects, Fournisseurs).
 *
 * Fonctionnalités :
 * - Filtrage par type de tiers (Client, Prospect, Fournisseur, Tous).
 * - Recherche textuelle debouncée sur le nom du tiers.
 * - Pagination standardisée (style Dolibarr/SaaS).
 * - Affichage des coordonnées directes (Email, Tél) avec liens d'action.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../services/api';
import { getErrorMessage } from '../../../utils/error-handler';
import { ThirdParty, ApiError } from '../../../types/dolibarr';

// ---------------------------------------------------------------------------
// Helpers (Extract outside component for purity)
// ---------------------------------------------------------------------------

/** Détermine l'affichage du type de tiers pour le tableau */
function getTierTypeLabels(tier: ThirdParty): React.ReactNode {
  const types: string[] = [];
  const clientStatus = String(tier.client);

  if (clientStatus === '1' || clientStatus === '3') types.push('Client');
  if (clientStatus === '2' || clientStatus === '3') types.push('Prospect');
  if (String(tier.fournisseur) === '1') types.push('Fournisseur');

  if (types.length === 0)
    return <span className="text-muted italic">Non défini</span>;
  return types.join(' / ');
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 400;

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

export default function ThirdPartiesPage() {
  const router = useRouter();

  // --- États : Liste & Données ---
  const [tiers, setTiers] = useState<ThirdParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- États : Pagination ---
  const [page, setPage] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // --- États : Filtres ---
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all, client, prospect, fournisseur

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
  const fetchTiers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let query = `/thirdparties?sortfield=t.rowid&sortorder=DESC&limit=${PAGE_LIMIT}&page=${page}`;

      // 1. Filtre par type via le paramètre natif "mode" de Dolibarr
      if (typeFilter === 'client') query += `&mode=1`;
      if (typeFilter === 'prospect') query += `&mode=2`;
      if (typeFilter === 'fournisseur') query += `&mode=4`;

      // 2. Filtre de recherche SQL
      if (debouncedSearch) {
        const cleanTerm = debouncedSearch.replace(/'/g, "''");
        const sqlFilters = `(t.nom:like:'%${cleanTerm}%')`;
        query += `&sqlfilters=${encodeURIComponent(sqlFilters)}`;
      }

      const response = await api.get(query);

      if (response.data && Array.isArray(response.data)) {
        setTiers(response.data);
        setHasMore(response.data.length === PAGE_LIMIT);

        // Récupération du total pour la pagination
        const total = response.headers?.get('X-Total-Count');
        if (total) {
          setTotalItems(parseInt(total, 10));
        } else {
          setTotalItems(
            response.data.length +
              (response.data.length === PAGE_LIMIT ? PAGE_LIMIT : 0)
          );
        }
      } else {
        setTiers([]);
        setHasMore(false);
        setTotalItems(0);
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.response?.status === 404) {
        setTiers([]);
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
    fetchTiers();
  }, [fetchTiers]);

  // --- Rendu ---

  return (
    <div className="space-y-6">
      {/* En-tête de page */}
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
            className="btn-primary block px-3 py-2 text-center shadow-sm"
          >
            + Nouveau tiers
          </button>
        </div>
      </div>

      {error && (
        <div 
          className="rounded-lg bg-[#2d1414] border border-red-900/50 p-4 text-sm text-[#ff6b6b] shadow-lg font-medium animate-in fade-in slide-in-from-top-2 duration-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Barre d'outils (Recherche & Filtres) */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="flex-1">
          <input
            id="search"
            type="search"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-background text-foreground ring-border focus:ring-primary block w-full max-w-md rounded-md px-3 py-2 text-sm shadow-sm ring-1 ring-inset focus:ring-2"
          />
        </div>
        <div>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm shadow-sm ring-1 ring-inset focus:ring-2"
          >
            <option value="all">Tous les types</option>
            <option value="client">Client</option>
            <option value="prospect">Prospect</option>
            <option value="fournisseur">Fournisseur</option>
          </select>
        </div>
      </div>

      {/* Tableau des Tiers */}
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
                    className="text-muted py-10 text-center text-sm italic"
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
                    Aucun tiers trouvé.
                  </td>
                </tr>
              ) : (
                tiers.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/third-parties/${t.id}`)}
                    className="hover:bg-background/80 cursor-pointer transition-colors"
                  >
                    <td className="text-foreground py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap sm:pl-6">
                      <span className="font-semibold">{t.name}</span>
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {getTierTypeLabels(t)}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {t.email ? (
                        <a
                          href={`mailto:${t.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary font-medium hover:underline"
                        >
                          {t.email}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {t.phone ? (
                        <a
                          href={`tel:${t.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary font-medium hover:underline"
                        >
                          {t.phone}
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

        {/* Pagination Style SaaS */}
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
