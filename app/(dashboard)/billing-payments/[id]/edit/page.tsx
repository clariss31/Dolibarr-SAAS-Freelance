'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '../../../../../utils/error-handler';
import { Invoice, ProposalLine } from '../../../../../types/dolibarr';
import ProposalLines, {
  LocalLine,
} from '../../../../../components/ui/ProposalLines';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convertit une ligne API Dolibarr (`ProposalLine`) en ligne locale (`LocalLine`)
 * utilisée par le composant `ProposalLines`.
 *
 * Calcule les montants HT et TTC si absents de la réponse API.
 *
 * @param line  - Ligne brute retournée par l'API.
 * @param index - Index de la ligne (utilisé comme repli pour la clé et le libellé).
 */
function apiLineToLocal(line: ProposalLine, index: number): LocalLine {
  const lineId = line.id ?? line.rowid;
  const unitPrice = Number(line.subprice ?? 0);
  const qty = Number(line.qty) || 1;
  const tva = Number(line.tva_tx) || 0;

  // Libellé : priorité product_label > label > description > fallback numéroté
  const label =
    line.product_label ??
    line.label ??
    line.description ??
    `Ligne ${index + 1}`;

  // Montants calculés si non fournis par l'API
  const totalHt =
    Number(line.total_ht) || parseFloat((qty * unitPrice).toFixed(2));
  const totalTtc =
    Number(line.total_ttc) ||
    parseFloat((totalHt * (1 + tva / 100)).toFixed(2));

  return {
    _key: `existing-${lineId ?? index}-${Date.now()}`,
    id: lineId ? String(lineId) : undefined,
    fk_product: line.fk_product ? String(line.fk_product) : undefined,
    product_type: Number(line.product_type) || 0,
    label,
    qty,
    subprice: unitPrice,
    tva_tx: tva,
    remise_percent: Number(line.remise_percent) || 0,
    total_ht: totalHt,
    total_ttc: totalTtc,
  };
}

/**
 * Convertit un timestamp Dolibarr (secondes Unix ou chaîne ISO) en chaîne
 * `YYYY-MM-DD` compatible avec un `<input type="date">`.
 */
