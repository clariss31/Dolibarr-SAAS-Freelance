'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../services/api';
import { getErrorMessage } from '../../../utils/error-handler';
import { Invoice, ApiError } from '../../../types/dolibarr';

export default function BillingPaymentsPage() {
  const router = useRouter();

  // Tabs state
  const [activeTab, setActiveTab] = useState<'client' | 'supplier'>('client');

  // Data state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [thirdPartiesMap, setThirdPartiesMap] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadingThirdParties, setLoadingThirdParties] = useState(true);
  const [error, setError] = useState('');

  // Pagination state
  const [page, setPage] = useState(0);
  const limit = 10;
  const [hasMore, setHasMore] = useState(true);

  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Charger le mapping des tiers une seule fois au montage
  useEffect(() => {
    api
      .get('/thirdparties?limit=1000')
      .then((res) => {
        if (res.data) {
          const dict: Record<string, string> = {};
          res.data.forEach((t: any) => {
            dict[String(t.id)] = t.name || t.nom || t.soc_name;
          });
          setThirdPartiesMap(dict);
        }
      })
      .catch((err) => console.error('Could not preload third parties', err))
      .finally(() => setLoadingThirdParties(false));
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchInvoices = async (currentPage: number) => {
    setLoading(true);
    setError('');
    try {
      const endpoint =
        activeTab === 'client' ? '/invoices' : '/supplierinvoices';
      let query = `${endpoint}?sortfield=t.rowid&sortorder=DESC&limit=${limit}&page=${currentPage}`;
      const conditions: string[] = [];

      if (statusFilter !== 'all') {
        const field = activeTab === 'supplier' ? 't.fk_statut' : 't.fk_statut';
        conditions.push(`(${field}:=:${statusFilter})`);
      }

      if (debouncedSearch) {
        const cleanTerm = debouncedSearch.replace(/'/g, "''");
        // Recherche sur REF et nom du tiers (s.nom pour Dolibarr)
        conditions.push(
          `((t.ref:like:'%${cleanTerm}%') OR (s.nom:like:'%${cleanTerm}%'))`
        );
      }

      if (conditions.length > 0) {
        query += `&sqlfilters=${encodeURIComponent(conditions.join(' AND '))}`;
      }

      const response = await api.get(query);

      if (response.data && Array.isArray(response.data)) {
        setInvoices(response.data);
        setHasMore(response.data.length === limit);
      } else {
        setInvoices([]);
        setHasMore(false);
      }
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      if (apiErr.response?.status === 404) {
        // 404 means no records found for these filters/page
        setInvoices([]);
        setHasMore(false);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch when page, tab or search changes
  useEffect(() => {
    fetchInvoices(page);
  }, [page, activeTab, debouncedSearch, statusFilter]);

  // Reset page to 0 when tab or search changes
  useEffect(() => {
    setPage(0);
  }, [activeTab, debouncedSearch, statusFilter]);

  // Utility to format numbers into currency
  const formatCurrency = (amount: string | number | undefined) => {
    if (amount === undefined || amount === null || amount === '') return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(Number(amount));
  };

  // Utility to format timestamps/dates
  const formatDate = (timestamp: number | string | undefined) => {
    if (!timestamp) return '-';

    // Si c'est une string ISO (ex: 2024-03-15)
    if (typeof timestamp === 'string' && timestamp.includes('-')) {
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat('fr-FR').format(date);
    }

    const numTs = Number(timestamp);
    if (isNaN(numTs)) return '-';

    // Dolibarr renvoie souvent le timestamp en secondes
    const ms = numTs < 10000000000 ? numTs * 1000 : numTs;
    return new Intl.DateTimeFormat('fr-FR').format(new Date(ms));
  };

  // Badge pour l'état avec couleurs accessibles
  const getStatusBadge = (invoice: Invoice) => {
    const status = Number(invoice.statut);

    switch (status) {
      case 0:
        return (
          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-500/10 ring-inset">
            Brouillon
          </span>
        );
      case 1:
        // Dans Dolibarr, l'état 1 est validée (impayée ou partiellement payée)
        return (
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20 ring-inset">
            Impayée
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
            Payée
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/10 ring-inset">
            Abandonnée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset">
            Inconnu
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Facturation & Paiements
          </h1>
          <p className="text-muted mt-2 text-sm">
            Suivi des factures, paiements et encours
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => router.push('/billing-payments/create')}
            className="btn-primary block px-3 py-2 text-center"
          >
            + Nouvelle facture
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

      {/* Tabs Switcher */}
      <div className="border-border border-b">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('client')}
            className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
              activeTab === 'client'
                ? 'border-primary text-primary'
                : 'text-muted hover:text-foreground border-transparent hover:border-gray-300'
            } `}
          >
            Factures clients
          </button>
          <button
            onClick={() => setActiveTab('supplier')}
            className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
              activeTab === 'supplier'
                ? 'border-primary text-primary'
                : 'text-muted hover:text-foreground border-transparent hover:border-gray-300'
            } `}
          >
            Factures fournisseurs
          </button>
        </nav>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Rechercher
          </label>
          <input
            id="search"
            type="search"
            placeholder="Rechercher par réf. ou client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full max-w-md rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
          />
        </div>
        <div className="sm:flex-none">
          <label htmlFor="status" className="sr-only">
            État
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:w-48"
          >
            <option value="all">Tous les états</option>
            <option value="0">Brouillon</option>
            <option value="1">Impayée</option>
            <option value="2">Payée</option>
            <option value="3">Abandonnée</option>
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
                  className="text-foreground py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pl-6"
                >
                  Référence
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Échéance
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-left text-sm font-semibold"
                >
                  Tiers
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-right text-sm font-semibold"
                >
                  Montant HT
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-right text-sm font-semibold"
                >
                  Montant TTC
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
                <tr>
                  <td
                    colSpan={7}
                    className="text-muted py-10 text-center text-sm"
                  >
                    Recherche en cours...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-muted py-10 text-center text-sm"
                  >
                    Aucune facture trouvée.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() =>
                      router.push(
                        `/billing-payments/${invoice.id}?type=${activeTab}`
                      )
                    }
                    className="hover:bg-background/80 cursor-pointer transition-colors"
                  >
                    <td className="text-foreground py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap sm:pl-6">
                      {invoice.ref}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {formatDate(invoice.date)}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {formatDate(
                        invoice.datelimit || (invoice as any).date_lim_reglement
                      )}
                    </td>
                    <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                      {invoice.thirdparty?.name ||
                        invoice.soc_name ||
                        invoice.nom ||
                        thirdPartiesMap[String(invoice.socid)] ||
                        '-'}
                    </td>
                    <td className="text-foreground px-3 py-4 text-right text-sm font-medium whitespace-nowrap">
                      {formatCurrency(invoice.total_ht)}
                    </td>
                    <td className="text-foreground px-3 py-4 text-right text-sm font-medium whitespace-nowrap">
                      {formatCurrency(invoice.total_ttc)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm whitespace-nowrap">
                      {getStatusBadge(invoice)}
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
