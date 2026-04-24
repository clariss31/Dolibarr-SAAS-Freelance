'use client';

/**
 * @file app/(dashboard)/commerce/[id]/edit/page.tsx
 *
 * Page d'édition d'une proposition commerciale (devis) Dolibarr.
 *
 * Fonctionnalités :
 * - Chargement des données de l'en-tête (dates, statut).
 * - Résolution dynamique du nom du tiers.
 * - Gestion synchronisée des lignes de devis (suppression/recréation pour les brouillons).
 * - Suppression définitive du devis.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../../services/api';
import { Proposal, ProposalLine } from '../../../../../types/dolibarr';
import { getErrorMessage } from '../../../../../utils/error-handler';
import ProposalLines, {
  LocalLine,
} from '../../../../../components/ui/ProposalLines';
import {
  timestampToDateString,
  dateStringToTimestamp,
  calculateDaysDiff,
} from '../../../../../utils/format';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Transforme une ligne API Dolibarr en ligne locale (avec clé unique React).
 *
 * @param line - La ligne brute provenant de l'API.
 * @param index - Index de secours pour la clé.
 * @returns La ligne formatée pour l'interface utilisateur.
 */
function apiLineToLocal(line: ProposalLine, index: number): LocalLine {
  const resolvedLabel: string =
    line.product_label ||
    line.label ||
    line.description ||
    `Ligne ${index + 1}`;

  const unitPrice = Number(line.subprice ?? 0);
  const qty = Number(line.qty) || 1;
  const tva = Number(line.tva_tx) || 0;
  const remise = Number(line.remise_percent) || 0;

  // Recalcul local si les totaux fournis par l'API sont absents
  const base_ht = qty * unitPrice;
  const totalHt =
    Number(line.total_ht) ||
    parseFloat((base_ht * (1 - remise / 100)).toFixed(2));
  const totalTtc =
    Number(line.total_ttc) ||
    parseFloat((totalHt * (1 + tva / 100)).toFixed(2));

  return {
    _key: `existing-${line.id ?? index}-${Date.now()}`,
    id: line.id ? String(line.id) : undefined,
    fk_product: line.fk_product ? String(line.fk_product) : undefined,
    product_type: 0,
    label: resolvedLabel,
    qty,
    subprice: unitPrice,
    tva_tx: tva,
    remise_percent: remise,
    total_ht: totalHt,
    total_ttc: totalTtc,
  };
}

// ---------------------------------------------------------------------------
// Composant Page
// ---------------------------------------------------------------------------

/**
 * Page d'édition principale.
 */
