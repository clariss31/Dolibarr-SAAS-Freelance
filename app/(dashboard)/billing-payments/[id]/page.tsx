'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../services/api';
import { Invoice, ApiError } from '../../../../types/dolibarr';

export default function InvoiceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams?.get('type') || 'client'; // 'client' or 'supplier'
  
  // Use `use` loop for async params in Next 16+
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const endpoint = typeParam === 'supplier' ? '/supplierinvoices' : '/invoices';
        const response = await api.get(`${endpoint}/${id}`);
        if (response.data) {
          setInvoice(response.data);
        } else {
          setError('Facture introuvable.');
        }
      } catch (err: unknown) {
        setError('Erreur lors de la récupération de la facture.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchInvoice();
  }, [id, typeParam]);

  const formatCurrency = (amount: string | number | undefined) => {
    if (amount === undefined || amount === null || amount === '') return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(Number(amount));
  };

  const formatDate = (timestamp: number | string | undefined) => {
    if (!timestamp) return '-';
    if (typeof timestamp === 'string' && timestamp.includes('-')) {
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat('fr-FR').format(date);
    }
    const numTs = Number(timestamp);
    if (isNaN(numTs)) return '-';
    const ms = numTs < 10000000000 ? numTs * 1000 : numTs;
    return new Intl.DateTimeFormat('fr-FR').format(new Date(ms));
  };

  const getStatusBadge = (invoice: Invoice) => {
    const status = Number(invoice.statut);
    switch (status) {
      case 0:
        return <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">Brouillon</span>;
      case 1:
        return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Impayée</span>;
      case 2:
        return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Payée</span>;
      case 3:
        return <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Abandonnée</span>;
      default:
        return <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Inconnu</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted text-center text-sm">
          Chargement de la facture...
        </div>
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
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset">
          {error || 'Introuvable'}
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce brouillon ?')) return;
    setIsDeleting(true);
    setError('');
    try {
      const endpoint = typeParam === 'supplier' ? '/supplierinvoices' : '/invoices';
      await api.delete(`${endpoint}/${id}`);
      router.push('/billing-payments');
    } catch {
      setError('Erreur lors de la suppression de la facture.');
      setIsDeleting(false);
    }
  };

  // Calculate full TVA if not natively included efficiently in the root object API
  const totalHt = Number(invoice.total_ht) || 0;
  const totalTtc = Number(invoice.total_ttc) || 0;
  const totalTva = Number(invoice.total_tva) || (totalTtc - totalHt);

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center">
        <button
          onClick={() => router.push('/billing-payments')}
          className="text-muted hover:text-foreground text-sm transition-colors hover:underline"
        >
          &larr; Retour à la liste
        </button>
      </div>

      {/* Title Header */}
      <div className="border-border border-b py-2 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-foreground text-3xl font-bold tracking-tight">
            {invoice.ref}
          </h1>
          {getStatusBadge(invoice)}
        </div>
        {Number(invoice.statut) === 0 && (
          <div className="mt-4 sm:mt-0 sm:flex sm:items-center sm:space-x-4">
            <button
              onClick={() => router.push(`/billing-payments/${id}/edit?type=${typeParam}`)}
              className="inline-flex cursor-pointer justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 transition-colors ring-inset hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700"
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

      {/* Grid panels */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Infos générales */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
              Informations générales
            </h3>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Date facturation
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {formatDate(invoice.date)}
              </p>
            </div>
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Date d'échéance
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {formatDate(invoice.datelimit)}
              </p>
            </div>
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Tiers
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {invoice.soc_name || invoice.nom || invoice.thirdparty?.name || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Totaux financiers */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
              Montants
            </h3>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex justify-between items-center">
              <p className="text-muted text-sm font-medium">
                Montant HT
              </p>
              <p className="text-foreground text-sm font-semibold">
                {formatCurrency(totalHt)}
              </p>
            </div>
            <div className="flex justify-between items-center pt-2">
              <p className="text-muted text-sm font-medium">
                Montant TVA
              </p>
              <p className="text-foreground text-sm font-semibold">
                {formatCurrency(totalTva)}
              </p>
            </div>
            <div className="border-border flex justify-between items-center border-t pt-2 mt-2">
              <p className="text-muted text-base font-semibold">
                Montant TTC
              </p>
              <p className="text-primary text-base font-bold">
                {formatCurrency(totalTtc)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Lignes de facture */}
      <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm mt-8">
        <div className="border-border bg-background border-b px-5 py-4">
          <h3 className="text-foreground text-base leading-6 font-semibold">
            Lignes de la facture
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="divide-border min-w-full divide-y">
            <thead className="bg-background">
              <tr>
                <th scope="col" className="text-foreground py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pl-6 w-[45%]">
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
              {(!invoice.lines || invoice.lines.length === 0) ? (
                <tr>
                  <td colSpan={5} className="text-muted py-6 text-center text-sm italic">
                    Aucune ligne pour cette facture
                  </td>
                </tr>
              ) : (
                invoice.lines.map((line, idx) => {
                  const lineId = line.id ?? line.rowid ?? `line-${idx}`;
                  const description = line.label || line.description || line.product_label || '-';
                  const tva = Number(line.tva_tx) || 0;
                  const puHt = Number(line.subprice || line.up) || 0;
                  const qte = Number(line.qty) || 1;
                  const lineTotalHt = Number(line.total_ht) || (puHt * qte);

                  return (
                    <tr key={lineId} className="hover:bg-background/50 transition-colors">
                      <td className="text-foreground py-4 pr-3 pl-4 text-sm sm:pl-6 align-top">
                        <div className="whitespace-pre-wrap">{description}</div>
                      </td>
                      <td className="text-muted px-3 py-4 text-sm text-center align-top whitespace-nowrap">
                        {tva}%
                      </td>
                      <td className="text-muted px-3 py-4 text-sm text-right align-top whitespace-nowrap">
                        {formatCurrency(puHt)}
                      </td>
                      <td className="text-muted px-3 py-4 text-sm text-center align-top whitespace-nowrap">
                        {qte}
                      </td>
                      <td className="text-foreground px-3 py-4 text-sm text-right font-medium align-top whitespace-nowrap">
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
