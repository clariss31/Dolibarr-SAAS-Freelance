'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { Product, ApiError } from '../../../../types/dolibarr';

export default function CreateProductPage() {
  return (
    <Suspense fallback={<p>Chargement...</p>}>
      <CreateProductForm />
    </Suspense>
  );
}

function CreateProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') || '0';

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Indique si l'entreprise est assujettie à la TVA (lu depuis /setup/company)
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

  useEffect(() => {
    // Vérification de l'assujettissement à la TVA de l'entreprise
    api
      .get('/setup/company')
      .then((res) => {
        if (res.data) {
          const liable = String(res.data.tva_assuj) === '1';
          setIsTvaAssujetti(liable);
          // Si non assujetti, on force la TVA à 0 par défaut
          if (!liable) {
            setFormData((prev) => ({ ...prev, tva_tx: '0' }));
          }
        }
      })
      .catch(() => {
        // En cas d'erreur, on garde la valeur par défaut (assujetti)
      });
  }, []);

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
      };

      if (formData.price) payload.price = formData.price;
      if (formData.tva_tx) payload.tva_tx = formData.tva_tx;
      if (formData.description) payload.description = formData.description;

      const response = await api.post(`/products`, payload);
      const newId = response.data; // Dolibarr API POST returns the ID of the created resource
      router.push(`/products-services/${newId}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Nouveau produit / service
          </h1>
          <p className="text-muted mt-2 text-sm">
            Créez un nouvel élément pour votre catalogue.
          </p>
        </div>
        <div className="flex items-center space-x-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-muted hover:text-foreground text-sm font-medium transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 ring-1 ring-red-600/20 ring-inset">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface rounded-xl border shadow-sm"
      >
        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
            {/* Type & Libellé - Groupés sur la même ligne */}
            <div className="sm:col-span-6">
              <span className="text-foreground block text-sm leading-6 font-medium">
                Type & libellé <span className="text-red-500">*</span>
              </span>
              <div className="mt-2 flex gap-3">
                {/* Sélecteur Produit / Service */}
                <fieldset aria-label="Type d'élément">
                  <div className="border-border flex h-full overflow-hidden rounded-md border shadow-sm">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, type: '0' }))
                      }
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        formData.type === '0'
                          ? 'bg-primary text-background'
                          : 'text-muted hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      Produit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, type: '1' }))
                      }
                      className={`border-border border-l px-4 py-2 text-sm font-medium transition-colors ${
                        formData.type === '1'
                          ? 'bg-primary text-background'
                          : 'text-muted hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      Service
                    </button>
                  </div>
                </fieldset>

                {/* Input Libellé */}
                <div className="flex-1">
                  <label htmlFor="label" className="sr-only">
                    Libellé
                  </label>
                  <input
                    type="text"
                    name="label"
                    id="label"
                    required
                    placeholder="Libellé de l'élément"
                    value={formData.label}
                    onChange={handleChange}
                    className="bg-background text-foreground ring-border focus:ring-primary placeholder:text-muted block w-full rounded-md border-0 px-3 py-2 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="ref"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Référence <span className="text-red-500">*</span>
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  name="ref"
                  id="ref"
                  required
                  placeholder="REF123"
                  value={formData.ref}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary placeholder:text-muted block w-full rounded-md border-0 px-3 py-1.5 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            {/* Ligne Prix HT + TVA côte à côte */}
            <div className="sm:col-span-3">
              <div className="flex items-end gap-2">
                {/* Champ Prix HT */}
                <div className="flex-1">
                  <label
                    htmlFor="price"
                    className="text-foreground block text-sm leading-6 font-medium"
                  >
                    Prix HT
                  </label>
                  <div className="relative mt-2 rounded-md shadow-sm">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="price"
                      id="price"
                      value={formData.price}
                      onChange={(e) => {
                        // Limite à 2 décimales
                        const val = e.target.value;
                        const rounded = val.includes('.')
                          ? val.slice(0, val.indexOf('.') + 3)
                          : val;
                        setFormData((prev) => ({ ...prev, price: rounded }));
                      }}
                      placeholder="0.00"
                      className="bg-background text-foreground ring-border focus:ring-primary placeholder:text-muted block w-full rounded-md border-0 py-1.5 pr-7 pl-3 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <span className="text-muted sm:text-sm">€</span>
                    </div>
                  </div>
                </div>

                {/* Sélection du taux de TVA */}
                <div>
                  <label
                    htmlFor="tva_tx"
                    className="text-foreground block text-sm leading-6 font-medium"
                  >
                    TVA
                  </label>
                  <div className="mt-2">
                    <select
                      id="tva_tx"
                      name="tva_tx"
                      value={formData.tva_tx}
                      onChange={handleChange}
                      disabled={!isTvaAssujetti}
                      title={
                        !isTvaAssujetti
                          ? "Vous n'êtes pas assujetti à la TVA"
                          : undefined
                      }
                      className={`bg-background text-foreground ring-border focus:ring-primary block rounded-md border-0 px-2 py-1.5 text-sm shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset ${
                        !isTvaAssujetti ? 'cursor-not-allowed opacity-50' : ''
                      }`}
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
            </div>

            <div className="sm:col-span-6">
              <label
                htmlFor="description"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Description longue
              </label>
              <div className="mt-2">
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary placeholder:text-muted block w-full rounded-md border-0 px-3 py-1.5 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="border-border border-t pt-6 sm:col-span-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="tosell"
                    className="text-foreground block text-sm leading-6 font-medium"
                  >
                    État (Vente)
                  </label>
                  <div className="mt-2">
                    <select
                      id="tosell"
                      name="tosell"
                      value={formData.tosell}
                      onChange={handleChange}
                      className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-1.5 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                    >
                      <option value="1">En vente</option>
                      <option value="0">Hors vente</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="tobuy"
                    className="text-foreground block text-sm leading-6 font-medium"
                  >
                    État (Achat)
                  </label>
                  <div className="mt-2">
                    <select
                      id="tobuy"
                      name="tobuy"
                      value={formData.tobuy}
                      onChange={handleChange}
                      className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-1.5 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                    >
                      <option value="1">En achat</option>
                      <option value="0">Hors achat</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Submit */}
        <div className="border-border flex items-center justify-end space-x-4 border-t px-6 pt-4 pb-6">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="text-muted hover:text-foreground text-sm leading-6 font-medium disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex justify-center px-6 py-2"
          >
            {saving ? 'Création en cours...' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}