export default function EditCommercePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // --- États ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [proposalRef, setProposalRef] = useState('');
  const [clientName, setClientName] = useState('Chargement...');

  const [statut, setStatut] = useState('0');
  const [formData, setFormData] = useState({
    datep: '',
    fin_validite: '',
  });

  const [lines, setLines] = useState<LocalLine[]>([]);
  const [originalLineIds, setOriginalLineIds] = useState<string[]>([]);

  // --- Logique de récupération ---

  /** Charge les données du devis */
  const fetchProposal = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/proposals/${id}`);
      if (response.data) {
        const d = response.data as Proposal;
        setProposalRef(d.ref);
        setStatut(String(d.statut ?? '0'));
        setFormData({
          datep: timestampToDateString(d.datep || d.date),
          fin_validite: timestampToDateString(d.fin_validite),
        });

        // Chargement des lignes avec fallback sur endpoint dédié
        let apiLines: ProposalLine[] = d.lines || [];
        if (apiLines.length === 0) {
          try {
            const linesResp = await api.get(`/proposals/${id}/lines`);
            if (Array.isArray(linesResp.data)) {
              apiLines = linesResp.data as ProposalLine[];
            }
          } catch (e) {
            /* Pas de lignes */
          }
        }

        setLines(apiLines.map(apiLineToLocal));
        setOriginalLineIds(
          apiLines.map((l) => l.id).filter(Boolean) as string[]
        );

        // Résolution du tiers (Priorité aux données incluses, sinon appel API)
        if (d.thirdparty?.name) {
          setClientName(d.thirdparty.name);
        } else if (d.soc_name || d.name) {
          setClientName(d.soc_name || d.name || '');
        } else if (d.socid) {
          const tierResp = await api.get(`/thirdparties/${d.socid}`);
          setClientName(tierResp.data?.name || `Tiers ID: ${d.socid}`);
        } else {
          setClientName('Inconnu');
        }
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  // --- Handlers ---

  /** Mise à jour des champs date */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /** Soumission du formulaire */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Calcul de la durée de validité en jours
    const dureeValidite = calculateDaysDiff(formData.datep, formData.fin_validite);

    const payload = {
      // On conserve le statut actuel sans le modifier ici (géré via les boutons d'action)
      statut: parseInt(statut, 10),
      date: dateStringToTimestamp(formData.datep),
      datep: dateStringToTimestamp(formData.datep),
      fin_validite: dateStringToTimestamp(formData.fin_validite),
      date_fin_validite: dateStringToTimestamp(formData.fin_validite),
      duree_validite: dureeValidite,
    };

    try {
      // 1. Mise à jour de l'en-tête (Dates, Statut)
      await api.put(`/proposals/${id}`, payload);

      // 2. Synchronisation des lignes (Uniquement si Brouillon '0')
      if (statut === '0') {
        // Suppression massive des anciennes lignes
        for (const lineId of originalLineIds) {
          try {
            await api.delete(`/proposals/${id}/lines/${lineId}`);
          } catch (e) {
            /* Ligne déjà absente */
          }
        }

        // Création des nouvelles lignes
        for (const line of lines) {
          await api.post(`/proposals/${id}/line`, {
            fk_product: line.fk_product ? parseInt(line.fk_product, 10) : 0,
            product_type: line.product_type,
            desc: line.label,
            qty: Number(line.qty),
            subprice: Number(line.subprice),
            tva_tx: Number(line.tva_tx),
            remise_percent: Number(line.remise_percent) || 0,
          });
        }
      }

      router.push(`/commerce/${id}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  // --- Rendu ---

  if (loading) {
    return (
      <div className="flex animate-pulse items-center justify-center py-20">
        <div className="text-muted text-sm italic">
          Préparation du formulaire d'édition...
        </div>
      </div>
    );
  }

  const isDraft = statut === '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Modifier le devis {proposalRef}
          </h1>
          <p className="text-muted mt-1 text-sm">
            Modification des dates et du détail commercial.
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-muted hover:text-foreground text-sm font-medium transition-colors"
        >
          Annuler
        </button>
      </div>

      {error && (
        <div
          className="animate-in fade-in slide-in-from-top-2 rounded-lg border border-red-900/50 bg-[#2d1414] p-4 text-sm font-medium text-[#ff6b6b] shadow-lg duration-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Formulaire Principal */}
      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm sm:p-8"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          {/* Tiers Associé */}
          <div className="sm:col-span-2">
            <label className="text-foreground mb-2 block text-sm font-medium">
              Client / Prospect
            </label>
            <input
              type="text"
              value={clientName}
              disabled
              className="bg-muted/10 text-foreground ring-border block w-full cursor-not-allowed rounded-md border-0 px-3 py-2 opacity-70 ring-1 ring-inset sm:text-sm"
            />
          </div>

          {/* Statut affiché en lecture seule (modifiable via les boutons de la fiche détail) */}
          <div className="sm:col-span-2">
            <p className="text-foreground mb-2 block text-sm font-medium">
              État du devis
            </p>
            <div className="flex items-center gap-2">
              {statut === '0' && (
                <span className="inline-flex items-center rounded-md bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-500/10 ring-inset dark:bg-slate-400/10 dark:text-slate-400">
                  Brouillon
                </span>
              )}
              {statut === '1' && (
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-sm font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset dark:bg-blue-400/10 dark:text-blue-400">
                  Ouvert
                </span>
              )}
              {statut === '2' && (
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset dark:bg-emerald-500/10 dark:text-emerald-400">
                  Signé
                </span>
              )}
              {statut === '3' && (
                <span className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-1 text-sm font-medium text-red-700 ring-1 ring-red-600/10 ring-inset dark:bg-red-400/10 dark:text-red-400">
                  Non signé
                </span>
              )}
              {statut === '4' && (
                <span className="inline-flex items-center rounded-md bg-purple-50 px-2.5 py-1 text-sm font-medium text-purple-700 ring-1 ring-purple-700/10 ring-inset dark:bg-purple-400/10 dark:text-purple-400">
                  Facturé
                </span>
              )}
              <span className="text-muted text-xs">
                (Le statut se modifie depuis la fiche du devis)
              </span>
            </div>
          </div>

          {/* Dates */}
          <div>
            <label
              htmlFor="datep"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Date de proposition *
            </label>
            <input
              type="date"
              id="datep"
              name="datep"
              required
              value={formData.datep}
              onChange={handleChange}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
            />
          </div>

          <div>
            <label
              htmlFor="fin_validite"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Date de fin de validité
            </label>
            <input
              type="date"
              id="fin_validite"
              name="fin_validite"
              value={formData.fin_validite}
              onChange={handleChange}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
            />
          </div>
        </div>

        {/* Lignes du devis */}
        <div className="space-y-4">
          <ProposalLines
            lines={lines}
            onChange={setLines}
            disabled={!isDraft}
          />
        </div>

        {/* Actions */}
        <div className="border-border flex items-center justify-end border-t pt-6">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex justify-center px-6 py-2 shadow-sm disabled:opacity-50"
          >
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
