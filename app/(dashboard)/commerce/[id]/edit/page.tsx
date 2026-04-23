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

// ---------------------------------------------------------------------------
// Helpers (Extract outside component for better performance/purity)
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

/**
 * Convertit un timestamp (secondes) en chaîne YYYY-MM-DD pour les inputs HTML5.
 */
function timestampToDateString(ts: string | number | undefined): string {
  if (!ts) return '';
  const date = new Date(Number(ts) * 1000);
  // Utiliser les composants locaux pour éviter les sauts de date liés à l'UTC
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Convertit une chaîne YYYY-MM-DD en timestamp (secondes).
 */
function dateStringToTimestamp(dateStr: string): number | null {
  if (!dateStr) return null;
  // Utiliser midi pour éviter les décalages de fuseau horaire (évite le passage au jour précédent)
  return Math.floor(new Date(dateStr + 'T12:00:00').getTime() / 1000);
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

  const [formData, setFormData] = useState({
    statut: '0',
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
        setFormData({
          statut: String(d.statut ?? '0'),
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

  /** Mise à jour des champs texte/select */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /** Soumission du formulaire */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Calcul de la durée de validité en jours (différence entre les deux dates)
    const dateStart = new Date(formData.datep + 'T12:00:00');
    const dateEnd = new Date(formData.fin_validite + 'T12:00:00');
    const diffTime = dateEnd.getTime() - dateStart.getTime();
    const dureeValidite = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const payload = {
      statut: parseInt(formData.statut, 10),
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
      if (formData.statut === '0') {
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

  /** Suppression définitive du devis */
  const handleDelete = async () => {
    if (
      !window.confirm(
        'Voulez-vous supprimer ce devis ? Cette action est irréversible.'
      )
    )
      return;

    setError('');
    try {
      await api.delete(`/proposals/${id}`);
      router.push('/commerce');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
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

  const isDraft = formData.statut === '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Modifier le devis {proposalRef}
          </h1>
          <p className="text-muted mt-1 text-sm">
            Modification de l'état, des dates et du détail commercial.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleDelete}
            className="text-sm font-medium text-red-500 transition-colors hover:text-red-600"
          >
            Supprimer
          </button>
          <button
            onClick={() => router.back()}
            className="text-muted hover:text-foreground text-sm font-medium transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200">
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

          {/* Statut du devis */}
          <div className="sm:col-span-2">
            <label
              htmlFor="statut"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              État du devis *
            </label>
            <select
              id="statut"
              name="statut"
              required
              value={formData.statut}
              onChange={handleChange}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
            >
              <option value="0">Brouillon</option>
              <option value="1">Ouvert</option>
              <option value="2">Signé</option>
              <option value="3">Non signé</option>
              <option value="4">Facturé</option>
            </select>
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
          {!isDraft && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              💡 Les lignes ne sont modifiables que lorsque le devis est en mode{' '}
              <strong>Brouillon</strong>.
            </p>
          )}
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
