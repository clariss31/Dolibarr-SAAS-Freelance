'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../services/api';
import { Proposal, ProposalLine, ThirdParty, ApiError } from '../../../../types/dolibarr';

export default function CommerceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [clientName, setClientName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer définitivement ce devis ?')) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/proposals/${id}`);
      router.push('/commerce');
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      setError(apiErr.response?.data?.error?.message || 'Impossible de supprimer ce devis.');
      setDeleting(false);
    }
  };

  useEffect(() => {
    const fetchProposalAndClient = async () => {
      try {
        const response = await api.get(`/proposals/${id}`);
        if (response.data) {
          const fetchedProposal = response.data as Proposal;
          setProposal(fetchedProposal);

          // Résoudre le nom du tiers
          if (fetchedProposal.thirdparty?.name) {
            setClientName(fetchedProposal.thirdparty.name);
          } else if (fetchedProposal.soc_name || fetchedProposal.name) {
            setClientName(
              fetchedProposal.soc_name || fetchedProposal.name || ''
            );
          } else if (fetchedProposal.socid) {
            try {
              const tierResp = await api.get(
                `/thirdparties/${fetchedProposal.socid}`
              );
              setClientName(
                tierResp.data?.name ||
                  tierResp.data?.nom ||
                  `Tiers ID: ${fetchedProposal.socid}`
              );
            } catch {
              setClientName(`Tiers ID: ${fetchedProposal.socid}`);
            }
          } else {
            setClientName('Inconnu');
          }
        } else {
          setError('Proposition commerciale introuvable.');
        }
      } catch (err: unknown) {
        setError('Erreur lors de la récupération des informations du devis.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProposalAndClient();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted text-center text-sm">
          Chargement des détails du devis...
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/commerce')}
          className="text-primary decoration-primary text-sm hover:underline"
        >
          &larr; Retour aux devis
        </button>
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset">
          {error || 'Introuvable'}
        </div>
      </div>
    );
  }

  const formatPrice = (price: string | number | undefined) => {
    if (price === undefined) return '0,00 €';
    const num = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(num);
  };

  const formatDate = (timestamp: string | number | undefined) => {
    if (!timestamp) return '-';
    const ts =
      typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    return new Date(ts * 1000).toLocaleDateString('fr-FR');
  };

  const getStatusBadge = (status: string | number) => {
    const s = String(status);
    switch (s) {
      case '1':
        return (
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
            Ouvert
          </span>
        );
      case '2':
        return (
          <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-green-600/20 ring-inset dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
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
      case '0':
      default:
        return (
          <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
            Brouillon
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center">
        <button
          onClick={() => router.push('/commerce')}
          className="text-muted hover:text-foreground text-sm transition-colors hover:underline"
        >
          &larr; Retour aux devis
        </button>
      </div>

      {/* Title Header */}
      <div className="border-border border-b py-2 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-4xl">📄</span>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-foreground text-3xl font-bold tracking-tight">
                {proposal.ref}
              </h1>
              {getStatusBadge(proposal.statut)}
            </div>
            <p className="text-muted mt-1 text-lg">{clientName}</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 sm:flex sm:items-center sm:space-x-4">
          <button
            onClick={() => router.push(`/commerce/${id}/edit`)}
            className="inline-flex justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 transition-colors ring-inset hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700"
          >
            Modifier
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm font-semibold text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
          >
            {deleting ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>

      {/* Grid panels */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {/* Informations générales */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
              Informations générales
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Date de proposition
              </p>
              <p className="text-foreground mt-1 text-sm">
                {formatDate(proposal.datep)}
              </p>
            </div>
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Fin de validité
              </p>
              <p className="text-foreground mt-1 text-sm">
                {formatDate(proposal.fin_validite)}
              </p>
            </div>
          </div>
        </div>

        {/* Tiers */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
              Tiers
            </h3>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Tiers
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {clientName}
              </p>
            </div>
            {proposal.socid && (
              <div className="pt-2">
                <button
                  onClick={() =>
                    router.push(`/third-parties/${proposal.socid}`)
                  }
                  className="text-primary hover:text-primary-hover text-sm font-medium hover:underline"
                >
                  Voir la fiche client &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lignes du devis */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md sm:col-span-2">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
              Lignes du devis
            </h3>
          </div>
          <div className="p-5">
            {proposal.lines && proposal.lines.length > 0 ? (
              <>
                <div className="overflow-x-auto rounded-lg">
                  <table className="ring-border w-full text-sm ring-1">
                    <thead className="bg-background">
                      <tr>
                        <th scope="col" className="text-foreground px-4 py-3 text-left font-medium">Désignation</th>
                        <th scope="col" className="text-foreground px-4 py-3 text-right font-medium">Prix unit. HT</th>
                        <th scope="col" className="text-foreground px-4 py-3 text-right font-medium">TVA %</th>
                        <th scope="col" className="text-foreground px-4 py-3 text-right font-medium">Qté</th>
                        <th scope="col" className="text-foreground px-4 py-3 text-right font-medium">Sous-total HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {proposal.lines.map((line: ProposalLine, i: number) => {
                        const label = line.product_label || line.label || line.description || `Ligne ${i + 1}`;
                        const unitPrice = Number(line.subprice ?? line.up ?? 0);
                        const qty = Number(line.qty);
                        const tva = Number(line.tva_tx);
                        const totalHt = Number(line.total_ht) || parseFloat((qty * unitPrice).toFixed(2));
                        return (
                          <tr key={line.rowid ?? line.id ?? i} className="hover:bg-surface/50 transition-colors">
                            <td className="text-foreground px-4 py-3">{label}</td>
                            <td className="text-foreground px-4 py-3 text-right">{formatPrice(unitPrice)}</td>
                            <td className="text-muted px-4 py-3 text-right">{tva} %</td>
                            <td className="text-foreground px-4 py-3 text-right">{qty}</td>
                            <td className="text-foreground px-4 py-3 text-right font-medium">{formatPrice(totalHt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Récapitulatif totaux */}
                <dl className="bg-background border-border divide-border mt-4 divide-y rounded-lg border">
                  <div className="flex justify-between px-4 py-3 text-sm">
                    <dt className="text-muted">Total HT</dt>
                    <dd className="text-foreground font-medium">{formatPrice(proposal.total_ht)}</dd>
                  </div>
                  <div className="flex justify-between px-4 py-3 text-sm">
                    <dt className="text-muted">TVA</dt>
                    <dd className="text-foreground font-medium">
                      {formatPrice(
                        Number(proposal.total_ttc ?? 0) - Number(proposal.total_ht ?? 0)
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between px-4 py-3 text-sm font-semibold">
                    <dt className="text-foreground">Total TTC</dt>
                    <dd className="text-foreground">{formatPrice(proposal.total_ttc)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-muted py-6 text-center text-sm">Aucune ligne sur ce devis.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
