'use client';

/**
 * @file app/(dashboard)/products-services/create/page.tsx
 *
 * Page de création d'un nouveau produit ou service Dolibarr.
 *
 * Fonctionnalités :
 * - Formulaire de création unifié (Produit/Service).
 * - Détection automatique de l'assujettissement à la TVA de l'entreprise.
 * - Gestion du type via paramètre URL ou sélecteur interactif.
 * - Validation et gestion des erreurs API Dolibarr.
 * - Redirection automatique vers la fiche après création.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { Product, ApiError } from '../../../../types/dolibarr';

// ---------------------------------------------------------------------------
// Composant Wrapper (Pour Suspense avec useSearchParams)
// ---------------------------------------------------------------------------

export default function CreateProductPage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted flex h-48 animate-pulse items-center justify-center text-sm italic">
          Chargement du formulaire...
        </div>
      }
    >
      <CreateProductForm />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Composant Formulaire
// ---------------------------------------------------------------------------

function CreateProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Type par défaut via URL (ex: ?type=1 pour service)
  const initialType = searchParams.get('type') || '0';

  // --- États ---
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isTvaAssujetti, setIsTvaAssujetti] = useState(true);

  const [formData, setFormData] = useState({
    ref: '',
    label: '',
    type: initialType, // 0 = produit, 1 = service
    price: '',
    tva_tx: '',
    description: '',
    tosell: '1',
    tobuy: '1',
  });

  // --- Initialisation ---

  /** Charge la configuration TVA de l'entreprise */
  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/setup/company');
      if (res.data) {
        const liable = String(res.data.tva_assuj) === '1';
        setIsTvaAssujetti(liable);

        // Si non assujetti, on pré-remplit la TVA à 0
        if (!liable) {
          setFormData((prev) => ({ ...prev, tva_tx: '0' }));
        }
      }
    } catch (err) {
      console.warn(
        'Erreur lors de la récupération de la config entreprise:',
        err
      );
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // --- Handlers ---

  /** Gère les changements de champs du formulaire */
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked ? '1' : '0' }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  /** Soumission principale */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload: Partial<Product> = {
        ref: formData.ref,
        label: formData.label,
        type: formData.type,
        tosell: formData.tosell,
        tobuy: formData.tobuy,
        price: formData.price || '0',
        tva_tx: formData.tva_tx || '0',
        description: formData.description,
      };

      const response = await api.post(`/products`, payload);
      const newId = response.data; // Dolibarr renvoie l'ID dans la réponse POST

      router.push(`/products-services/${newId}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // --- Rendu ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Nouveau {formData.type === '1' ? 'service' : 'produit'}
          </h1>
          <p className="text-muted mt-2 text-sm">
            Créez un nouvel élément pour votre catalogue Dolibarr.
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

      {/* Formulaire Utama */}
      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm sm:p-8"
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Libellé & Type */}
          <div className="sm:col-span-2">
            <label className="text-foreground mb-3 block text-sm font-medium">
              Libellé & Type *
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="border-border flex overflow-hidden rounded-md border shadow-sm">
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, type: '0' }))}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${formData.type === '0' ? 'bg-primary text-background' : 'text-muted hover:bg-muted/10'}`}
                >
                  Produit
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, type: '1' }))}
                  className={`border-border border-l px-4 py-2 text-sm font-medium transition-colors ${formData.type === '1' ? 'bg-primary text-background' : 'text-muted hover:bg-muted/10'}`}
                >
                  Service
                </button>
              </div>
              <input
                type="text"
                name="label"
                required
                autoFocus
                value={formData.label}
                onChange={handleChange}
                placeholder="Libellé"
                className="bg-background text-foreground ring-border focus:ring-primary flex-1 rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
          </div>

          <div className="sm:col-span-1">
            <label
              htmlFor="ref"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Référence *
            </label>
            <input
              type="text"
              name="ref"
              id="ref"
              required
              placeholder="Ex: PROD-001"
              value={formData.ref}
              onChange={handleChange}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
            />
          </div>

          {/* Prix & TVA */}
          <div className="sm:col-span-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="price"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  Prix HT
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    name="price"
                    id="price"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="bg-background text-foreground ring-border block w-full rounded-md px-3 py-2 pr-7 text-sm ring-1 ring-inset"
                  />
                  <div className="text-muted pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    €
                  </div>
                </div>
              </div>
              <div>
                <label
                  htmlFor="tva_tx"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  TVA %
                </label>
                <select
                  id="tva_tx"
                  name="tva_tx"
                  value={formData.tva_tx}
                  onChange={handleChange}
                  disabled={!isTvaAssujetti}
                  className="bg-background text-foreground ring-border block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset disabled:opacity-50"
                >
                  <option value="0">0 %</option>
                  <option value="2.1">2,1 %</option>
                  <option value="5.5">5,5 %</option>
                  <option value="10">10 %</option>
                  <option value="20">20 %</option>
                </select>
              </div>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="description"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              placeholder="Description détaillée de l'élément..."
              className="bg-background text-foreground ring-border block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset"
            />
          </div>

          {/* Statuts Vente/Achat */}
          <div>
            <label
              htmlFor="tosell"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Statut Vente
            </label>
            <select
              id="tosell"
              name="tosell"
              value={formData.tosell}
              onChange={handleChange}
              className="bg-background text-foreground ring-border block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset"
            >
              <option value="1">En vente</option>
              <option value="0">Hors vente</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="tobuy"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Statut Achat
            </label>
            <select
              id="tobuy"
              name="tobuy"
              value={formData.tobuy}
              onChange={handleChange}
              className="bg-background text-foreground ring-border block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset"
            >
              <option value="1">En achat</option>
              <option value="0">Hors achat</option>
            </select>
          </div>
        </div>

        <div className="border-border flex items-center justify-end gap-4 border-t pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-muted hover:text-foreground text-sm font-medium"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary min-w-[120px] px-6 py-2 shadow-sm disabled:opacity-50"
          >
            {saving ? 'Création...' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}
