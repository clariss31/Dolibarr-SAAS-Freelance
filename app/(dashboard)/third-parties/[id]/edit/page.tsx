'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../../services/api';

export default function EditThirdPartyPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    url: '',
    address: '',
    zip: '',
    town: '',
    country: '',
    tva_intra: '',
    idprof2: '',
    code_client: '',
    t_type: 'client',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTier = async () => {
      try {
        const response = await api.get(`/thirdparties/${id}`);
        if (response.data) {
          const d = response.data;
          setFormData({
            name: d.name || '',
            email: d.email || '',
            phone: d.phone || '',
            url: d.url || '',
            address: d.address || '',
            zip: d.zip || '',
            town: d.town || '',
            country: d.country || '',
            tva_intra: d.tva_intra || '',
            idprof2: d.idprof2 || '',
            code_client: d.code_client || '',
            t_type:
              d.fournisseur == 1
                ? 'fournisseur'
                : d.client == 2 || d.client == 3
                  ? 'prospect'
                  : 'client',
          });
        }
      } catch (err) {
        setError('Erreur lors de la récupération des données du tiers.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchTier();
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

    // Le serveur de Dolibarr attend des Types dissociés pour Client et Fournisseur
    const payload = {
      ...formData,
      client:
        formData.t_type === 'client'
          ? 1
          : formData.t_type === 'prospect'
            ? 2
            : 0,
      fournisseur: formData.t_type === 'fournisseur' ? 1 : 0,
    };
    delete (payload as any).t_type;

    try {
      await api.put(`/thirdparties/${id}`, payload);
      router.push(`/third-parties/${id}`);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Erreur inattendue lors de la mise à jour.'
      );
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        'Êtes-vous sûr de vouloir supprimer définitivement ce tiers ? Cette action est irréversible et supprimera le tiers de votre Dolibarr.'
      )
    ) {
      return;
    }
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/thirdparties/${id}`);
      router.push('/third-parties');
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Impossible de supprimer ce Tiers. Il est probablement lié à des factures ou propositions commerciales existantes.'
      );
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted text-center text-sm">
          Chargement de la fiche complète...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Modifier le Tiers
          </h1>
          <p className="text-muted mt-1 text-sm">
            Gestion complète de la fiche et suppression.
          </p>
        </div>
        <div className="flex items-center space-x-6">
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="text-sm font-semibold text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
          >
            {deleting ? 'Suppression...' : 'Supprimer ce tiers'}
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
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
      >
        {/* Informations de base */}
        <div className="border-border border-b pb-6">
          <h2 className="text-foreground text-base leading-7 font-semibold">
            Informations Principales
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="name"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Nom / Raison Sociale *
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="code_client"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Code Client
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="code_client"
                  name="code_client"
                  value={formData.code_client}
                  onChange={handleChange}
                  placeholder="Optionnel"
                  className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Classification / Type */}
        <div className="border-border border-b pb-6">
          <h2 className="text-foreground text-base leading-7 font-semibold">
            Classification (Type de Tiers)
          </h2>
          <div className="mt-4 max-w-md">
            <label
              htmlFor="t_type"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              Type
            </label>
            <div className="mt-2">
              <select
                id="t_type"
                name="t_type"
                value={formData.t_type}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2.5 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
              >
                <option value="client">Client</option>
                <option value="prospect">Prospect</option>
                <option value="fournisseur">Fournisseur</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="border-border border-b pb-6">
          <h2 className="text-foreground text-base leading-7 font-semibold">
            Coordonnées de Contact
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="email"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Email
              </label>
              <div className="mt-2">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="phone"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Téléphone
              </label>
              <div className="mt-2">
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="url"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Site Web (URL)
              </label>
              <div className="mt-2">
                <input
                  type="url"
                  id="url"
                  name="url"
                  value={formData.url}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Adresse */}
        <div className="border-border border-b pb-6">
          <h2 className="text-foreground text-base leading-7 font-semibold">
            Adresse Postale
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="address"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Rue / Voie
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="zip"
                  className="text-foreground block text-sm leading-6 font-medium"
                >
                  Code Postal
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    id="zip"
                    name="zip"
                    value={formData.zip}
                    onChange={handleChange}
                    className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="town"
                  className="text-foreground block text-sm leading-6 font-medium"
                >
                  Ville
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    id="town"
                    name="town"
                    value={formData.town}
                    onChange={handleChange}
                    className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="country"
                  className="text-foreground block text-sm leading-6 font-medium"
                >
                  Pays
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legal */}
        <div className="pb-2">
          <h2 className="text-foreground text-base leading-7 font-semibold">
            Identifiants Légaux
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="tva_intra"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Numéro de TVA
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="tva_intra"
                  name="tva_intra"
                  value={formData.tva_intra}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="idprof2"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                SIRET
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="idprof2"
                  name="idprof2"
                  value={formData.idprof2}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions Submit */}
        <div className="border-border flex items-center justify-end space-x-4 border-t pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving || deleting}
            className="text-muted hover:text-foreground text-sm leading-6 font-medium disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || deleting}
            className="bg-primary hover:bg-primary-hover focus-visible:outline-primary inline-flex justify-center rounded-md px-6 py-2 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            {saving
              ? 'Enregistrement en cours...'
              : 'Enregistrer toutes les modifications'}
          </button>
        </div>
      </form>
    </div>
  );
}
