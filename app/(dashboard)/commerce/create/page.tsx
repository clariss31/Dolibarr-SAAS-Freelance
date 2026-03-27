'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../services/api';
import { ApiError } from '../../../../types/dolibarr';

interface ThirdPartyOption {
  id: string;
  name?: string;
  nom?: string;
}

export default function CreateCommercePage() {
  const router = useRouter();

  // Valeurs par défaut : Date du jour pour la proposition, +15 jours pour la validité
  const today = new Date();
  const fifteenDaysLater = new Date(today);
  fifteenDaysLater.setDate(today.getDate() + 15);

  const [formData, setFormData] = useState({
    socid: '',
    datep: today.toISOString().split('T')[0],
    fin_validite: fifteenDaysLater.toISOString().split('T')[0],
  });

  const [thirdParties, setThirdParties] = useState<ThirdPartyOption[]>([]);
  const [loadingThirdParties, setLoadingThirdParties] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Helper to convert YYYY-MM-DD back to timestamp (seconds)
  const dateStringToTimestamp = (dateStr: string) => {
    if (!dateStr) return null;
    return Math.floor(new Date(dateStr).getTime() / 1000);
  };

  // Charger la liste des tiers pour le sélecteur
  useEffect(() => {
    const fetchThirdParties = async () => {
      try {
        // On récupère une liste large de tiers (clients/prospects)
        const response = await api.get('/thirdparties?sortfield=t.nom&sortorder=ASC&limit=500');
        if (response.data && Array.isArray(response.data)) {
          setThirdParties(response.data);
        }
      } catch (err) {
        console.error('Erreur de chargement des tiers', err);
      } finally {
        setLoadingThirdParties(false);
      }
    };
    fetchThirdParties();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.socid) {
      setError('Veuillez sélectionner un client ou prospect.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      socid: parseInt(formData.socid, 10),
      datep: dateStringToTimestamp(formData.datep),
      fin_validite: dateStringToTimestamp(formData.fin_validite),
    };

    try {
      const response = await api.post('/proposals', payload);
      const newProposalId = response.data; // Dolibarr POST endpoints usually return the new ID directly
      // Redirection vers la fiche détail du nouveau devis
      router.push(`/commerce/${newProposalId}`);
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      setError(
        apiErr.response?.data?.error?.message ||
          'Erreur inattendue lors de la création du devis.'
      );
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
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
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Formulaire de création */}
      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          {/* Tiers / Client */}
          <div className="sm:col-span-2">
            <label
              htmlFor="socid"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              Client / Prospect *
            </label>
            <div className="mt-2">
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

        <div className="border-border flex items-center justify-end border-t pt-6">
          <button
            type="submit"
            disabled={saving || loadingThirdParties}
            className="bg-primary hover:bg-primary-hover focus-visible:outline-primary inline-flex justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            {saving ? 'Création en cours...' : 'Créer le devis'}
          </button>
        </div>
      </form>
    </div>
  );
}
