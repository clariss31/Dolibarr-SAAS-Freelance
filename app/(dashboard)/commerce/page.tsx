'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../services/api';
import { Proposal, ApiError, ThirdParty } from '../../../types/dolibarr';

export default function CommercePage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [thirdPartiesMap, setThirdPartiesMap] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadingThirdParties, setLoadingThirdParties] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 20;

  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    // Charger le mapping des tiers une seule fois au montage
    api
      .get('/thirdparties?limit=1000')
      .then((res) => {
        if (res.data) {
          const dict: Record<string, string> = {};
          res.data.forEach((t: ThirdParty) => {
            dict[String(t.id)] = t.name || (t as any).nom;
          });
          setThirdPartiesMap(dict);
        }
      })
      .catch((err) => console.error('Could not preload third parties', err))
      .finally(() => setLoadingThirdParties(false));
  }, []);

  // Recherche automatique après 400ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchProposals = async () => {
    setLoading(true);
    setError('');
    try {
      let query = `/proposals?sortfield=t.rowid&sortorder=DESC&limit=${limit}&page=${page - 1}`;

      const conditions: string[] = [];

      if (statusFilter !== 'all') {
        conditions.push(`(t.fk_statut:=:${statusFilter})`);
      }

      if (debouncedSearch) {
        const cleanTerm = debouncedSearch.replace(/'/g, "''");
        // Tentative de recherche sur la REF du devis et optionnellement le nom
        conditions.push(
          `((t.ref:like:'%${cleanTerm}%') OR (s.nom:like:'%${cleanTerm}%'))`
        );
      }

      if (conditions.length > 0) {
        query += `&sqlfilters=${encodeURIComponent(conditions.join(' AND '))}`;
      }

      const response = await api.get(query);
      if (response.data) {
        setProposals(response.data);
      } else {
        setProposals([]);
      }
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      if (apiErr.response?.status === 404) {
        setProposals([]);
      } else {
        setError(
          apiErr.response?.data?.error?.message ||
            'Erreur lors du chargement des propositions commerciales.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [page, debouncedSearch, statusFilter]);

  // Reset page 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const formatPrice = (price: string | number) => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(num);
  };

  const formatDate = (timestamp: string | number | undefined) => {
    if (!timestamp) return '-';
    const ts =
      typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    return new Date(ts * 1000).toLocaleDateString('fr-FR');
  };

  const getStatusBadge = (status: string | number) => {
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
      case '0':
      default:
        // Par défaut = Brouillon comme demandé
        return (
          <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
            Brouillon
          </span>
        );
    }
  };

  const getThirdPartyName = (proposal: Proposal) => {
    if (proposal.thirdparty?.name) return proposal.thirdparty.name;
    if (proposal.soc_name) return proposal.soc_name;
    if (proposal.name) return proposal.name;

    // Fallback dynamique au Map pré-chargé
    const mapped = thirdPartiesMap[String(proposal.socid)];
    if (mapped) return mapped;

    return `Tiers inconnu`;
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Propositions commerciales
          </h1>
          <p className="text-muted mt-2 text-sm">
            Gérez vos devis, consultez leurs dates de validité et leurs statuts.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => router.push('/commerce/create')}
            className="btn-primary block px-3 py-2 text-center"
          >
            + Nouveau devis
          </button>
        </div>
      </div>
      {/* Barre de filtres et recherche */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Rechercher
          </label>
          <input
            id="search"
            type="search"
            placeholder="Chercher une référence ou client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full max-w-md rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
          />
        </div>

        <div>
          <label htmlFor="status-filter" className="sr-only">
            Filtrer par statut
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
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
          className="rounded-md bg-red-50 p-4 dark:bg-red-900/30"
          role="alert"
        >
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error}
          </p>
        </div>
      )}

      {/* Tableau */}
      <div className="border-border bg-surface ring-border/50 overflow-hidden rounded-lg border shadow-sm ring-1">
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
              {loading || loadingThirdParties ? (
                // Loader global
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted py-10 text-center text-sm"
                  >
                    Recherche en cours...
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
                proposals.map((proposal) => (
                  <tr
                    key={proposal.id}
                    onClick={() => router.push(`/commerce/${proposal.id}`)}
                    className="hover:bg-background/80 cursor-pointer transition-colors"
                  >
                    <td className="py-4 pr-3 pl-4 text-sm font-medium sm:pl-6">
                      <span className="text-foreground">{proposal.ref}</span>
                    </td>
                    <td className="text-foreground px-3 py-4 text-sm">
                      {getThirdPartyName(proposal)}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {formatDate(proposal.datep)}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {formatDate(proposal.fin_validite)}
                    </td>
                    <td className="text-foreground px-3 py-4 text-right text-sm whitespace-nowrap">
                      {formatPrice(proposal.total_ht)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm whitespace-nowrap">
                      {getStatusBadge(proposal.statut)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && (proposals.length >= limit || page > 1) && (
          <div className="border-border bg-surface flex items-center justify-between border-t px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:justify-end">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-foreground ring-border hover:bg-muted/10 relative inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus-visible:outline-offset-0 disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={proposals.length < limit}
                className="text-foreground ring-border hover:bg-muted/10 relative ml-3 inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus-visible:outline-offset-0 disabled:opacity-50"
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
