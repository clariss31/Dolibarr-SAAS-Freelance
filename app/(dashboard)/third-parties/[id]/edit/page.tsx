'use client';

/**
 * @file app/(dashboard)/third-parties/[id]/edit/page.tsx
 *
 * Page de modification d'un tiers (Client, Prospect, Fournisseur) Dolibarr.
 *
 * Fonctionnalités :
 * - Chargement et pré-remplissage des données actuelles.
 * - Gestion granulaire de la classification (Conversion entre type client/fournisseur/prospect).
 * - Mise à jour des coordonnées (Email, Tél, Site, Adresse).
 * - Gestion des identifiants légaux (SIRET, TVA).
 * - Possibilité de suppression définitive du tiers.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '../../../../../utils/error-handler';
import { ApiError } from '../../../../../types/dolibarr';

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

export default function EditThirdPartyPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // --- États ---
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    url: '',
    address: '',
    zip: '',
    town: '',
    country_id: '',
    tva_intra: '',
    idprof2: '',
    code_client: '',
    code_fournisseur: '',
    t_type: 'client', // Valeur logique interne : client, prospect, fournisseur
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // --- Initialisation ---

  /** Récupère les données existantes du tiers */
  const fetchTier = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/thirdparties/${id}`);
      if (response.data) {
        const d = response.data;

        // Déduction du type simplifié pour le formulaire
        let deducedType = 'client';
        if (String(d.fournisseur) === '1') {
          deducedType = 'fournisseur';
        } else if (String(d.client) === '2' || String(d.client) === '3') {
          deducedType = 'prospect';
        }

        setFormData({
          name: d.name || '',
          email: d.email || '',
          phone: d.phone || '',
          url: d.url || '',
          address: d.address || '',
          zip: d.zip || '',
          town: d.town || '',
          country_id: d.country_id || '1',
          tva_intra: d.tva_intra || '',
          idprof2: d.idprof2 || '',
          code_client: d.code_client || '',
          code_fournisseur: d.code_fournisseur || '',
          t_type: deducedType,
        });
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTier();
  }, [fetchTier]);

  // --- Pays ---
  const [countries, setCountries] = useState<{id: string | number, label: string}[]>([
    { id: '1', label: 'France' }
  ]);
  const [loadingCountries, setLoadingCountries] = useState(true);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await api.get('/setup/dictionary/countries?sortfield=label&sortorder=ASC&lang=fr_FR');
        if (Array.isArray(res.data)) {
          setCountries(res.data.filter((c: any) => String(c.active) === '1'));
        }
      } catch (err) {
        console.warn('Erreur lors du chargement des pays', err);
      } finally {
        setLoadingCountries(false);
      }
    };
    fetchCountries();
  }, []);

  // --- Handlers ---

  /** Gère les changements de champs standard */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /** Soumission de la mise à jour */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Mapping du type simplifié vers le schéma Dolibarr (client vs fournisseur)
    const payload: Record<string, unknown> = {
      ...formData,
      client:
        formData.t_type === 'client'
          ? 1
          : formData.t_type === 'prospect'
            ? 2
            : 0,
      fournisseur: formData.t_type === 'fournisseur' ? 1 : 0,
    };

    // On retire la clé temporaire du payload
    delete payload.t_type;

    try {
      await api.put(`/thirdparties/${id}`, payload);
      router.push(`/third-parties/${id}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  /** Suppression définitive */
  const handleDelete = async () => {
    const message =
      'Êtes-vous sûr de vouloir supprimer définitivement ce tiers ? Cette action supprimera également ses données associées dans Dolibarr.';
    if (!window.confirm(message)) return;

    setSaving(true);
    setError('');
    try {
      await api.delete(`/thirdparties/${id}`);
      router.push('/third-parties');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  // --- Rendu ---

  if (loading) {
    return (
      <div className="text-muted flex items-center justify-center py-20 text-sm italic">
        Chargement de la fiche complète...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Modifier le tiers
          </h1>
          <p className="text-muted mt-1 text-sm">
            Gestion complète de la fiche et suppression.
          </p>
        </div>
        <div className="flex items-center space-x-6">
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="text-sm font-medium text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
          >
            Supprimer
          </button>
          <button
            onClick={() => router.back()}
            type="button"
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
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
      >
        {/* Section : Informations de base */}
        <section className="border-border border-b pb-6">
          <h2 className="text-foreground text-base font-semibold">
            Informations principales
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="name"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Nom / Raison sociale *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="dynamic_code"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                {formData.t_type === 'fournisseur' ? 'Code fournisseur' : 'Code client'}
              </label>
              <input
                type="text"
                id="dynamic_code"
                name={formData.t_type === 'fournisseur' ? 'code_fournisseur' : 'code_client'}
                value={formData.t_type === 'fournisseur' ? formData.code_fournisseur : formData.code_client}
                onChange={handleChange}
                placeholder={formData.t_type === 'fournisseur' ? "Ex: SU-001" : "Ex: CUST-001"}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
          </div>
        </section>

        {/* Section : Classification */}
        <section className="border-border border-b pb-6">
          <h2 className="text-foreground text-base font-semibold">
            Classification
          </h2>
          <div className="mt-4 max-w-md">
            <label
              htmlFor="t_type"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Type de tiers
            </label>
            <select
              id="t_type"
              name="t_type"
              value={formData.t_type}
              onChange={handleChange}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
            >
              <option value="client">Client</option>
              <option value="prospect">Prospect</option>
              <option value="fournisseur">Fournisseur</option>
            </select>
          </div>
        </section>

        {/* Section : Contact */}
        <section className="border-border border-b pb-6">
          <h2 className="text-foreground text-base font-semibold">
            Coordonnées de contact
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="email"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Téléphone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="url"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Site web (URL)
              </label>
              <input
                type="url"
                id="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
          </div>
        </section>

        {/* Section : Adresse */}
        <section className="border-border border-b pb-6">
          <h2 className="text-foreground text-base font-semibold">
            Adresse Postale
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="address"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Rue / Voie
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="zip"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  Code Postal
                </label>
                <input
                  type="text"
                  id="zip"
                  name="zip"
                  value={formData.zip}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
                />
              </div>
              <div>
                <label
                  htmlFor="town"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  Ville
                </label>
                <input
                  type="text"
                  id="town"
                  name="town"
                  value={formData.town}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
                />
              </div>
              <div>
                <label
                  htmlFor="country_id"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  Pays
                </label>
                <select
                  id="country_id"
                  name="country_id"
                  value={formData.country_id}
                  onChange={handleChange}
                  disabled={loadingCountries}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 disabled:opacity-50"
                >
                  {countries.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Section : Legal */}
        <section className="pb-2">
          <h2 className="text-foreground text-base font-semibold">
            Identifiants Légaux
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="tva_intra"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Numéro de TVA
              </label>
              <input
                type="text"
                id="tva_intra"
                name="tva_intra"
                value={formData.tva_intra}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="idprof2"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                SIRET
              </label>
              <input
                type="text"
                id="idprof2"
                name="idprof2"
                value={formData.idprof2}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
          </div>
        </section>

        {/* Footer : Actions Submit */}
        <div className="border-border flex items-center justify-end space-x-4 border-t pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="text-muted hover:text-foreground text-sm font-medium transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex justify-center px-6 py-2 shadow-sm"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
