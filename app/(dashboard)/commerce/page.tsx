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

// ---------------------------------------------------------------------------
// Constantes et Helpers
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;

/** Formate un prix en Euros. */
function formatCurrency(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : Number(price);
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num);
}

/** Formate un timestamp Dolibarr en date dd/mm/yyyy. */
function formatDate(timestamp: string | number | undefined): string {
  if (!timestamp) return '-';
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : Number(timestamp);
  if (isNaN(ts) || ts === 0) return '-';
  return new Date(ts * 1000).toLocaleDateString('fr-FR');
}

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
  const [proposals,       setProposals]       = useState<Proposal[]>([]);
  const [thirdPartiesMap, setThirdPartiesMap] = useState<Record<string, string>>({});
  const [loading,         setLoading]         = useState(true);
  const [loadingTiers,   setLoadingTiers]   = useState(true);
  const [error,           setError]           = useState('');

  const [page,       setPage]       = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchTerm,      setSearchTerm]      = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter,    setStatusFilter]    = useState('all');

  // --- Effets ---

  /** Pré-chargement des tiers (Mapping ID -> Nom) */
  useEffect(() => {
    api.get('/thirdparties?limit=1000')
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
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  /** Chargement des devis via l'API */
  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let query = `/proposals?sortfield=t.rowid&sortorder=DESC&limit=${PAGE_LIMIT}&page=${page - 1}`;
      const conditions: string[] = [];

      if (statusFilter !== 'all') {
        conditions.push(`(t.fk_statut:=:${statusFilter})`);
      }

      if (debouncedSearch) {
        const cleanTerm = debouncedSearch.replace(/'/g, "''");
        conditions.push(`((t.ref:like:'%${cleanTerm}%') OR (s.nom:like:'%${cleanTerm}%'))`);
      }

      if (conditions.length > 0) {
        query += `&sqlfilters=${encodeURIComponent(conditions.join(' AND '))}`;
      }

      const response = await api.get(query);
      if (response.data) {
        setProposals(response.data);
        
        // Récupération de la pagination depuis les headers HTTP
        const total = response.headers?.get('X-Total-Count');
        if (total) {
          setTotalItems(parseInt(total, 10));
        } else {
          // Fallback sil'header est absent (estimation)
          setTotalItems(response.data.length + (response.data.length === PAGE_LIMIT ? PAGE_LIMIT : 0));
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
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // --- Handlers & Helpers ---

  /** Résout le nom du client depuis le devis ou le mapping pré-chargé */
  const resolveClientName = (prop: Proposal): string => {
    return (
      prop.thirdparty?.name || 
      prop.soc_name || 
      prop.name || 
      thirdPartiesMap[String(prop.socid)] || 
      'Client inconnu'
    );
  };

  // --- Rendu ---

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Propositions commerciales</h1>
          <p className="text-muted mt-2 text-sm">Gérez vos devis, consultez leurs dates de validité et leurs statuts.</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0">
          <button
            type="button"
            onClick={() => router.push('/commerce/create')}
            className="btn-primary block px-4 py-2"
          >
            + Nouveau devis
          </button>
        </div>
      </div>

      {/* Barre de Filtres */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            type="search"
            placeholder="Chercher une référence ou un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full max-w-md rounded-md px-3 py-2 text-sm ring-1 ring-inset"
          />
        </div>
        <div>
          <select
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
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Liste des devis */}
      <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm ring-1 ring-border/50">
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
                    Mise à jour de la liste...
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

        {/* Pagination bar */}
        {!loading && (proposals.length >= PAGE_LIMIT || page > 1) && (
          <div className="border-border flex items-center justify-between border-t bg-surface px-6 py-4">
            <p className="text-sm text-muted">
              Page <span className="font-bold text-foreground">{page}</span>
              {totalItems > 0 && <span> sur {Math.ceil(totalItems / PAGE_LIMIT)}</span>}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-30"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={proposals.length < PAGE_LIMIT}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-30"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
