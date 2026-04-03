'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../../services/api';
import { Invoice, ProposalLine, ApiError } from '../../../../../types/dolibarr';
import ProposalLines, { LocalLine } from '../../../../../components/ui/ProposalLines';

function apiLineToLocal(line: ProposalLine, index: number): LocalLine {
  const resolvedLabel: string =
    line.product_label || line.label || line.description || `Ligne ${index + 1}`;
  const lineId = line.id ?? line.rowid;
  const unitPrice = Number(line.subprice ?? line.up ?? 0);
  const qty = Number(line.qty) || 1;
  const tva = Number(line.tva_tx) || 0;
  const totalHt = Number(line.total_ht) || parseFloat((qty * unitPrice).toFixed(2));
  const totalTtc = Number(line.total_ttc) || parseFloat((totalHt * (1 + tva / 100)).toFixed(2));

  return {
    _key: `existing-${lineId ?? index}-${Date.now()}`,
    id: lineId ? String(lineId) : undefined,
    fk_product: line.fk_product ? String(line.fk_product) : undefined,
    product_type: 0,
    label: resolvedLabel,
    qty,
    subprice: unitPrice,
    tva_tx: tva,
    total_ht: totalHt,
    total_ttc: totalTtc,
  };
}

function EditInvoiceContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams?.get('type') || 'client';

  const [formData, setFormData] = useState({
    date: '',
    datelimit: '',
  });

  const [invoiceStatut, setInvoiceStatut] = useState('0');

  const [lines, setLines] = useState<LocalLine[]>([]);
  const [originalLineIds, setOriginalLineIds] = useState<string[]>([]);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [clientName, setClientName] = useState('Chargement...');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const timestampToDateString = (ts: string | number | undefined) => {
    if (!ts) return '';
    if (typeof ts === 'string' && ts.includes('-')) {
        // Formatted YYYY-MM-DD
        return ts.substring(0, 10);
    }
    const numTs = Number(ts);
    if (isNaN(numTs)) return '';
    const ms = numTs < 10000000000 ? numTs * 1000 : numTs;
    const date = new Date(ms);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const dateStringToTimestamp = (dateStr: string) => {
    if (!dateStr) return null;
    return Math.floor(new Date(dateStr).getTime() / 1000);
  };

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const endpoint = typeParam === 'supplier' ? '/supplierinvoices' : '/invoices';
        const response = await api.get(`${endpoint}/${id}`);
        if (response.data) {
          const d = response.data as Invoice;
          setInvoiceStatut(String(d.statut ?? '0'));
          setFormData({
            date: timestampToDateString(d.date),
            datelimit: timestampToDateString(d.datelimit),
          });
          setInvoiceRef(d.ref);

          if (d.lines && Array.isArray(d.lines) && d.lines.length > 0) {
            const localLines = d.lines.map(apiLineToLocal);
            setLines(localLines);
            setOriginalLineIds(d.lines.map((l) => l.id ?? l.rowid).filter(Boolean) as string[]);
          } else {
             // Fallback pour certaines API
            try {
              const linesResp = await api.get(`${endpoint}/${id}/lines`);
              if (linesResp.data && Array.isArray(linesResp.data)) {
                const apiLines = linesResp.data as ProposalLine[];
                setLines(apiLines.map(apiLineToLocal));
                setOriginalLineIds(
                  apiLines.map((l) => l.id ?? l.rowid).filter(Boolean) as string[]
                );
              }
            } catch {
              // Empty gracefully
            }
          }

          if (d.thirdparty?.name) {
            setClientName(d.thirdparty.name);
          } else if (d.soc_name || d.nom) {
            setClientName(d.soc_name || d.nom || '');
          } else if (d.socid) {
            try {
              const tierResp = await api.get(`/thirdparties/${d.socid}`);
              setClientName(tierResp.data?.name || tierResp.data?.nom || `Tiers ID: ${d.socid}`);
            } catch {
              setClientName(`Tiers ID: ${d.socid}`);
            }
          } else {
            setClientName('Inconnu');
          }
        }
      } catch {
        setError('Erreur lors de la récupération des données de la facture.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchInvoice();
  }, [id, typeParam]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload: Record<string, unknown> = {
      date: dateStringToTimestamp(formData.date),
      datelimit: dateStringToTimestamp(formData.datelimit),
    };

    try {
      const endpoint = typeParam === 'supplier' ? '/supplierinvoices' : '/invoices';
      
      await api.put(`${endpoint}/${id}`, payload);

      if (invoiceStatut === '0') {
        const currentOriginalIds = [...originalLineIds];
        for (const lineId of currentOriginalIds) {
          try {
            await api.delete(`${endpoint}/${id}/lines/${lineId}`);
          } catch (err) {
            console.warn(`Ligne ${lineId} impossible à supprimer`);
          }
        }

        for (const line of lines) {
          await api.post(`${endpoint}/${id}/lines`, {
            fk_product: line.fk_product ? parseInt(line.fk_product, 10) : 0,
            product_type: line.product_type,
            desc: line.label,
            qty: Number(line.qty),
            subprice: Number(line.subprice),
            tva_tx: Number(line.tva_tx),
          });
        }
      }

      router.push(`/billing-payments/${id}?type=${typeParam}`);
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      setError(apiErr.response?.data?.error?.message || 'Erreur inattendue lors de la mise à jour.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted text-center text-sm">
          Chargement de la fiche d'édition...
        </div>
      </div>
    );
  }

  const isDraft = invoiceStatut === '0';

  const getStatusBadge = (statut: string) => {
    switch (statut) {
      case '0': return <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">Brouillon</span>;
      case '1': return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Impayée</span>;
      case '2': return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Payée</span>;
      case '3': return <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Abandonnée</span>;
      default:  return <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Inconnu</span>;
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Modifier la facture {invoiceRef}
          </h1>
          <p className="text-muted mt-1 text-sm">
            Modification de l'état, des dates et des lignes de la facture.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-muted hover:text-foreground text-sm font-medium transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm sm:p-8"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="clientName" className="text-foreground block text-sm font-medium">
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

          <div className="sm:col-span-2">
            <p className="text-foreground block text-sm font-medium">État de la facture</p>
            <div className="mt-2">{getStatusBadge(invoiceStatut)}</div>
          </div>

          <div>
            <label htmlFor="date" className="text-foreground block text-sm font-medium">
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

          <div>
            <label htmlFor="datelimit" className="text-foreground block text-sm font-medium">
              Date limite (Échéance)
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

        <ProposalLines lines={lines} onChange={setLines} disabled={!isDraft} />

        {!isDraft && (
          <p className="text-muted -mt-2 text-xs">
            Les lignes ne peuvent être modifiées que sur une facture en statut{' '}
            <strong>Brouillon</strong>.
          </p>
        )}

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

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-muted text-sm">Chargement...</div>}>
      <EditInvoiceContent id={resolvedParams.id} />
    </Suspense>
  );
}
