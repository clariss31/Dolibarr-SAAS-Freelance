'use client';

/**
 * @file app/(dashboard)/commerce/page.tsx
 *
 * Page de liste des propositions commerciales (devis).
 *
 * Ce composant gère :
 * - La liste paginée des devis Dolibarr.
 * - Le filtrage par statut et la recherche par texte (debouncée).
 * - Le pré-chargement des tiers pour la résolution des noms.
 * - La navigation vers les détails de chaque devis.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../services/api';
import { getErrorMessage } from '../../../utils/error-handler';
import { Proposal, ApiError, ThirdParty } from '../../../types/dolibarr';
import { formatCurrency, formatDate } from '../../../utils/format';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 400;

// ---------------------------------------------------------------------------
// Composants de présentation
// ---------------------------------------------------------------------------

/** Badge coloré selon le statut du devis */
function ProposalStatusBadge({ status }: { status: string | number }) {
  const s = String(status);
  switch (s) {
    case '1':
      return (
        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
          Ouvert
        </span>
      );
    case '2':
      return (
        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-green-600/20 ring-inset dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
          Signé
        </span>
      );
    case '3':
      return (
        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/10 ring-inset dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20">
          Non signé
        </span>
      );
    case '4':
      return (
        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-purple-700/10 ring-inset dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/30">
          Facturé
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
          Brouillon
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

export default function CommercePage() {
  const router = useRouter();

  // --- États ---
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [thirdPartiesMap, setThirdPartiesMap] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadingTiers, setLoadingTiers] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(0); // Index 0 pour correspondre à billing
  const [totalItems, setTotalItems] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filtres de date
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startDue, setStartDue] = useState('');
  const [endDue, setEndDue] = useState('');

  // Totaux de la période
  const [periodTotalHT, setPeriodTotalHT] = useState(0);
  const [loadingTotal, setLoadingTotal] = useState(false);

  // --- Effets ---

  /** Pré-chargement des tiers (Mapping ID -> Nom) */
  useEffect(() => {
    api
      .get('/thirdparties?limit=1000')
      .then((res) => {
        if (res.data) {
          const dict: Record<string, string> = {};
          res.data.forEach((t: ThirdParty) => {
            dict[String(t.id)] = t.name || (t as any).nom || 'Tiers sans nom';
          });
          setThirdPartiesMap(dict);
        }
      })
      .catch((err) => console.error('Erreur mapping tiers:', err))
      .finally(() => setLoadingTiers(false));
  }, []);

  /** Gestion du Debounce pour la recherche */
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  /** Reset de la pagination lors des changements de filtre */
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, startDate, endDate, startDue, endDue]);

  /** Chargement des devis via l'API */
  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let query = `/proposals?sortfield=t.rowid&sortorder=DESC&limit=${PAGE_LIMIT}&page=${page}`;
      const conditions: string[] = [];

      if (statusFilter !== 'all') {
        conditions.push(`(t.fk_statut:=:${statusFilter})`);
      }

      if (debouncedSearch) {
        const cleanTerm = debouncedSearch.replace(/'/g, "''");
        conditions.push(
          `((t.ref:like:'%${cleanTerm}%') OR (s.nom:like:'%${cleanTerm}%'))`
        );
      }

      // Filtre Date Proposition (t.datep)
      if (startDate) conditions.push(`(t.datep:>=:'${startDate} 00:00:00')`);
      if (endDate) conditions.push(`(t.datep:<=:'${endDate} 23:59:59')`);

      // Filtre Date Fin Validité (t.fin_validite)
      if (startDue)
        conditions.push(`(t.fin_validite:>=:'${startDue} 00:00:00')`);
      if (endDue) conditions.push(`(t.fin_validite:<=:'${endDue} 23:59:59')`);

      if (conditions.length > 0) {
        query += `&sqlfilters=${encodeURIComponent(conditions.join(' AND '))}`;
      }

      const response = await api.get(query);
      if (response.data) {
        setProposals(response.data);
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
        setProposals([]);
        setTotalItems(0);
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.response?.status === 404) {
        setProposals([]);
        setTotalItems(0);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [
    page,
    debouncedSearch,
    statusFilter,
    startDate,
    endDate,
    startDue,
    endDue,
  ]);

  /** Calcule le total HT de tous les devis de la période filtrée. */
  const fetchTotals = useCallback(async () => {
    setLoadingTotal(true);
    try {
      const conditions: string[] = [];
      if (statusFilter !== 'all')
        conditions.push(`(t.fk_statut:=:${statusFilter})`);
      if (debouncedSearch) {
        const safe = debouncedSearch.replace(/'/g, "''");
        conditions.push(
          `((t.ref:like:'%${safe}%') OR (s.nom:like:'%${safe}%'))`
        );
      }
      if (startDate) conditions.push(`(t.datep:>=:'${startDate} 00:00:00')`);
      if (endDate) conditions.push(`(t.datep:<=:'${endDate} 23:59:59')`);
      if (startDue)
        conditions.push(`(t.fin_validite:>=:'${startDue} 00:00:00')`);
      if (endDue) conditions.push(`(t.fin_validite:<=:'${endDue} 23:59:59')`);

      let query = `/proposals?limit=1000`;
      if (conditions.length > 0) {
        query += `&sqlfilters=${encodeURIComponent(conditions.join(' AND '))}`;
      }
      const res = await api.get(query);
      if (Array.isArray(res.data)) {
        const totalHT = res.data.reduce(
          (acc: number, p: any) => acc + (Number(p.total_ht) || 0),
          0
        );
        setPeriodTotalHT(totalHT);
      } else {
        setPeriodTotalHT(0);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setPeriodTotalHT(0);
      } else {
        console.error('Erreur calcul total HT:', err);
      }
    } finally {
      setLoadingTotal(false);
    }
  }, [debouncedSearch, statusFilter, startDate, endDate, startDue, endDue]);

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // --- Handlers & Helpers ---

  const resolveClientName = (prop: Proposal): string => {
    return (
      prop.thirdparty?.name ||
      prop.soc_name ||
      prop.name ||
      thirdPartiesMap[String(prop.socid)] ||
      'Client inconnu'
    );
  };

  const hasMore = proposals.length === PAGE_LIMIT;

  // --- Rendu ---

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Propositions commerciales
          </h1>
          <p className="text-muted mt-2 text-sm">
            Gérez vos devis, consultez leurs dates de validité et leurs statuts.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16">
          <button
            type="button"
            onClick={() => router.push('/commerce/create')}
            className="btn-primary block px-4 py-2"
          >
            + Nouveau devis
          </button>
        </div>
      </div>

      {/* Zone Haute : Dates et Totaux */}
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
        {/* Sélecteurs de date (compact, horizontal, fond ombré) */}
        <div className="bg-primary/5 border-primary/10 flex flex-[2] flex-wrap items-center gap-6 rounded-xl border p-3 lg:flex-nowrap">
          <div className="min-w-[120px] flex-1">
            <label
              htmlFor="date-start"
              className="text-muted mb-1 block text-[9px] font-bold tracking-widest text-nowrap uppercase"
            >
              Proposition du
            </label>
            <input
              id="date-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-2 py-1.5 text-xs ring-1 ring-inset focus:ring-2"
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label
              htmlFor="date-end"
              className="text-muted mb-1 block text-[9px] font-bold tracking-widest uppercase"
            >
              au
            </label>
            <input
              id="date-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-2 py-1.5 text-xs ring-1 ring-inset focus:ring-2"
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label
              htmlFor="due-start"
              className="text-muted mb-1 block text-[9px] font-bold tracking-widest text-nowrap uppercase"
            >
              Fin validité du
            </label>
            <input
              id="due-start"
              type="date"
              value={startDue}
              onChange={(e) => setStartDue(e.target.value)}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-2 py-1.5 text-xs ring-1 ring-inset focus:ring-2"
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label
              htmlFor="due-end"
              className="text-muted mb-1 block text-[9px] font-bold tracking-widest uppercase"
            >
              au
            </label>
            <div className="flex items-center gap-1">
              <input
                id="due-end"
                type="date"
                value={endDue}
                onChange={(e) => setEndDue(e.target.value)}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-2 py-1.5 text-xs ring-1 ring-inset focus:ring-2"
              />
              {(startDate || endDate || startDue || endDue) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setStartDue('');
                    setEndDue('');
                  }}
                  className="text-muted transition-colors hover:text-red-500"
                  title="Réinitialiser"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Résumé HT */}
        <div className="bg-primary/5 border-primary/10 flex flex-1 items-center justify-around rounded-xl border px-8 lg:min-w-[240px] lg:flex-none">
          <div className="flex flex-col text-center">
            <span className="text-muted text-[10px] font-bold tracking-widest text-nowrap uppercase">
              Total HT (Période)
            </span>
            <span className="text-foreground mt-0.5 text-xl leading-tight font-bold">
              {loadingTotal ? '...' : formatCurrency(periodTotalHT)}
            </span>
          </div>
        </div>
      </div>

      {/* Barre de Filtres */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Rechercher un devis
          </label>
          <input
            id="search"
            type="search"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full max-w-md rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="status" className="sr-only">
            Filtrer par état
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset"
          >
            <option value="all">Tous les états</option>
            <option value="0">Brouillon</option>
            <option value="1">Ouvert</option>
            <option value="2">Signé</option>
            <option value="3">Non signé</option>
            <option value="4">Facturé</option>
          </select>
        </div>
      </div>

      {error && (
        <div
          className="animate-in fade-in slide-in-from-top-2 rounded-lg border border-red-900/50 bg-[#2d1414] p-4 text-sm font-medium text-[#ff6b6b] shadow-lg duration-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Liste des devis */}
      <div className="border-border bg-surface ring-border/50 overflow-hidden rounded-xl border shadow-sm ring-1">
        <div className="overflow-x-auto">
          <table className="divide-border min-w-full divide-y">
            <thead className="bg-background">
              <tr>
                <th
                  scope="col"
                  className="text-foreground py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pl-6"
                >
                  Référence
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Tiers
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Date proposition
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Date de fin
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-right text-sm font-semibold"
                >
                  Montant HT
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-center text-sm font-semibold"
                >
                  État
                </th>
              </tr>
            </thead>
            <tbody className="divide-border bg-surface divide-y">
              {loading || loadingTiers ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted py-10 text-center text-sm"
                  >
                    Chargement...
                  </td>
                </tr>
              ) : proposals.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted py-10 text-center text-sm"
                  >
                    Aucun devis trouvé.
                  </td>
                </tr>
              ) : (
                proposals.map((prop) => (
                  <tr
                    key={prop.id}
                    onClick={() => router.push(`/commerce/${prop.id}`)}
                    className="hover:bg-background/80 cursor-pointer transition-colors"
                  >
                    <td className="py-4 pr-3 pl-4 text-sm font-medium sm:pl-6">
                      <span className="text-foreground">{prop.ref}</span>
                    </td>
                    <td className="text-foreground px-3 py-4 text-sm">
                      {resolveClientName(prop)}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {formatDate(prop.datep)}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {formatDate(prop.fin_validite)}
                    </td>
                    <td className="text-foreground px-3 py-4 text-right text-sm whitespace-nowrap">
                      {formatCurrency(prop.total_ht)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm whitespace-nowrap">
                      <ProposalStatusBadge status={prop.statut ?? '0'} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Style Facturation */}
        <div className="border-border bg-surface flex items-center justify-between border-t px-4 py-3 sm:px-6">
          {/* Desktop Version */}
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

          {/* Mobile Version */}
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