function timestampToDateString(ts: string | number | undefined): string {
  if (!ts) return '';

  // Déjà au format YYYY-MM-DD ou YYYY-MM-DD HH:mm:ss
  if (typeof ts === 'string' && ts.includes('-')) return ts.substring(0, 10);

  const numTs = Number(ts);
  if (isNaN(numTs)) return '';

  // Dolibarr retourne des secondes ; on détecte les millisecondes (> 10 chiffres)
  const ms = numTs < 10_000_000_000 ? numTs * 1000 : numTs;
  const date = new Date(ms);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

/** Convertit une chaîne `YYYY-MM-DD` en timestamp Unix (secondes). */
function dateStringToTimestamp(dateStr: string): number | null {
  if (!dateStr) return null;
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

// ---------------------------------------------------------------------------
// Badges de statut
// ---------------------------------------------------------------------------

/** Retourne le badge coloré correspondant au statut Dolibarr d'une facture. */
function StatusBadge({ statut }: { statut: string }) {
  switch (statut) {
    case '0':
      return (
        <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-500/10 ring-inset">
          Brouillon
        </span>
      );
    case '1':
      return (
        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20 ring-inset">
          Impayée
        </span>
      );
    case '2':
      return (
        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
          Payée
        </span>
      );
    case '3':
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
// Composant principal (doit être enfant d'un <Suspense> pour useSearchParams)
// ---------------------------------------------------------------------------

/**
 * Formulaire d'édition d'une facture (client ou fournisseur).
 *
 * Fonctionnement :
 * - Charge la facture via GET /invoices/{id} ou GET /supplierinvoices/{id}.
 * - Si les lignes sont absentes du payload principal, les récupère via
 *   GET /{endpoint}/{id}/lines (repli de compatibilité).
 * - Résout le nom du tiers à partir du payload ou via GET /thirdparties/{socid}.
 * - Les lignes ne peuvent être modifiées que lorsque la facture est en brouillon (statut 0).
 * - Sauvegarde via PUT, puis suppression/recréation séquentielle des lignes.
 */
function EditInvoiceContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** 'client' | 'supplier' — détermine l'endpoint API utilisé. */
  const typeParam = searchParams?.get('type') ?? 'client';
  /** Préfixe d'endpoint selon le type de facture. */
  const endpoint = typeParam === 'supplier' ? '/supplierinvoices' : '/invoices';

  // --- État du formulaire ---
  const [formData, setFormData] = useState({ date: '', datelimit: '' });

  // --- État de la facture ---
  const [invoiceStatut, setInvoiceStatut] = useState('0');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [clientName, setClientName] = useState('Chargement...');
  const [lines, setLines] = useState<LocalLine[]>([]);
  /** IDs des lignes existantes, nécessaires pour la suppression avant recréation. */
  const [originalLineIds, setOriginalLineIds] = useState<string[]>([]);

  const isDraft = invoiceStatut === '0';

  // --- État UI ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ---------------------------------------------------------------------------
  // Chargement initial de la facture
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;

    const fetchInvoice = async () => {
      try {
        const response = await api.get(`${endpoint}/${id}`);
        if (!response.data) return;

        const invoice = response.data as Invoice;

        setInvoiceStatut(String(invoice.statut ?? '0'));
        setInvoiceRef(invoice.ref);
        const deadline = invoice.datelimit || invoice.date_lim_reglement || invoice.date_echeance;
        setFormData({
          date: timestampToDateString(invoice.date),
          datelimit: timestampToDateString(deadline),
        });

        // Chargement des lignes : payload d'abord, repli endpoint dédié ensuite
        if (invoice.lines?.length) {
          setLines(invoice.lines.map(apiLineToLocal));
          setOriginalLineIds(
            invoice.lines
              .map((l) => l.id ?? l.rowid)
              .filter(Boolean) as string[]
          );
        } else {
          try {
            const linesResp = await api.get(`${endpoint}/${id}/lines`);
            if (Array.isArray(linesResp.data)) {
              const apiLines = linesResp.data as ProposalLine[];
              setLines(apiLines.map(apiLineToLocal));
              setOriginalLineIds(
                apiLines.map((l) => l.id ?? l.rowid).filter(Boolean) as string[]
              );
            }
          } catch {
            // Lignes indisponibles — on continue sans elles
          }
        }

        // Résolution du nom du tiers (3 niveaux de repli)
        if (invoice.thirdparty?.name) {
          setClientName(invoice.thirdparty.name);
        } else if (invoice.soc_name ?? invoice.nom) {
          setClientName((invoice.soc_name ?? invoice.nom) as string);
        } else if (invoice.socid) {
          try {
            const tierResp = await api.get(`/thirdparties/${invoice.socid}`);
            setClientName(
              tierResp.data?.name ??
                tierResp.data?.nom ??
                `Tiers ID: ${invoice.socid}`
            );
          } catch {
            setClientName(`Tiers ID: ${invoice.socid}`);
          }
        } else {
          setClientName('Inconnu');
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id, endpoint]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /** Met à jour un champ du formulaire. */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /**
   * Sauvegarde la facture.
   *
   * Stratégie pour les lignes (brouillon uniquement) :
   * 1. Suppression séquentielle des lignes originales.
   * 2. Recréation séquentielle des lignes courantes.
   *
   * Cette approche contourne la limitation de l'API Dolibarr qui ignore
   * les lignes dans le corps du PUT principal.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // Mise à jour des métadonnées de la facture
      await api.put(`${endpoint}/${id}`, {
        date: dateStringToTimestamp(formData.date),
        date_lim_reglement: dateStringToTimestamp(formData.datelimit),
      });

      // Resynchronisation des lignes uniquement en mode brouillon
      const isDraft = invoiceStatut === '0';
      if (isDraft) {
        // Étape 1 : suppression des lignes existantes
        for (const lineId of originalLineIds) {
          try {
            await api.delete(`${endpoint}/${id}/lines/${lineId}`);
          } catch {
            // On ignore silencieusement si une ligne ne peut être supprimée
          }
        }

        // Étape 2 : recréation des lignes courantes
        for (const line of lines) {
          await api.post(`${endpoint}/${id}/lines`, {
            fk_product: line.fk_product ? parseInt(line.fk_product, 10) : 0,
            product_type: line.product_type,
            desc: line.label,
            qty: Number(line.qty),
            [typeParam === 'supplier' ? 'pu_ht' : 'subprice']: Number(
              line.subprice
            ),
            tva_tx: Number(line.tva_tx),
          });
        }
      }

      router.push(`/billing-payments/${id}?type=${typeParam}`);
    } catch (err: any) {
      let message = getErrorMessage(err);

      // Détection plus large de la référence en double pour les fournisseurs
      const rawData = err?.response?.data
        ? JSON.stringify(err.response.data).toLowerCase()
        : '';
      const isDuplicate =
        rawData.includes('already exists') ||
        rawData.includes('refsupplieralreadyexists') ||
        rawData.includes('duplicate') ||
        (typeParam === 'supplier' && message.includes('Error creating invoice'));

      if (typeParam === 'supplier' && isDuplicate) {
        message = 'La référence facture fournisseur existe déjà';
      }

      setError(message);
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Modifier la facture {invoiceRef}
          </h1>
          <p className="text-muted mt-1 text-sm">
            Facture {invoiceStatut === '0' ? 'Brouillon' : 'Validée'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-muted hover:text-foreground text-sm font-medium transition-colors"
        >
          Annuler
        </button>
      </div>

      {/* Message d'erreur (Style Sombre Premium) */}
      {error && (
        <div
          className="rounded-xl border border-red-800/10 bg-red-900/30 p-4 text-sm text-red-400 shadow-lg backdrop-blur-sm"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm sm:p-8"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          {/* Tiers associé — lecture seule */}
          <div className="sm:col-span-2">
            <label
              htmlFor="clientName"
              className="text-foreground block text-sm font-medium"
            >
              Tiers associé
            </label>
            <div className="mt-2">
              <input
                type="text"
                id="clientName"
                value={clientName}
                disabled
                className="bg-muted/10 text-foreground ring-border block w-full cursor-not-allowed rounded-md border-0 px-3 py-2 opacity-70 ring-1 ring-inset sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Statut — lecture seule, affiché via badge */}
          <div className="sm:col-span-2">
            <p className="text-foreground block text-sm font-medium">
              État de la facture
            </p>
            <div className="mt-2">
              <StatusBadge statut={invoiceStatut} />
            </div>
          </div>

          {/* Date de facturation */}
          <div>
            <label
              htmlFor="date"
              className="text-foreground block text-sm font-medium"
            >
              Date facturation *
            </label>
            <div className="mt-2">
              <input
                type="date"
                id="date"
                name="date"
                required
                value={formData.date}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
              />
            </div>
          </div>

          {/* Date d'échéance */}
          <div>
            <label
              htmlFor="datelimit"
              className="text-foreground block text-sm font-medium"
            >
              Date limite règlement
            </label>
            <div className="mt-2">
              <input
                type="date"
                id="datelimit"
                name="datelimit"
                value={formData.datelimit}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
              />
            </div>
          </div>
        </div>

        {/* Lignes de la facture */}
        <ProposalLines lines={lines} onChange={setLines} disabled={!isDraft} />



        {/* Actions */}
        <div className="border-border flex items-center justify-end border-t pt-6">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex justify-center px-4 py-2"
          >
            {saving ? 'Sauvegarde en cours...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export par défaut — résolution des params asynchrones (Next.js App Router)
// ---------------------------------------------------------------------------

/**
 * Point d'entrée de la route `/billing-payments/[id]/edit`.
 *
 * Résout les `params` asynchrones avec `use()`, puis délègue à
 * `EditInvoiceContent` enveloppé dans `<Suspense>` (requis pour `useSearchParams`).
 */
export default function EditInvoicePage({
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
      <EditInvoiceContent id={id} />
    </Suspense>
  );
}
