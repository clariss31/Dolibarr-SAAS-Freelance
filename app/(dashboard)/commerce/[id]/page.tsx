'use client';

/**
 * @file app/(dashboard)/commerce/[id]/page.tsx
 *
 * Page de détails d'une proposition commerciale (devis).
 *
 * Fonctionnalités :
 * - Affichage exhaustif des informations d'en-tête (Dates, Client).
 * - Résolution robuste du nom du tiers (fallback API si nécessaire).
 * - Liste détaillée des lignes de produits et services.
 * - Récapitulatif financier (HT, TVA, TTC).
 * - Actions rapides : Modification et Suppression.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { Proposal, ProposalLine, ApiError } from '../../../../types/dolibarr';

// ---------------------------------------------------------------------------
// Helpers purs (Extrait pour la propreté)
// ---------------------------------------------------------------------------

/**
 * Formate un montant en euros avec la locale française.
 */
function formatCurrency(amount: string | number | undefined): string {
  if (amount === undefined || amount === null || amount === '') return '0,00 €';
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num);
}

/**
 * Formate un timestamp Dolibarr (secondes) en date lisible dd/mm/yyyy.
 */
function formatDate(timestamp: string | number | undefined): string {
  if (!timestamp) return '-';
  const ts =
    typeof timestamp === 'string' ? parseInt(timestamp, 10) : Number(timestamp);
  if (isNaN(ts) || ts === 0) return '-';
  return new Intl.DateTimeFormat('fr-FR').format(new Date(ts * 1000));
}

/**
 * Badge coloré représentant le statut d'une proposition commerciale.
 */
