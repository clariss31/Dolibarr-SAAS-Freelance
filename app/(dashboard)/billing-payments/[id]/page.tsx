'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams, notFound } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { Invoice, ApiError } from '../../../../types/dolibarr';

// ---------------------------------------------------------------------------
// Helpers
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
 * Une facture est en retard si :
 *   - son statut est 1 (impayée)
 *   - sa date d'échéance est antérieure à la date actuelle
 */
function isOverdue(inv: Invoice): boolean {
  if (Number(inv.statut) !== 1) return false;

  const limitRaw = inv.datelimit ?? inv.date_lim_reglement ?? inv.date_echeance;
  if (!limitRaw) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  let limitSeconds = 0;

  if (typeof limitRaw === 'string' && limitRaw.includes('-')) {
    const ms = new Date(limitRaw).getTime();
    if (!isNaN(ms)) limitSeconds = Math.floor(ms / 1000);
  } else {
    const raw = Number(limitRaw);
    // Normalisation : passage en secondes si retourné en millisecondes
    limitSeconds = raw > 10_000_000_000 ? Math.floor(raw / 1000) : raw;
  }

  return limitSeconds > 0 && limitSeconds < nowSeconds;
}

// ---------------------------------------------------------------------------
// Badges de statut
// ---------------------------------------------------------------------------

/** Retourne le badge coloré correspondant au statut d'une facture Dolibarr. */
function StatusBadge({ invoice }: { invoice: Invoice }) {
  switch (Number(invoice.statut)) {
    case 0: return <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">Brouillon</span>;
    case 1: return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Impayée</span>;
    case 2: return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Payée</span>;
    case 3: return <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Abandonnée</span>;
    default: return <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Inconnu</span>;
  }
}

// ---------------------------------------------------------------------------
// Composant principal (doit être enfant d'un <Suspense> pour useSearchParams)
// ---------------------------------------------------------------------------

/**
 * Page de détail d'une facture (client ou fournisseur).
 *
 * - Charge la facture via GET /invoices/{id} ou GET /supplierinvoices/{id}.
 * - Redirige vers 404 si la ressource est introuvable.
 * - Affiche les informations générales, les montants et les lignes.
 * - Propose les actions Modifier / Supprimer uniquement en statut Brouillon (0).
 */
function InvoiceDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** 'client' | 'supplier' — détermine l'endpoint API utilisé. */
  const typeParam = searchParams?.get('type') ?? 'client';
  /** Préfixe d'endpoint selon le type de facture. */
  const endpoint = typeParam === 'supplier' ? '/supplierinvoices' : '/invoices';

  const [invoice,        setInvoice]        = useState<Invoice | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [isDeleting,     setIsDeleting]     = useState(false);
  const [thirdPartyName, setThirdPartyName] = useState('-');

  // ---------------------------------------------------------------------------
  // Chargement de la facture
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;

    const fetchInvoice = async () => {
      try {
        const response = await api.get(`${endpoint}/${id}`);

        if (!response.data) {
          setError('Facture introuvable.');
          return;
        }

        const inv = response.data as Invoice;
        setInvoice(inv);

        // Résolution du nom du tiers (même logique robuste que la page d'édition)
        const name = inv.soc_name ?? inv.nom ?? inv.thirdparty?.name;
        if (name) {
          setThirdPartyName(name);
        } else if (inv.socid) {
          try {
            const tierResp = await api.get(`/thirdparties/${inv.socid}`);
            setThirdPartyName(
              tierResp.data?.name ?? tierResp.data?.nom ?? `ID: ${inv.socid}`
            );
          } catch {
            setThirdPartyName(`ID: ${inv.socid}`);
          }
        }
      } catch (err: unknown) {
        const apiErr = err as ApiError;
        // Redirection 404 si la facture n'existe pas
        if (apiErr.response?.status === 404) {
          notFound();
        } else {
          setError(getErrorMessage(err));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id, endpoint]);

  // ---------------------------------------------------------------------------
  // Handler de suppression
  // ---------------------------------------------------------------------------

  /** Demande confirmation puis supprime le brouillon de facture. */
  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce brouillon ?')) return;

    setIsDeleting(true);
    setError('');

    try {
      await api.delete(`${endpoint}/${id}`);
      router.push('/billing-payments');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setIsDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted text-center text-sm">Chargement de la facture...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/billing-payments')}
          className="text-primary decoration-primary text-sm hover:underline"
        >
          &larr; Retour à la liste
        </button>
        <div
          className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-inset ring-red-600/20"
          role="alert"
        >
          {error || 'Introuvable'}
        </div>
      </div>
    );
  }

  const isDraft = Number(invoice.statut) === 0;

  // Calcul de la TVA totale si absente de la réponse API
  const totalHt  = Number(invoice.total_ht)  || 0;
  const totalTtc = Number(invoice.total_ttc) || 0;
  const totalTva = Number(invoice.total_tva) || (totalTtc - totalHt);

  // Date d'échéance (plusieurs noms de champ selon la version Dolibarr)
  const dueDateRaw = invoice.datelimit ?? invoice.date_lim_reglement ?? invoice.date_echeance;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center">
        <button
          onClick={() => router.push('/billing-payments')}
          className="text-muted hover:text-foreground text-sm transition-colors hover:underline"
        >
          &larr; Retour à la liste
        </button>
      </div>

      {/* En-tête : référence, statut et actions */}
      <div className="border-border border-b py-2 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-foreground text-3xl font-bold tracking-tight">
            {invoice.ref}
          </h1>
          <StatusBadge invoice={invoice} />
        </div>

        {/* Actions disponibles uniquement en brouillon */}
        {isDraft && (
          <div className="mt-4 sm:mt-0 sm:flex sm:items-center sm:space-x-4">
            <button
              onClick={() => router.push(`/billing-payments/${id}/edit?type=${typeParam}`)}
              className="inline-flex cursor-pointer justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700"
            >
              Modifier
            </button>
            <button
              disabled={isDeleting}
              onClick={handleDelete}
              className="text-sm font-semibold text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        )}
      </div>

      {/* Panneaux d'informations */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Informations générales */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
              Informations générales
            </h3>
          </div>
          <div className="space-y-4 p-5">
            {/* Date de facturation */}
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Date facturation
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {formatDate(invoice.date)}
              </p>
            </div>

            {/* Date d'échéance avec indicateur de retard */}
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Date d'échéance
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className={`text-sm font-medium ${isOverdue(invoice) ? 'font-bold text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                  {formatDate(dueDateRaw)}
                </p>
                {isOverdue(invoice) && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    RETARD
                  </span>
                )}
              </div>
            </div>

            {/* Tiers associé */}
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Tiers
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {thirdPartyName}
              </p>
            </div>
          </div>
        </div>

        {/* Montants */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
              Montants
            </h3>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="text-muted text-sm font-medium">Montant HT</p>
              <p className="text-foreground text-sm font-semibold">{formatCurrency(totalHt)}</p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-muted text-sm font-medium">Montant TVA</p>
              <p className="text-foreground text-sm font-semibold">{formatCurrency(totalTva)}</p>
            </div>
            <div className="border-border mt-2 flex items-center justify-between border-t pt-2">
              <p className="text-muted text-base font-semibold">Montant TTC</p>
              <p className="text-primary text-base font-bold">{formatCurrency(totalTtc)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lignes de la facture */}
      <div className="border-border bg-surface mt-8 overflow-hidden rounded-xl border shadow-sm">
        <div className="border-border bg-background border-b px-5 py-4">
          <h3 className="text-foreground text-base leading-6 font-semibold">
            Lignes de la facture
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="divide-border min-w-full divide-y">
            <thead className="bg-background">
              <tr>
                <th scope="col" className="text-foreground w-[45%] py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pl-6">
                  Description
                </th>
                <th scope="col" className="text-foreground px-3 py-3.5 text-center text-sm font-semibold">
                  TVA
                </th>
                <th scope="col" className="text-foreground px-3 py-3.5 text-right text-sm font-semibold">
                  P.U. HT
                </th>
                <th scope="col" className="text-foreground px-3 py-3.5 text-center text-sm font-semibold">
                  Qté
                </th>
                <th scope="col" className="text-foreground px-3 py-3.5 text-right text-sm font-semibold">
                  Total HT
                </th>
              </tr>
            </thead>
            <tbody className="divide-border bg-surface divide-y">
              {!invoice.lines?.length ? (
                <tr>
                  <td colSpan={5} className="text-muted py-6 text-center text-sm italic">
                    Aucune ligne pour cette facture
                  </td>
                </tr>
              ) : (
                invoice.lines.map((line, idx) => {
                  const lineId      = line.id ?? line.rowid ?? `line-${idx}`;
                  const description = line.label ?? line.description ?? line.product_label ?? '-';
                  const tva         = Number(line.tva_tx)   || 0;
                  const puHt        = Number(line.subprice) || 0;
                  const qty         = Number(line.qty)      || 1;
                  const lineTotalHt = Number(line.total_ht) || puHt * qty;

                  return (
                    <tr key={lineId} className="hover:bg-background/50 transition-colors">
                      <td className="text-foreground py-4 pr-3 pl-4 align-top text-sm sm:pl-6">
                        <div className="whitespace-pre-wrap">{description}</div>
                      </td>
                      <td className="text-muted px-3 py-4 text-center align-top text-sm whitespace-nowrap">
                        {tva}%
                      </td>
                      <td className="text-muted px-3 py-4 text-right align-top text-sm whitespace-nowrap">
                        {formatCurrency(puHt)}
                      </td>
                      <td className="text-muted px-3 py-4 text-center align-top text-sm whitespace-nowrap">
                        {qty}
                      </td>
                      <td className="text-foreground px-3 py-4 text-right align-top text-sm font-medium whitespace-nowrap">
                        {formatCurrency(lineTotalHt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export par défaut — résolution des params asynchrones (Next.js App Router)
// ---------------------------------------------------------------------------

/**
 * Point d'entrée de la route `/billing-payments/[id]`.
 *
 * Résout les `params` asynchrones avec `use()`, puis délègue à
 * `InvoiceDetailContent` enveloppé dans `<Suspense>` (requis pour `useSearchParams`).
 */
export default function InvoiceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="text-muted flex items-center justify-center py-20 text-sm">
          Chargement...
        </div>
      }
    >
      <InvoiceDetailContent id={id} />
    </Suspense>
  );
}
