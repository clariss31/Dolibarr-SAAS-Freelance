'use client';

/**
 * @file app/(dashboard)/commerce/[id]/page.tsx
 *
 * Page de détails d'une proposition commerciale (devis).
 *
 * Machine à états du devis :
 *  - Brouillon (0)  → [Valider (si lignes)] → Ouvert
 *  - Ouvert (1)     → [Remettre en brouillon] → Brouillon | [Accepter/Refuser] → Signé/Non signé
 *  - Signé (2)      → [Rouvrir] → Ouvert | [Classer facturé] → Facturé
 *  - Non signé (3)  → [Rouvrir] → Ouvert | [Supprimer]
 *  - Facturé (4)    → [Rouvrir] → Ouvert
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { Proposal, ProposalLine, ApiError } from '../../../../types/dolibarr';
import {
  formatCurrency,
  formatDate,
  formatVat,
} from '../../../../utils/format';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Badge de statut coloré */
function ProposalStatusBadge({ status }: { status: string | number }) {
  const s = String(status);
  const configs: Record<string, { label: string; className: string }> = {
    '0': {
      label: 'Brouillon',
      className:
        'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-400/10 dark:text-slate-400',
    },
    '1': {
      label: 'Ouvert',
      className:
        'bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30',
    },
    '2': {
      label: 'Signé',
      className:
        'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
    },
    '3': {
      label: 'Non signé',
      className:
        'bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20',
    },
    '4': {
      label: 'Facturé',
      className:
        'bg-purple-50 text-purple-700 ring-purple-700/10 dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/30',
    },
  };
  const config = configs[s] ?? {
    label: 'Inconnu',
    className: 'bg-gray-50 text-gray-600 ring-gray-500/10',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Composant Modal : Accepter / Refuser
// ---------------------------------------------------------------------------

interface CloseModalProps {
  onConfirm: (status: 2 | 3, note: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function CloseProposalModal({ onConfirm, onCancel, loading }: CloseModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<2 | 3 | null>(null);
  const [note, setNote] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-surface border-border w-full max-w-md rounded-2xl border p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2
            id="modal-title"
            className="text-foreground text-lg font-semibold"
          >
            Accepter / Refuser
          </h2>
          <button
            onClick={onCancel}
            aria-label="Fermer"
            className="text-muted hover:text-foreground rounded-full p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Sélection du statut */}
          <div>
            <p className="text-foreground mb-2 text-sm font-medium">
              Positionner le statut à <span className="text-red-500">*</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedStatus(2)}
                className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium transition-all ${
                  selectedStatus === 2
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'border-border text-foreground hover:border-emerald-300'
                }`}
              >
                ✅ Signée
              </button>
              <button
                onClick={() => setSelectedStatus(3)}
                className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium transition-all ${
                  selectedStatus === 3
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                    : 'border-border text-foreground hover:border-red-300'
                }`}
              >
                ❌ Non signée
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label
              htmlFor="close-note"
              className="text-foreground mb-1 block text-sm font-medium"
            >
              Note
            </label>
            <textarea
              id="close-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Raison de l'acceptation ou du refus..."
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onCancel}
              className="text-muted hover:text-foreground text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              disabled={!selectedStatus || loading}
              onClick={() => selectedStatus && onConfirm(selectedStatus, note)}
              className="btn-primary inline-flex justify-center px-5 py-2 text-sm shadow-sm disabled:opacity-40"
            >
              {loading ? 'Enregistrement...' : 'Confirmer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);

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

      // Résolution du nom du tiers
      if (fetchedProposal.thirdparty?.name) {
        setClientName(fetchedProposal.thirdparty.name);
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
      if (apiErr.response?.status === 404) notFound();
      else setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // --- Actions de statut ---

  /** Valide le devis (Brouillon → Ouvert) */
  const handleValidate = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/proposals/${id}/validate`, { notrigger: 0 });
      await fetchDetails();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  /** Remet le devis en brouillon (Ouvert → Brouillon) */
  const handleSetToDraft = async () => {
    if (!window.confirm('Remettre ce devis en brouillon ?')) return;
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/proposals/${id}/settodraft`, {});
      await fetchDetails();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  /** Ferme le devis avec statut Signé ou Non signé */
  const handleClose = async (status: 2 | 3, note: string) => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/proposals/${id}/close`, {
        status,
        note_private: note || '',
        notrigger: 0,
      });
      setShowCloseModal(false);
      await fetchDetails();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  /** Rouvre un devis signé/non-signé/facturé → remet en brouillon */
  const handleReopen = async () => {
    if (!window.confirm('Rouvrir ce devis ? Il repassera en brouillon.'))
      return;
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/proposals/${id}/settodraft`, {});
      await fetchDetails();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  /** Classe le devis comme facturé (Signé → Facturé) */
  const handleSetInvoiced = async () => {
    if (!window.confirm('Classer ce devis comme facturé ?')) return;
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/proposals/${id}/setinvoiced`, {});
      await fetchDetails();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  /** Supprime définitivement le devis */
  const handleDelete = async () => {
    if (
      !window.confirm(
        'Supprimer définitivement ce devis ? Cette action est irréversible.'
      )
    )
      return;
    setActionLoading(true);
    setError('');
    try {
      await api.delete(`/proposals/${id}`);
      router.push('/commerce');
    } catch (err) {
      setError(getErrorMessage(err));
      setActionLoading(false);
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

  if (error && !proposal) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/commerce')}
          className="text-primary text-sm hover:underline"
        >
          ← Retour
        </button>
        <div className="rounded-md bg-[#2d1414] p-4 text-[#ff6b6b] ring-1 ring-red-900/30 ring-inset">
          {error}
        </div>
      </div>
    );
  }

  if (!proposal) return null;

  const statut = String(proposal.statut ?? '0');
  const hasLines = (proposal.lines?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Modale Accepter/Refuser */}
      {showCloseModal && (
        <CloseProposalModal
          onConfirm={handleClose}
          onCancel={() => setShowCloseModal(false)}
          loading={actionLoading}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center">
        <button
          onClick={() => router.push('/commerce')}
          className="text-muted hover:text-foreground text-sm transition-colors hover:underline"
        >
          ← Retour aux devis
        </button>
      </div>

      {/* Message d'erreur contextuel */}
      {error && (
        <div className="rounded-md bg-[#2d1414] p-4 text-sm text-[#ff6b6b] ring-1 ring-red-900/30 ring-inset">
          {error}
        </div>
      )}

      {/* Header : Titre, Statut et Actions */}
      <div className="border-border border-b pb-6 sm:flex sm:items-start sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="bg-primary/10 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl">
            📄
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-foreground text-3xl font-bold tracking-tight">
                {proposal.ref}
              </h1>
              <ProposalStatusBadge status={statut} />
            </div>
            {proposal.socid ? (
              <button
                onClick={() => router.push(`/third-parties/${proposal.socid}`)}
                className="text-muted hover:text-primary mt-1 block text-lg font-medium transition-colors hover:underline"
              >
                {clientName}
              </button>
            ) : (
              <p className="text-muted mt-1 text-lg font-medium">
                {clientName}
              </p>
            )}
          </div>
        </div>

        {/* Boutons d'action contextuels selon le statut */}
        <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-0">
          {/* BROUILLON (0) : Modifier + Valider (si lignes) */}
          {statut === '0' && (
            <>
              <button
                onClick={() => router.push(`/commerce/${id}/edit`)}
                className="bg-background text-foreground ring-border hover:bg-surface inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm ring-1 transition-all ring-inset"
              >
                Modifier
              </button>
              {hasLines && (
                <button
                  onClick={handleValidate}
                  disabled={actionLoading}
                  className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? '...' : 'Valider'}
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-red-500 transition-all hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/10"
              >
                Supprimer
              </button>
            </>
          )}

          {/* OUVERT (1) : Remettre en brouillon + Accepter/Refuser */}
          {statut === '1' && (
            <>
              <button
                onClick={handleSetToDraft}
                disabled={actionLoading}
                className="bg-background text-foreground ring-border hover:bg-surface inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm ring-1 transition-all ring-inset disabled:opacity-50"
              >
                {actionLoading ? '...' : 'Remettre en brouillon'}
              </button>
              <button
                onClick={() => setShowCloseModal(true)}
                disabled={actionLoading}
                className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm shadow-sm disabled:opacity-50"
              >
                Accepter / Refuser
              </button>
            </>
          )}

          {/* SIGNÉ (2) : Rouvrir + Classer facturé + Supprimer */}
          {statut === '2' && (
            <>
              <button
                onClick={handleReopen}
                disabled={actionLoading}
                className="bg-background text-foreground ring-border hover:bg-surface inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm ring-1 transition-all ring-inset disabled:opacity-50"
              >
                {actionLoading ? '...' : 'Rouvrir'}
              </button>
              <button
                onClick={handleSetInvoiced}
                disabled={actionLoading}
                className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm shadow-sm disabled:opacity-50"
              >
                {actionLoading ? '...' : 'Classer facturé'}
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-red-500 transition-all hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/10"
              >
                Supprimer
              </button>
            </>
          )}

          {/* NON SIGNÉ (3) : Rouvrir + Supprimer */}
          {statut === '3' && (
            <>
              <button
                onClick={handleReopen}
                disabled={actionLoading}
                className="bg-background text-foreground ring-border hover:bg-surface inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm ring-1 transition-all ring-inset disabled:opacity-50"
              >
                {actionLoading ? '...' : 'Rouvrir'}
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-red-500 transition-all hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/10"
              >
                Supprimer
              </button>
            </>
          )}

          {/* FACTURÉ (4) : Rouvrir + Supprimer */}
          {statut === '4' && (
            <>
              <button
                onClick={handleReopen}
                disabled={actionLoading}
                className="bg-background text-foreground ring-border hover:bg-surface inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm ring-1 transition-all ring-inset disabled:opacity-50"
              >
                {actionLoading ? '...' : 'Rouvrir'}
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-red-500 transition-all hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/10"
              >
                Supprimer
              </button>
            </>
          )}
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
                {formatDate(proposal.datep || proposal.date)}
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
            {hasLines ? (
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
                          P.U. HT
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
                      {proposal.lines!.map((line: ProposalLine, i: number) => {
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
                              {formatVat(line.tva_tx)}
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
                {statut === '0' && (
                  <p className="mt-2">
                    <button
                      onClick={() => router.push(`/commerce/${id}/edit`)}
                      className="text-primary hover:underline"
                    >
                      Ajouter des lignes →
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