function ProposalStatusBadge({ status }: { status: string | number }) {
  const s = String(status);
  switch (s) {
    case '0':
      return (
        <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-500/10 ring-inset">
          Brouillon
        </span>
      );
    case '1':
      return (
        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
          Ouvert
        </span>
      );
    case '2':
      return (
        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20">
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
        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset">
          Inconnu
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

export default function CommerceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // --- États ---
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [clientName, setClientName] = useState<string>('Chargement...');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  /** Charge les détails du devis et résout le tiers */
  const fetchDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/proposals/${id}`);
      if (!response.data) {
        setError('Document introuvable.');
        return;
      }

      const fetchedProposal = response.data as Proposal;
      setProposal(fetchedProposal);

      // --- Résolution du nom du tiers ---
      if (fetchedProposal.thirdparty?.name) {
        setClientName(fetchedProposal.thirdparty.name);
      } else if (fetchedProposal.soc_name || fetchedProposal.name) {
        setClientName(fetchedProposal.soc_name || fetchedProposal.name || '');
      } else if (fetchedProposal.socid) {
        try {
          const tierResp = await api.get(
            `/thirdparties/${fetchedProposal.socid}`
          );
          setClientName(
            tierResp.data?.name || `Tiers ID: ${fetchedProposal.socid}`
          );
        } catch {
          setClientName(`Tiers ID: ${fetchedProposal.socid}`);
        }
      } else {
        setClientName('Inconnu');
      }
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.response?.status === 404) {
        notFound();
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // --- Handlers ---

  const handleDelete = async () => {
    if (!window.confirm('Voulez-vous supprimer définitivement ce devis ?'))
      return;

    setDeleting(true);
    setError('');
    try {
      await api.delete(`/proposals/${id}`);
      router.push('/commerce');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  };

  // --- Rendu ---

  if (loading) {
    return (
      <div className="flex animate-pulse items-center justify-center py-20">
        <div className="text-muted text-sm italic">
          Chargement du document commercial...
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/commerce')}
          className="text-primary text-sm hover:underline"
        >
          &larr; Retour
        </button>
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200">
          {error || 'Document introuvable'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center">
        <button
          onClick={() => router.push('/commerce')}
          className="text-muted hover:text-foreground text-sm transition-colors hover:underline"
        >
          &larr; Retour aux devis
        </button>
      </div>

      {/* Header : Titre, Statut et Actions */}
      <div className="border-border border-b pb-6 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-xl text-3xl">
            📄
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-foreground text-3xl font-bold tracking-tight">
                {proposal.ref}
              </h1>
              <ProposalStatusBadge status={proposal.statut ?? '0'} />
            </div>
            {proposal.socid ? (
              <button
                onClick={() => router.push(`/third-parties/${proposal.socid}`)}
                className="text-muted hover:text-primary mt-1 block text-lg font-medium transition-colors hover:underline"
              >
                {clientName}
              </button>
            ) : (
              <p className="text-muted mt-1 text-lg font-medium">{clientName}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 sm:mt-0">
          <button
            onClick={() => router.push(`/commerce/${id}/edit`)}
            className="bg-background text-foreground ring-border hover:bg-surface inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm ring-1 transition-all ring-inset"
          >
            Modifier
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-red-600 transition-all hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/10"
          >
            {deleting ? '...' : 'Supprimer'}
          </button>
        </div>
      </div>

      {/* Grid d'informations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Informations générales */}
        <section className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base font-semibold">
              Informations générales
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-6 p-5">
            <div>
              <p className="text-muted text-xs font-bold tracking-widest uppercase">
                Date proposition
              </p>
              <p className="text-foreground mt-1 text-sm">
                {formatDate(proposal.datep)}
              </p>
            </div>
            <div>
              <p className="text-muted text-xs font-bold tracking-widest uppercase">
                Fin de validité
              </p>
              <p className="text-foreground mt-1 text-sm">
                {formatDate(proposal.fin_validite)}
              </p>
            </div>
          </div>
        </section>

        {/* Tiers / Client */}
        <section className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base font-semibold">Tiers</h3>
          </div>
          <div className="p-5">
            <p className="text-muted text-xs font-bold tracking-widest uppercase">
              Client / Prospect
            </p>
            {proposal.socid ? (
              <button
                onClick={() => router.push(`/third-parties/${proposal.socid}`)}
                className="text-primary mt-1 block text-sm font-semibold hover:underline"
              >
                {clientName}
              </button>
            ) : (
              <p className="text-foreground mt-1 text-sm font-semibold">
                {clientName}
              </p>
            )}
          </div>
        </section>

        {/* Tableau des lignes */}
        <section className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md lg:col-span-2">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base font-semibold">
              Lignes du devis
            </h3>
          </div>
          <div className="p-0 sm:p-5">
            {proposal.lines && proposal.lines.length > 0 ? (
              <div className="space-y-6">
                <div className="border-border overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-background">
                      <tr className="border-border border-b">
                        <th
                          scope="col"
                          className="text-foreground px-4 py-3 text-left font-medium"
                        >
                          Désignation
                        </th>
                        <th
                          scope="col"
                          className="text-foreground px-4 py-3 text-right font-medium"
                        >
                          Prix HT
                        </th>
                        <th
                          scope="col"
                          className="text-foreground px-4 py-3 text-right font-medium"
                        >
                          TVA
                        </th>
                        <th
                          scope="col"
                          className="text-foreground px-4 py-3 text-right font-medium"
                        >
                          Remise
                        </th>
                        <th
                          scope="col"
                          className="text-foreground px-4 py-3 text-center font-medium"
                        >
                          Qté
                        </th>
                        <th
                          scope="col"
                          className="text-foreground px-4 py-3 text-right font-medium"
                        >
                          Total HT
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {proposal.lines.map((line, i) => {
                        const label =
                          line.product_label ||
                          line.label ||
                          line.description ||
                          `Ligne ${i + 1}`;
                        const totalLineHt =
                          Number(line.total_ht) ||
                          Number(line.subprice || 0) * Number(line.qty || 0);
                        return (
                          <tr
                            key={line.id || i}
                            className="hover:bg-background/50 transition-colors"
                          >
                            <td className="text-foreground px-4 py-3 font-medium">
                              {label}
                            </td>
                            <td className="text-foreground px-4 py-3 text-right">
                              {formatCurrency(line.subprice)}
                            </td>
                            <td className="text-muted px-4 py-3 text-right">
                              {line.tva_tx}%
                            </td>
                            <td className="text-muted px-4 py-3 text-right">
                              {Number(line.remise_percent || 0)}%
                            </td>
                            <td className="text-foreground px-4 py-3 text-center font-medium">
                              {line.qty}
                            </td>
                            <td className="text-foreground px-4 py-3 text-right font-semibold">
                              {formatCurrency(totalLineHt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totaux */}
                <div className="flex justify-end">
                  <dl className="bg-background border-border w-full max-w-xs space-y-3 rounded-xl border p-5 shadow-sm">
                    <div className="flex justify-between text-sm">
                      <dt className="text-muted">Total HT</dt>
                      <dd className="text-foreground font-semibold">
                        {formatCurrency(proposal.total_ht)}
                      </dd>
                    </div>
                    <div className="flex justify-between text-sm">
                      <dt className="text-muted">TVA</dt>
                      <dd className="text-foreground font-semibold">
                        {formatCurrency(
                          Number(proposal.total_ttc || 0) -
                            Number(proposal.total_ht || 0)
                        )}
                      </dd>
                    </div>
                    <div className="border-border flex justify-between border-t pt-3 text-base font-bold">
                      <dt className="text-foreground">Total TTC</dt>
                      <dd className="text-primary">
                        {formatCurrency(proposal.total_ttc)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : (
              <div className="text-muted py-12 text-center text-sm italic">
                Aucune ligne enregistrée sur ce devis.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
