'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../../services/api';
import {
  Proposal,
  ProposalLine,
  ApiError,
} from '../../../../../types/dolibarr';
import { getErrorMessage } from '../../../../../utils/error-handler';
import ProposalLines, {
  LocalLine,
} from '../../../../../components/ui/ProposalLines';

/** Transforme une ligne API Dolibarr en ligne locale (avec clé unique React).
 *  Dolibarr utilise `product_label` pour le nom du produit et renvoie les
 *  valeurs numériques sous forme de strings — on normalise tout ici. */
function apiLineToLocal(line: ProposalLine, index: number): LocalLine {
  // Résolution du libellé : Dolibarr stocke le nom du produit dans product_label
  const resolvedLabel: string =
    line.product_label ||
    line.label ||
    line.description ||
    `Ligne ${index + 1}`;
  // Résolution de l'ID de ligne
  const lineId = line.id ?? line.id;
  // Prix unitaire : subprice ou son alias `up`
  const unitPrice = Number(line.subprice ?? 0);
  const qty = Number(line.qty) || 1;
  const tva = Number(line.tva_tx) || 0;
  const remise = Number(line.remise_percent) || 0;
  // Recalcul local si les totaux fournis par l'API sont à 0
  const base_ht = qty * unitPrice;
  const totalHt =
    Number(line.total_ht) || parseFloat((base_ht * (1 - remise / 100)).toFixed(2));
  const totalTtc =
    Number(line.total_ttc) ||
    parseFloat((totalHt * (1 + tva / 100)).toFixed(2));

  return {
    _key: `existing-${lineId ?? index}-${Date.now()}`,
    id: lineId ? String(lineId) : undefined,
    fk_product: line.fk_product ? String(line.fk_product) : undefined,
    product_type: 0, // Valeur par défaut — Dolibarr le remplit depuis fk_product
    label: resolvedLabel,
    qty,
    subprice: unitPrice,
    tva_tx: tva,
    remise_percent: remise,
    total_ht: totalHt,
    total_ttc: totalTtc,
  };
}

