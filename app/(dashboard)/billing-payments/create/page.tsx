'use client';

/**
 * @file billing-payments/create/page.tsx
 *
 * Page de création d'une facture (client ou fournisseur).
 *
 * Architecture Next.js App Router :
 * - `CreateInvoicePage` est le composant par défaut exporté (Server Component compatible).
 *   Il enveloppe `CreateInvoiceForm` dans un `<Suspense>`, requis car ce formulaire
 *   utilise `useSearchParams()` qui nécessite un contexte client.
 * - `CreateInvoiceForm` contient toute la logique métier et l'interface.
 *
 * Fonctionnement :
 * 1. Lecture du paramètre `?type=client|supplier` pour pré-sélectionner le type de facture.
 * 2. Chargement de la liste des tiers filtrée selon le type (clients ou fournisseurs).
 * 3. Soumission via POST /invoices ou POST /supplierinvoices avec les lignes intégrées.
 * 4. Redirection vers la page de détail de la facture créée.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import ProposalLines, {
  LocalLine,
} from '../../../../components/ui/ProposalLines';

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

/** Type de facture pris en charge par cette page. */
type InvoiceType = 'client' | 'supplier';

/** Forme minimale d'un tiers retourné par GET /thirdparties. */
interface ThirdPartyOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convertit une chaîne `YYYY-MM-DD` en timestamp Unix (secondes).
 * Retourne `null` si la chaîne est absente.
 */
