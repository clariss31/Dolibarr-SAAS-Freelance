'use client';

/**
 * @file billing-payments/page.tsx
 *
 * Page de liste des factures (clients et fournisseurs).
 *
 * Fonctionnement :
 * - Deux onglets switchent entre factures clients (`/invoices`) et
 *   fournisseurs (`/supplierinvoices`).
 * - Un mapping des tiers est préchargé au montage pour résoudre les noms
 *   des tiers absents des données de facture (clé = socid, valeur = nom).
 * - La recherche est debouncée (400 ms) pour limiter les appels API.
 * - La pagination est gérée côté serveur via les paramètres `page` et `limit`.
 * - Le total est lu dans l'en-tête HTTP `X-Total-Count` (avec fallback).
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../services/api';
import { getErrorMessage } from '../../../utils/error-handler';
import { Invoice, ApiError } from '../../../types/dolibarr';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Nombre de factures par page. */
const PAGE_LIMIT = 10;

/** Délai de debounce pour la recherche (en millisecondes). */
const SEARCH_DEBOUNCE_MS = 400;

/**
 * Décale une date YYYY-MM-DD d'un nombre de jours et retourne le résultat au format YYYYMMDD.
 * Utilisé pour convertir >= en > (décalage -1) et <= en < (décalage +1),
 * car le parser sqlfilters de Dolibarr n'accepte que < et > comme opérateurs de comparaison.
 */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${dd}`;
}

/** Convertit une date YYYY-MM-DD en format YYYYMMDD sans décalage. */
function toDoliDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

/** Onglet actif : factures clients ou fournisseurs. */
type InvoiceTab = 'client' | 'supplier';

// ---------------------------------------------------------------------------
// Helpers purs
// ---------------------------------------------------------------------------

/**
 * Formate un montant en euros avec la locale française.
 * Retourne '-' si la valeur est absente ou invalide.
 */
function formatCurrency(amount: string | number | undefined): string {
  if (amount === undefined || amount === null || amount === '') return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount));
}

/**
 * Formate un timestamp Dolibarr (secondes Unix ou chaîne ISO) en date lisible `dd/mm/yyyy`.
 * Retourne '-' si la valeur est absente ou invalide.
 */
function formatDate(timestamp: number | string | undefined): string {
  if (!timestamp) return '-';

  // Déjà au format ISO (YYYY-MM-DD ou YYYY-MM-DD HH:mm:ss)
  if (typeof timestamp === 'string' && timestamp.includes('-')) {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(timestamp));
  }

  const numTs = Number(timestamp);
  if (isNaN(numTs)) return '-';

  // Dolibarr retourne des secondes ; on détecte les millisecondes (> 10 chiffres)
  const ms = numTs < 10_000_000_000 ? numTs * 1000 : numTs;
  return new Intl.DateTimeFormat('fr-FR').format(new Date(ms));
}

/**
 * Détermine si une facture est en retard de paiement.
 * Critères : statut = 1 (impayée) ET date d'échéance dépassée.
 */
function isOverdue(invoice: Invoice): boolean {
  if (Number(invoice.statut) !== 1) return false;

  const limitRaw =
    invoice.datelimit ?? invoice.date_lim_reglement ?? invoice.date_echeance;
  if (!limitRaw) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  let limitSeconds = 0;

  if (typeof limitRaw === 'string' && limitRaw.includes('-')) {
    const ms = new Date(limitRaw).getTime();
    if (!isNaN(ms)) limitSeconds = Math.floor(ms / 1000);
  } else {
    const raw = Number(limitRaw);
    // Normalisation : secondes si retourné en millisecondes
    limitSeconds = raw > 10_000_000_000 ? Math.floor(raw / 1000) : raw;
  }

  return limitSeconds > 0 && limitSeconds < nowSeconds;
}

// ---------------------------------------------------------------------------
// Composants de présentation
// ---------------------------------------------------------------------------

/** Badge coloré représentant le statut d'une facture Dolibarr. */
function StatusBadge({ invoice }: { invoice: Invoice }) {
  switch (Number(invoice.statut)) {
    case 0:
      return (
        <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-500/10 ring-inset">
          Brouillon
        </span>
      );
    case 1: {
      const invAny = invoice as any;
      // 'totalpaid' est le champ exact identifié sur votre serveur
      const sommePaye = Number(invAny.totalpaid) || 0;

      if (sommePaye > 0) {
        return (
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20 ring-inset">
            Règlement commencé
          </span>
        );
      }
      return (
        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20 ring-inset">
          Impayée
        </span>
      );
    }
    case 2: {
      const invAny = invoice as any;
      const totalTtc = Number(invAny.total_ttc) || 0;
      const sommePaye = Number(invAny.totalpaid) || 0;
      const isPartiallyPaid = sommePaye < totalTtc - 0.001; // Tolérance pour les arrondis

      if (isPartiallyPaid) {
        return (
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-600/20 ring-inset">
            Payée partiellement
          </span>
        );
      }
      return (
        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
          Payée
        </span>
      );
    }
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
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

/**
 * Page listant les factures clients et fournisseurs.
 *
 * Gère : la navigation par onglets, la recherche debouncée, le filtre par statut,
 * la pagination serveur et l'affichage du nom des tiers via un dictionnaire préchargé.
 */
function BillingPaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- Onglet actif ---
  const initialTab = (searchParams.get('tab') as InvoiceTab) || 'client';
  const [activeTab, setActiveTab] = useState<InvoiceTab>(
    initialTab === 'supplier' ? 'supplier' : 'client'
  );

  // Synchronisation de l'onglet avec l'URL (si le paramètre change via navigation)
  useEffect(() => {
    const tab = searchParams.get('tab') as InvoiceTab;
    if (tab === 'supplier' || tab === 'client') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // --- Données ---
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  /** Dictionnaire socid → nom du tiers, préchargé au montage. */
  const [thirdPartiesMap, setThirdPartiesMap] = useState<
    Record<string, string>
  >({});

  // --- État de chargement ---
  const [loading, setLoading] = useState(true);
  const [loadingThirdParties, setLoadingThirdParties] = useState(true);
  const [error, setError] = useState('');

  // --- Pagination ---
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  // --- Filtres ---
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Nouveaux filtres de date
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startDue, setStartDue] = useState('');
  const [endDue, setEndDue] = useState('');

  // Totaux de la période
  const [periodTotals, setPeriodTotals] = useState({ ht: 0, ttc: 0 });
  const [loadingTotals, setLoadingTotals] = useState(false);

  // ---------------------------------------------------------------------------
  // Préchargement du dictionnaire des tiers
  // ---------------------------------------------------------------------------

  useEffect(() => {
    /**
     * Charge tous les tiers (jusqu'à 1000) pour construire un dictionnaire
     * id → nom, utilisé pour résoudre le nom affiché dans le tableau quand
     * la réponse de l'API facture ne l'inclut pas.
     */
    api
      .get('/thirdparties?limit=1000')
      .then((res) => {
        if (!Array.isArray(res.data)) return;

        const dict: Record<string, string> = {};
        (
          res.data as Array<{
            id: string | number;
            name?: string;
            nom?: string;
            soc_name?: string;
          }>
        ).forEach((t) => {
          dict[String(t.id)] = t.name ?? t.nom ?? t.soc_name ?? '';
        });

        setThirdPartiesMap(dict);
      })
      .catch((err) =>
        console.error('Impossible de précharger les tiers :', err)
      )
      .finally(() => setLoadingThirdParties(false));
  }, []);

  // ---------------------------------------------------------------------------
  // Debounce de la recherche
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ---------------------------------------------------------------------------
  // Réinitialisation de la page lors d'un changement de filtre
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setPage(0);
  }, [
    activeTab,
    debouncedSearch,
    statusFilter,
    startDate,
    endDate,
    startDue,
    endDue,
  ]);

  // ---------------------------------------------------------------------------
  // Chargement des factures
  // ---------------------------------------------------------------------------

  /**
   * Charge une page de factures en appliquant les filtres actifs.
   *
   * Stratégie pour le total :
   * 1. Lecture de l'en-tête HTTP `X-Total-Count` (présent sur les versions récentes).
   * 2. Fallback estimatif si l'en-tête est absent.
   *
   * Gestion des erreurs :
   * - 404 est considéré comme «aucun résultat» (Dolibarr retourne 404 quand la page est vide).
   * - Toute autre erreur est affichée dans l'interface.
   */
  const fetchInvoices = useCallback(
    async (currentPage: number) => {
      setLoading(true);
      setError('');

      try {
        const endpoint =
          activeTab === 'client' ? '/invoices' : '/supplierinvoices';
        const conditions: string[] = [];

        // Filtre par statut
        if (statusFilter !== 'all') {
          if (statusFilter === 'part') {
            // Statut partial : validé (1) mais avec quelque chose de payé
            // Note: Dolibarr ne permet pas toujours de filtrer sur le montant payé en SQL via l'API,
            // on filtre sur statut=1 et on filtrera côté client si besoin, mais ici on reste sur statut=1
            conditions.push(`(t.fk_statut:=:1)`);
          } else {
            conditions.push(`(t.fk_statut:=:${statusFilter})`);
          }
        }

        // Recherche sur la référence et le nom du tiers
        if (debouncedSearch) {
          const safe = debouncedSearch.replace(/'/g, "''"); // échappement SQL
          conditions.push(
            `((t.ref:like:'%${safe}%') or (s.nom:like:'%${safe}%'))`
          );
        }

        // Filtres de date de facturation (t.datef)
        // Dolibarr sqlfilters n'accepte que < et > (pas >= ni <=)
        // >= date  →  > (date - 1 jour)
        // <= date  →  < (date + 1 jour)
        if (startDate) {
          conditions.push(`(t.datef:>:'${shiftDate(startDate, -1)}')`);
        }
        if (endDate) {
          conditions.push(`(t.datef:<:'${shiftDate(endDate, 1)}')`);
        }

        // Filtres de date d'échéance
        const dueField = 't.date_lim_reglement';
        if (startDue) {
          conditions.push(`(${dueField}:>:'${shiftDate(startDue, -1)}')`);
        }
        if (endDue) {
          conditions.push(`(${dueField}:<:'${shiftDate(endDue, 1)}')`);
        }

        let query = `${endpoint}?sortfield=t.rowid&sortorder=DESC&limit=${PAGE_LIMIT}&page=${currentPage}`;
        if (conditions.length > 0) {
          query += `&sqlfilters=${encodeURIComponent(conditions.join(' and '))}`;
        }

        const response = await api.get(query);

        // Si on a demandé specifically "Règlement commencé" (part) ou "Impayée" (1)
        // on affine côté client pour les séparer strictement.
        let finalInvoices = response.data;
        if (Array.isArray(finalInvoices)) {
          if (statusFilter === 'part') {
            finalInvoices = finalInvoices.filter(
              (inv) => Number((inv as any).totalpaid) > 0
            );
          } else if (statusFilter === '1') {
            finalInvoices = finalInvoices.filter(
              (inv) => Number((inv as any).totalpaid) === 0
            );
          }
        }

        setInvoices(finalInvoices || []);
        setHasMore(response.data.length === PAGE_LIMIT);

        // Total : header HTTP ou estimation
        const rawTotal = response.headers?.get('X-Total-Count');
        if (rawTotal) {
          setTotalItems(parseInt(rawTotal, 10));
        } else {
          const estimated =
            response.data.length +
            (response.data.length === PAGE_LIMIT ? PAGE_LIMIT : 0);
          setTotalItems(estimated);
        }
      } catch (err: unknown) {
        const apiErr = err as Error & ApiError;
        if (apiErr.response?.status === 404) {
          // 404 = page vide pour Dolibarr, pas une vraie erreur
          setInvoices([]);
          setHasMore(false);
        } else {
          setError(getErrorMessage(err));
        }
      } finally {
        setLoading(false);
      }
    },
    [
      activeTab,
      debouncedSearch,
      statusFilter,
      startDate,
      endDate,
      startDue,
      endDue,
    ]
  );

  /**
   * Calcule les totaux globaux pour les filtres actuels.
   * Utilise une requête avec limit=1000 pour couvrir une large période sans pagination.
   */
  const fetchTotals = useCallback(async () => {
    setLoadingTotals(true);
    try {
      const endpoint =
        activeTab === 'client' ? '/invoices' : '/supplierinvoices';
      const conditions: string[] = [];

      if (statusFilter !== 'all' && statusFilter !== 'part') {
        conditions.push(`(t.fk_statut:=:${statusFilter})`);
      }
      if (debouncedSearch) {
        const safe = debouncedSearch.replace(/'/g, "''");
        conditions.push(
          `((t.ref:like:'%${safe}%') or (s.nom:like:'%${safe}%'))`
        );
      }
      if (startDate) conditions.push(`(t.datef:>:'${shiftDate(startDate, -1)}')`);
      if (endDate) conditions.push(`(t.datef:<:'${shiftDate(endDate, 1)}')`);

      const dueField = 't.date_lim_reglement';
      if (startDue) conditions.push(`(${dueField}:>:'${shiftDate(startDue, -1)}')`);
      if (endDue) conditions.push(`(${dueField}:<:'${shiftDate(endDue, 1)}')`);

      let query = `${endpoint}?limit=1000`;
      if (conditions.length > 0) {
        query += `&sqlfilters=${encodeURIComponent(conditions.join(' and '))}`;
      }

      const res = await api.get(query);
      if (Array.isArray(res.data)) {
        let docs = res.data;
        // Application filtres spécifiques client-side si besoin
        if (statusFilter === 'part') {
          docs = docs.filter((d: any) => Number(d.totalpaid) > 0);
        } else if (statusFilter === '1') {
          docs = docs.filter((d: any) => Number(d.totalpaid) === 0);
        }

        const ht = docs.reduce(
          (acc: number, d: any) => acc + (Number(d.total_ht) || 0),
          0
        );
        const ttc = docs.reduce(
          (acc: number, d: any) => acc + (Number(d.total_ttc) || 0),
          0
        );
        setPeriodTotals({ ht, ttc });
      } else {
        setPeriodTotals({ ht: 0, ttc: 0 });
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setPeriodTotals({ ht: 0, ttc: 0 });
      } else {
        console.error('Erreur calcul totaux:', err);
      }
    } finally {
      setLoadingTotals(false);
    }
  }, [
    activeTab,
    debouncedSearch,
    statusFilter,
    startDate,
    endDate,
    startDue,
    endDue,
  ]);

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);

  /** Recharge les factures à chaque changement de page ou de filtre. */
  useEffect(() => {
    fetchInvoices(page);
  }, [page, fetchInvoices]);

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Facturation & Paiement
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

      {/* Message d'erreur */}
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

      {/* Onglets Client / Fournisseur */}
      <div className="border-border border-b">
        <nav
          className="-mb-px flex space-x-8"
          aria-label="Onglets de facturation"
        >
          {(
            [
              { key: 'client', label: 'Factures clients' },
              { key: 'supplier', label: 'Factures fournisseurs' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              aria-selected={activeTab === key}
              role="tab"
              className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'text-muted hover:text-foreground border-transparent hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Zone Haute : Dates et Totaux */}
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
        {/* Sélecteurs de date (compact, horizontal, fond ombré) */}
        <div className="bg-primary/5 border-primary/10 flex flex-[2] flex-wrap items-center gap-6 rounded-xl border p-3 lg:flex-nowrap">
          <div className="min-w-[120px] flex-1">
            <label className="text-muted mb-1 block text-[9px] font-bold tracking-widest uppercase">
              Facturation Du
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-2 py-1.5 text-xs ring-1 ring-inset focus:ring-2"
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <label className="text-muted mb-1 block text-[9px] font-bold tracking-widest uppercase">
              au
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-2 py-1.5 text-xs ring-1 ring-inset focus:ring-2"
            />
          </div>
          {activeTab === 'client' && (
            <div className="min-w-[120px] flex-1">
              <label className="text-muted mb-1 block text-[9px] font-bold tracking-widest uppercase">
                Échéance Du
              </label>
              <input
                type="date"
                value={startDue}
                onChange={(e) => setStartDue(e.target.value)}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-2 py-1.5 text-xs ring-1 ring-inset focus:ring-2"
              />
            </div>
          )}
          <div className="min-w-[120px] flex-1">
            <label className="text-muted mb-1 block text-[9px] font-bold tracking-widest uppercase">
              {activeTab === 'client' ? 'au' : 'Échéance avant le'}
            </label>
            <div className="flex items-center gap-1">
              <input
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

        {/* Résumé des totaux de la période */}
        <div className="bg-primary/5 border-primary/10 flex flex-1 items-center justify-around gap-4 rounded-xl border px-6 lg:min-w-[320px] lg:flex-none">
          <div className="flex flex-col text-center">
            <span className="text-muted text-[10px] font-bold tracking-widest uppercase">
              Total HT
            </span>
            <span className="text-foreground mt-0.5 text-xl leading-tight font-bold">
              {loadingTotals ? '...' : formatCurrency(periodTotals.ht)}
            </span>
          </div>
          <div className="bg-primary/10 h-8 w-px" />
          <div className="flex flex-col text-center">
            <span className="text-muted text-[10px] font-bold tracking-widest uppercase">
              Total TTC
            </span>
            <span className="text-foreground mt-0.5 text-xl leading-tight font-bold">
              {loadingTotals ? '...' : formatCurrency(periodTotals.ttc)}
            </span>
          </div>
        </div>
      </div>

      {/* Barre de filtres (Recherche + Statut) - Positionnée après les dates */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
        {/* Recherche */}
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Rechercher
          </label>
          <input
            id="search"
            type="search"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full max-w-md rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
          />
        </div>

        {/* Filtre par statut */}
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
            <option value="part">Règlement commencé</option>
            <option value="2">Payée</option>
            <option value="3">Abandonnée</option>
          </select>
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
                invoices.map((invoice) => {
                  // Résolution du nom du tiers : payload API en priorité, puis dictionnaire préchargé
                  const tierName =
                    invoice.thirdparty?.name ??
                    invoice.soc_name ??
                    invoice.nom ??
                    thirdPartiesMap[String(invoice.socid)] ??
                    '-';

                  // Date d'échéance — plusieurs noms de champ selon la version Dolibarr
                  const dueDate =
                    invoice.datelimit ??
                    invoice.date_lim_reglement ??
                    invoice.date_echeance;
                  const overdue = isOverdue(invoice);

                  return (
                    <tr
                      key={invoice.id}
                      onClick={() =>
                        router.push(
                          `/billing-payments/${invoice.id}?type=${activeTab}`
                        )
                      }
                      className="hover:bg-background/80 cursor-pointer transition-colors"
                    >
                      {/* Référence */}
                      <td className="text-foreground py-4 pr-3 pl-4 text-sm font-medium whitespace-nowrap sm:pl-6">
                        {invoice.ref}
                      </td>
                      {/* Date de facturation */}
                      <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                        {formatDate(invoice.date)}
                      </td>
                      {/* Date d'échéance avec indicateur de retard */}
                      <td
                        className={`px-3 py-4 text-sm whitespace-nowrap ${overdue ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted'}`}
                      >
                        {formatDate(dueDate)}
                        {overdue && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            RETARD
                          </span>
                        )}
                      </td>
                      {/* Tiers */}
                      <td className="text-muted px-3 py-4 text-sm whitespace-nowrap">
                        {tierName}
                      </td>
                      {/* Montant HT */}
                      <td className="text-foreground px-3 py-4 text-right text-sm font-medium whitespace-nowrap">
                        {formatCurrency(invoice.total_ht)}
                      </td>
                      {/* Montant TTC */}
                      <td className="text-foreground px-3 py-4 text-right text-sm font-medium whitespace-nowrap">
                        {formatCurrency(invoice.total_ttc)}
                      </td>
                      {/* Statut */}
                      <td className="px-3 py-4 text-center text-sm whitespace-nowrap">
                        <StatusBadge invoice={invoice} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-border bg-surface flex items-center justify-between border-t px-4 py-3 sm:px-6">
          {/* Version desktop */}
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <p className="text-muted text-sm">
              Page <span className="font-medium">{page + 1}</span>
              {totalItems > 0 && (
                <>
                  {' '}
                  /{' '}
                  <span className="font-medium">
                    {Math.ceil(totalItems / PAGE_LIMIT)}
                  </span>
                </>
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

          {/* Version mobile */}
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

/**
 * Point d'entrée de la route `/billing-payments`.
 * Enveloppé dans Suspense car utilise useSearchParams().
 */
export default function BillingPaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted flex items-center justify-center py-20 text-sm">
          Chargement de la facturation...
        </div>
      }
    >
      <BillingPaymentsContent />
    </Suspense>
  );
}
