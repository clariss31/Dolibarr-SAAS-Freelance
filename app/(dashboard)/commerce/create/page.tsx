'use client';

/**
 * @file app/(dashboard)/commerce/create/page.tsx
 *
 * Page de création d'une nouvelle proposition commerciale (devis).
 *
 * Ce composant gère :
 * - Le chargement de la liste des tiers (clients/prospects).
 * - La saisie des informations d'en-tête (Dolibarr exige `socid`, `datep`).
 * - L'ajout dynamique de lignes de produits/services via ProposalLines.
 * - L'envoi groupé à l'API Dolibarr (En-tête + Lignes dans le même appel).
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import ProposalLines, {
  LocalLine,
} from '../../../../components/ui/ProposalLines';

// ---------------------------------------------------------------------------
// Types et Helpers
// ---------------------------------------------------------------------------

interface ThirdPartyOption {
  id: string;
  name?: string;
  nom?: string;
}

/**
 * Convertit une chaîne YYYY-MM-DD en timestamp Unix (secondes).
 */
function dateStringToTimestamp(dateStr: string): number | null {
  if (!dateStr) return null;
  // Utiliser midi pour éviter les décalages de fuseau horaire (évite le passage au jour précédent)
  return Math.floor(new Date(dateStr + 'T12:00:00').getTime() / 1000);
}

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

export default function CreateCommercePage() {
  const router = useRouter();

  // --- Configuration initiale des dates +15j ---
  const today = new Date();
  const fifteenDaysLater = new Date(today);
  fifteenDaysLater.setDate(today.getDate() + 15);

  // --- États ---
  const [formData, setFormData] = useState({
    socid: '',
    datep: today.toISOString().split('T')[0],
    fin_validite: fifteenDaysLater.toISOString().split('T')[0],
  });

  const [lines, setLines] = useState<LocalLine[]>([]);
  const [thirdParties, setThirdParties] = useState<ThirdPartyOption[]>([]);
  const [loadingThirdParties, setLoadingThirdParties] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // --- Logique de récupération ---

  /** Charge la liste des clients pour le sélecteur */
  const fetchThirdParties = useCallback(async () => {
    try {
      const response = await api.get(
        '/thirdparties?sortfield=t.nom&sortorder=ASC&limit=500'
      );
      if (response.data && Array.isArray(response.data)) {
        setThirdParties(response.data);
      }
    } catch (err) {
      console.error('Échec de récupération des tiers', err);
    } finally {
      setLoadingThirdParties(false);
    }
  }, []);

  useEffect(() => {
    fetchThirdParties();
  }, [fetchThirdParties]);

  // --- Handlers ---

  /** Gère les changements des inputs */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /** Soumission du formulaire de création */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.socid) {
      setError('Veuillez sélectionner un client ou prospect.');
      return;
    }

    setSaving(true);
    setError('');

    // Calcul de la durée de validité en jours (différence entre les deux dates)
    const dateStart = new Date(formData.datep + 'T12:00:00');
    const dateEnd = new Date(formData.fin_validite + 'T12:00:00');
    const diffTime = dateEnd.getTime() - dateStart.getTime();
    const dureeValidite = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Construction du payload complet
    const payload = {
      socid: parseInt(formData.socid, 10),
      date: dateStringToTimestamp(formData.datep),
      datep: dateStringToTimestamp(formData.datep),
      fin_validite: dateStringToTimestamp(formData.fin_validite),
      date_fin_validite: dateStringToTimestamp(formData.fin_validite),
      duree_validite: dureeValidite, // Dolibarr utilise souvent ce champ à la création
      // Dolibarr permet d'envoyer les lignes directement lors du POST initial
      lines: lines.map((line) => ({
        fk_product: line.fk_product ? parseInt(line.fk_product, 10) : 0,
        product_type: line.product_type,
        desc: line.label,
        qty: Number(line.qty),
        subprice: Number(line.subprice),
        tva_tx: Number(line.tva_tx),
        remise_percent: Number(line.remise_percent) || 0,
      })),
    };

    try {
      const response = await api.post('/proposals', payload);
      const newProposalId = response.data as string | number;
      // Redirection vers la fiche détaillée du nouveau devis
      router.push(`/commerce/${newProposalId}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  // --- Rendu ---

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Nouveau devis
          </h1>
          <p className="text-muted mt-1 text-sm">
            Créez une nouvelle proposition commerciale.
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
          {/* Sélection du Client */}
          <div className="sm:col-span-2">
            <label
              htmlFor="socid"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Client / Prospect *
            </label>
            <select
              id="socid"
              name="socid"
              required
              disabled={loadingThirdParties}
              value={formData.socid}
              onChange={handleChange}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset disabled:opacity-50"
            >
              <option value="" disabled>
                {loadingThirdParties
                  ? 'Chargement des clients...'
                  : '-- Sélectionnez un client --'}
              </option>
              {thirdParties.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name || tier.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Configuration des dates */}
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

        {/* Lignes de produits / services */}
        <div className="pt-4">
          <ProposalLines lines={lines} onChange={setLines} />
        </div>

        {/* Action finale */}
        <div className="border-border flex items-center justify-end border-t pt-6">
          <button
            type="submit"
            disabled={saving || loadingThirdParties}
            className="btn-primary inline-flex justify-center px-6 py-2 shadow-sm disabled:opacity-50"
          >
            {saving ? 'Création...' : 'Créer le devis'}
          </button>
        </div>
      </form>
    </div>
  );
}
