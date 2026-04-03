'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { ApiError } from '../../../../types/dolibarr';
import ProposalLines, {
  LocalLine,
} from '../../../../components/ui/ProposalLines';

type InvoiceType = 'client' | 'supplier';

interface ThirdPartyOption {
  id: string;
  name?: string;
  nom?: string;
}

export default function CreateInvoicePage() {
  const router = useRouter();

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  const defaultDatelimit = thirtyDaysLater.toISOString().split('T')[0];

  // Type de facture : client ou fournisseur
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('client');

  const [formData, setFormData] = useState({
    socid: '',
    date: today,
    datelimit: defaultDatelimit,
  });

  const [lines, setLines] = useState<LocalLine[]>([]);
  const [thirdParties, setThirdParties] = useState<ThirdPartyOption[]>([]);
  const [loadingThirdParties, setLoadingThirdParties] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dateStringToTimestamp = (dateStr: string) => {
    if (!dateStr) return null;
    return Math.floor(new Date(dateStr).getTime() / 1000);
  };

  // Recharge la liste des tiers selon le type sélectionné
  // Clients (client=1 ou client=3) vs Fournisseurs (fournisseur=1)
  const fetchThirdParties = useCallback(async (type: InvoiceType) => {
    setLoadingThirdParties(true);
    setThirdParties([]);
    // Reset du tiers sélectionné à chaque changement de type
    setFormData((prev) => ({ ...prev, socid: '' }));
    try {
      const filter =
        type === 'client'
          ? 'sqlfilters=(t.client:>:0)'
          : 'sqlfilters=(t.fournisseur:=:1)';
      const response = await api.get(
        `/thirdparties?sortfield=t.nom&sortorder=ASC&limit=500&${filter}`
      );
      if (response.data && Array.isArray(response.data)) {
        setThirdParties(response.data);
      }
    } catch {
      // Silecieux — le select affichera "aucun tiers"
    } finally {
      setLoadingThirdParties(false);
    }
  }, []);

  useEffect(() => {
    fetchThirdParties(invoiceType);
  }, [invoiceType, fetchThirdParties]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleInvoiceTypeChange = (type: InvoiceType) => {
    setInvoiceType(type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.socid) {
      setError('Veuillez sélectionner un tiers.');
      return;
    }

    setSaving(true);
    setError('');

    const endpoint =
      invoiceType === 'supplier' ? '/supplierinvoices' : '/invoices';

    const payload = {
      socid: parseInt(formData.socid, 10),
      date: dateStringToTimestamp(formData.date),
      datelimit: dateStringToTimestamp(formData.datelimit),
      lines: lines.map((line) => ({
        fk_product: line.fk_product ? parseInt(line.fk_product, 10) : 0,
        product_type: line.product_type,
        desc: line.label,
        qty: Number(line.qty),
        subprice: Number(line.subprice),
        tva_tx: Number(line.tva_tx),
      })),
    };

    try {
      const response = await api.post(endpoint, payload);
      const newInvoiceId = response.data as string | number;
      router.push(`/billing-payments/${newInvoiceId}?type=${invoiceType}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
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

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          {/* Type de facture + Sélecteur de tiers — sur la même ligne */}
          <div className="sm:col-span-2">
            <span className="text-foreground block text-sm leading-6 font-medium">
              Type de facture &amp; Tiers *
            </span>
            <div className="mt-2 flex gap-3">
              {/* Sélecteur Client / Fournisseur */}
              <fieldset aria-label="Type de facture">
                <div className="flex h-full overflow-hidden rounded-md ring-1 ring-[var(--color-border)] ring-inset">
                  <button
                    type="button"
                    onClick={() => handleInvoiceTypeChange('client')}
                    aria-pressed={invoiceType === 'client'}
                    className={`focus-visible:outline-primary px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      invoiceType === 'client'
                        ? 'bg-primary text-background'
                        : 'text-muted hover:text-background'
                    }`}
                  >
                    Client
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInvoiceTypeChange('supplier')}
                    aria-pressed={invoiceType === 'supplier'}
                    className={`border-border focus-visible:outline-primary border-l px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      invoiceType === 'supplier'
                        ? 'bg-primary text-background'
                        : 'text-muted hover:text-background'
                    }`}
                  >
                    Fournisseur
                  </button>
                </div>
              </fieldset>

              {/* Select du tiers — prend le reste de la largeur */}
              <div className="flex-1">
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
                      {tier.name || tier.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

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

          {/* Date limite / Échéance */}
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

        {/* Lignes de produits / services */}
        <ProposalLines lines={lines} onChange={setLines} />

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