function dateStringToTimestamp(dateStr: string): number | null {
  if (!dateStr) return null;
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

/** Calcule la date d'aujourd'hui au format `YYYY-MM-DD`. */
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/** Calcule la date dans N jours au format `YYYY-MM-DD`. */
function getDateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Composant formulaire (client component)
// ---------------------------------------------------------------------------

/**
 * Formulaire de création de facture.
 *
 * Ce composant est séparé de `CreateInvoicePage` pour respecter la contrainte
 * Next.js App Router : `useSearchParams()` doit être dans un composant enfant d'un `<Suspense>`.
 */
function CreateInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** Type initial lu depuis l'URL (?type=client|supplier), par défaut 'client'. */
  const initialType = (searchParams.get('type') as InvoiceType) ?? 'client';

  // --- État du type de facture ---
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(initialType);

  // --- État du formulaire ---
  const [formData, setFormData] = useState({
    socid: '',
    date: getToday(),
    datelimit: getDateInDays(30),
    ref_supplier: '',
  });

  // --- État des lignes ---
  const [lines, setLines] = useState<LocalLine[]>([]);

  // --- État des tiers ---
  const [thirdParties, setThirdParties] = useState<ThirdPartyOption[]>([]);
  const [loadingThirdParties, setLoadingThirdParties] = useState(true);

  // --- État UI ---
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ---------------------------------------------------------------------------
  // Chargement des tiers
  // ---------------------------------------------------------------------------

  /**
   * Charge la liste des tiers filtrée selon le type de facture.
   * - client    → client > 0 (clients et prospects)
   * - supplier  → fournisseur = 1
   *
   * Silencieux en cas d'erreur : le select affichera simplement vide.
   */
  const fetchThirdParties = useCallback(async (type: InvoiceType) => {
    try {
      const filter =
        type === 'client'
          ? 'sqlfilters=(t.client:>:0)'
          : 'sqlfilters=(t.fournisseur:>=:1)';

      const response = await api.get(
        `/thirdparties?sortfield=t.nom&sortorder=ASC&limit=1000&${filter}`
      );

      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  }, []);

  /** Recharge la liste des tiers à chaque changement de type de facture. */
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoadingThirdParties(true);
      setThirdParties([]);
      // Réinitialisation du tiers sélectionné lors du changement de type
      setFormData((prev) => ({ ...prev, socid: '' }));

      const data = await fetchThirdParties(invoiceType);

      if (isMounted) {
        setThirdParties(data);
        setLoadingThirdParties(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [invoiceType, fetchThirdParties]);

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
   * Crée la facture via POST /invoices ou POST /supplierinvoices.
   *
   * Les lignes sont transmises directement dans le corps du POST (contrairement
   * à la mise à jour, elles sont acceptées à la création par l'API Dolibarr).
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation minimaliste côté client
    if (!formData.socid) {
      setError('Veuillez sélectionner un tiers.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const endpoint =
        invoiceType === 'supplier' ? '/supplierinvoices' : '/invoices';

      if (invoiceType === 'client') {
        // Pour les clients, l'API accepte généralement les lignes dans le POST initial
        const payload = {
          socid: parseInt(formData.socid, 10),
          date: dateStringToTimestamp(formData.date),
          date_lim_reglement: dateStringToTimestamp(formData.datelimit),
          lines: lines.map((line) => ({
            fk_product: line.fk_product ? parseInt(line.fk_product, 10) : 0,
            product_type: line.product_type,
            desc: line.label,
            qty: Number(line.qty),
            subprice: Number(line.subprice),
            tva_tx: Number(line.tva_tx),
          })),
        };
        const response = await api.post(endpoint, payload);
        const newId = response.data as string | number;
        router.push(`/billing-payments/${newId}?type=client`);
      } else {
        const payload = {
          socid: parseInt(formData.socid, 10),
          date: formData.date,
          date_echeance: formData.datelimit,
          ref_supplier: formData.ref_supplier || `SUP-${Date.now()}`,
          ref: 'auto',
          type: 0, // Facture standard
        };
        const response = await api.post(endpoint, payload);
        const newId = response.data as string | number;

        // Ajout séquentiel des lignes
        for (const line of lines) {
          await api.post(`${endpoint}/${newId}/lines`, {
            fk_product: line.fk_product ? parseInt(line.fk_product, 10) : 0,
            product_type: line.product_type,
            desc: line.label,
            qty: Number(line.qty),
            pu_ht: Number(line.subprice),
            tva_tx: Number(line.tva_tx),
          });
        }
        router.push(`/billing-payments/${newId}?type=supplier`);
      }
    } catch (err: any) {
      let message = getErrorMessage(err);

      // Détection de la référence en double pour les fournisseurs
      const rawData = err?.response?.data
        ? JSON.stringify(err.response.data).toLowerCase()
        : '';
      const isDuplicate =
        rawData.includes('already exists') ||
        (invoiceType === 'supplier' &&
          message.includes('Error creating invoice'));

      if (invoiceType === 'supplier' && isDuplicate) {
        message = 'La référence facture fournisseur existe déjà';
      }

      setError(message);
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Nouvelle facture{' '}
            {invoiceType === 'client' ? 'client' : 'fournisseur'}
          </h1>
          <p className="text-muted mt-1 text-sm">
            Créez une nouvelle facture en brouillon.
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

      {/* Message d'erreur */}
      {error && (
        <div
          className="animate-in fade-in slide-in-from-top-2 rounded-lg border border-red-900/50 bg-[#2d1414] p-4 text-sm font-medium text-[#ff6b6b] shadow-lg duration-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Formulaire */}
      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          {/* Type de facture & Tiers */}
          <div className="sm:col-span-2">
            <span className="text-foreground block text-sm leading-6 font-medium">
              Type de facture & Tiers *
            </span>
            <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
              {/* Bascule Client / Fournisseur */}
              <fieldset aria-label="Type de facture" className="flex-shrink-0">
                <div className="border-border flex w-full overflow-hidden rounded-md border shadow-sm sm:w-64">
                  <button
                    type="button"
                    onClick={() => setInvoiceType('client')}
                    aria-pressed={invoiceType === 'client'}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      invoiceType === 'client'
                        ? 'bg-primary text-background'
                        : 'text-muted hover:bg-muted/10'
                    }`}
                  >
                    Client
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceType('supplier')}
                    aria-pressed={invoiceType === 'supplier'}
                    className={`border-border flex-1 border-l px-4 py-2 text-sm font-medium transition-colors ${
                      invoiceType === 'supplier'
                        ? 'bg-primary text-background'
                        : 'text-muted hover:bg-muted/10'
                    }`}
                  >
                    Fournisseur
                  </button>
                </div>
              </fieldset>
 
              {/* Select du tiers */}
              <div className="w-full">
                <label htmlFor="socid" className="sr-only">
                  {invoiceType === 'client'
                    ? 'Sélectionner un client'
                    : 'Sélectionner un fournisseur'}
                </label>
                <select
                  id="socid"
                  name="socid"
                  required
                  disabled={loadingThirdParties}
                  value={formData.socid}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>
                    {loadingThirdParties
                      ? 'Chargement...'
                      : invoiceType === 'client'
                        ? '-- Sélectionnez un client --'
                        : '-- Sélectionnez un fournisseur --'}
                  </option>
                  {thirdParties.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Réf. Fournisseur (Uniquement si type fournisseur) */}
          {invoiceType === 'supplier' && (
            <div className="sm:col-span-2">
              <label
                htmlFor="ref_supplier"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Référence facture fournisseur *
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="ref_supplier"
                  name="ref_supplier"
                  required
                  placeholder="Ex: FA-2024-0001"
                  value={formData.ref_supplier}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                />
              </div>
            </div>
          )}

          {/* Date de facturation */}
          <div>
            <label
              htmlFor="date"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              Date de facturation *
            </label>
            <div className="mt-2">
              <input
                type="date"
                id="date"
                name="date"
                required
                value={formData.date}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Date d'échéance (30 jours par défaut) */}
          <div>
            <label
              htmlFor="datelimit"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              Date d'échéance
            </label>
            <div className="mt-2">
              <input
                type="date"
                id="datelimit"
                name="datelimit"
                value={formData.datelimit}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
              />
            </div>
          </div>
        </div>

        {/* Lignes de la facture */}
        <ProposalLines lines={lines} onChange={setLines} />

        {/* Actions */}
        <div className="border-border flex items-center justify-end border-t pt-6">
          <button
            type="submit"
            disabled={saving || loadingThirdParties}
            className="btn-primary inline-flex justify-center px-4 py-2"
          >
            {saving ? 'Création en cours...' : 'Créer la facture'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export par défaut (Next.js App Router)
// ---------------------------------------------------------------------------

/**
 * Point d'entrée de la route `/billing-payments/create`.
 *
 * Enveloppe `CreateInvoiceForm` dans un `<Suspense>` pour satisfaire la
 * contrainte Next.js App Router : tout composant utilisant `useSearchParams()`
 * doit être enfant d'un `<Suspense>`, faute de quoi le build échoue.
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/use-search-params#static-rendering
 */
export default function CreateInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted flex items-center justify-center py-20 text-sm">
          Chargement...
        </div>
      }
    >
      <CreateInvoiceForm />
    </Suspense>
  );
}