export default function EditCommercePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [formData, setFormData] = useState({
    statut: '0',
    datep: '',
    fin_validite: '',
  });

  const [lines, setLines] = useState<LocalLine[]>([]);
  const [originalLineIds, setOriginalLineIds] = useState<string[]>([]);
  const [proposalRef, setProposalRef] = useState('');
  const [clientName, setClientName] = useState('Chargement...');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

  // Helper to convert timestamp (seconds) to YYYY-MM-DD for <input type="date">
  const timestampToDateString = (ts: string | number | undefined) => {
    if (!ts) return '';
    const date = new Date(Number(ts) * 1000);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Helper to convert YYYY-MM-DD back to timestamp (seconds)
  const dateStringToTimestamp = (dateStr: string) => {
    if (!dateStr) return null;
    return Math.floor(new Date(dateStr).getTime() / 1000);
  };

  useEffect(() => {
    const fetchProposal = async () => {
      try {
        const response = await api.get(`/proposals/${id}`);
        if (response.data) {
          const d = response.data as Proposal;
          setProposalRef(d.ref);
          setFormData({
            statut: String(d.statut ?? '0'),
            datep: timestampToDateString(d.datep),
            fin_validite: timestampToDateString(d.fin_validite),
          });

          // Chargement des lignes existantes
          if (d.lines && Array.isArray(d.lines) && d.lines.length > 0) {
            const localLines = d.lines.map(apiLineToLocal);
            setLines(localLines);
            setOriginalLineIds(
              d.lines.map((l) => l.id).filter(Boolean) as string[]
            );
          } else {
            // Fallback : charger via endpoint dédié
            try {
              const linesResp = await api.get(`/proposals/${id}/lines`);
              if (linesResp.data && Array.isArray(linesResp.data)) {
                const apiLines = linesResp.data as ProposalLine[];
                setLines(apiLines.map(apiLineToLocal));
                setOriginalLineIds(
                  apiLines.map((l) => l.id).filter(Boolean) as string[]
                );
              }
            } catch {
              // Pas de lignes existantes
            }
          }

          // Résolution du nom du tiers
          if (d.thirdparty?.name) {
            setClientName(d.thirdparty.name);
          } else if (d.soc_name || d.name) {
            setClientName(d.soc_name || d.name || '');
          } else if (d.socid) {
            try {
              const tierResp = await api.get(`/thirdparties/${d.socid}`);
              setClientName(
                tierResp.data?.name ||
                  tierResp.data?.nom ||
                  `Tiers ID: ${d.socid}`
              );
            } catch {
              setClientName(`Tiers ID: ${d.socid}`);
            }
          } else {
            setClientName('Inconnu');
          }
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProposal();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Payload de base pour l'en-tête du devis (dates, statut)
    const payload: Record<string, unknown> = {
      statut: parseInt(formData.statut, 10),
      datep: dateStringToTimestamp(formData.datep),
      fin_validite: dateStringToTimestamp(formData.fin_validite),
    };

    try {
      // 1. Mise à jour de l'en-tête
      await api.put(`/proposals/${id}`, payload);

      // 2. Si le devis est en brouillon, synchroniser les lignes
      if (formData.statut === '0') {
        // A. Suppression de toutes les lignes existantes
        // Note : On utilise l'ID conservé au chargement initial
        const currentOriginalIds = [...originalLineIds];
        for (const lineId of currentOriginalIds) {
          try {
            await api.delete(`/proposals/${id}/lines/${lineId}`);
          } catch (err) {
            console.warn(
              `Ligne ${lineId} déjà absente ou impossible à supprimer`
            );
          }
        }

        // B. Ajout de chaque ligne une par une
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

  const handleDelete = async () => {
    if (
      !window.confirm(
        'Êtes-vous sûr de vouloir supprimer définitivement ce devis ? Cette action est irréversible.'
      )
    ) {
      return;
    }
    
    setError('');
    try {
      await api.delete(`/proposals/${id}`);
      router.push('/commerce');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
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

  // Les lignes ne sont modifiables que si le devis est en brouillon
  const isDraft = formData.statut === '0';

  return (
    <div className="space-y-6">
      {/* En-tête de la page d'édition */}
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Modifier le devis {proposalRef}
          </h1>
          <p className="text-muted mt-1 text-sm">
            Modification de l'état, des dates et des lignes du devis.
          </p>
        </div>
        <div className="flex items-center space-x-6">
          
          <button
            onClick={() => router.back()}
            className="text-muted hover:text-foreground text-sm font-medium transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Formulaire */}
      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          {/* Client Associé (Lecture Seule) */}
          <div className="sm:col-span-2">
            <label
              htmlFor="clientName"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              Client / Prospect
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

          {/* Statut */}
          <div className="sm:col-span-2">
            <label
              htmlFor="statut"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              État du devis *
            </label>
            <div className="mt-2">
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
          </div>

          {/* Date de proposition */}
          <div>
            <label
              htmlFor="datep"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              Date de proposition *
            </label>
            <div className="mt-2">
              <input
                type="date"
                id="datep"
                name="datep"
                required
                value={formData.datep}
                onChange={handleChange}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Date de fin de validité */}
          <div>
            <label
              htmlFor="fin_validite"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              Date de fin de validité
            </label>
            <div className="mt-2">
              <input
                type="date"
                id="fin_validite"
                name="fin_validite"
                value={formData.fin_validite}
                onChange={handleChange}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
              />
            </div>
          </div>
        </div>

        {/* Lignes de produits / services */}
        <ProposalLines lines={lines} onChange={setLines} disabled={!isDraft} />

        {!isDraft && (
          <p className="text-muted -mt-2 text-xs">
            Les lignes ne peuvent être modifiées que sur un devis en statut{' '}
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
