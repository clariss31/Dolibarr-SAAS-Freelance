'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../../services/api';
import { Product, ApiError } from '../../../../../types/dolibarr';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    ref: '',
    label: '',
    type: '0', // 0 = produit, 1 = service
    price: '',
    tva_tx: '',
    description: '',
    tosell: '1',
    tobuy: '1',
  });

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await api.get(`/products/${id}`);
        if (response.data) {
          const product: Product = response.data;

          const decodeHtml = (html: string) => {
            // Prendre en compte caractères spéciaux
            const txt = document.createElement('textarea');
            txt.innerHTML = html;
            return txt.value;
          };

          setFormData({
            ref: product.ref || '',
            label: product.label || '',
            type: String(product.type || '0'),
            price: product.price ? String(product.price) : '',
            tva_tx: product.tva_tx ? String(product.tva_tx) : '',
            description: product.description
              ? decodeHtml(product.description)
              : '',
            tosell: String(product.tosell || '0'),
            tobuy: String(product.tobuy || '0'),
          });
        } else {
          setError('Produit introuvable.');
        }
      } catch (err: unknown) {
        setError('Erreur lors du chargement des informations du produit.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProduct();
  }, [id]);

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
      // Préparation du payload avec conversions si nécessaire
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

      await api.put(`/products/${id}`, payload);
      router.push(`/products-services/${id}`); // Redirection vers le détail
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      setError(
        apiErr.response?.data?.error?.message ||
          "Une erreur s'est produite lors de l'enregistrement."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Êtes-vous sûr de vouloir supprimer définitivement ce produit/service ? Cette action est irréversible et supprimera l'élément de votre Dolibarr."
      )
    ) {
      return;
    }
    
    setError('');
    try {
      await api.delete(`/products/${id}`);
      router.push('/products-services');
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      setError(
        apiErr.response?.data?.error?.message ||
          'Impossible de supprimer cet élément. Il est probablement lié à des factures ou propositions commerciales existantes.'
      );
      
    }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-muted text-sm">Chargement du formulaire...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Modifier {formData.type === '1' ? 'le service' : 'le produit'}
          </h1>
          <p className="text-muted mt-1 text-sm">
            Mettez à jour les caractéristiques, le prix et les statuts de vente.
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
                  value={formData.ref}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary placeholder:text-muted block w-full rounded-md border-0 px-3 py-1.5 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="type"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Type de l'élément <span className="text-red-500">*</span>
              </label>
              <div className="mt-2">
                <select
                  id="type"
                  name="type"
                  required
                  value={formData.type}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-1.5 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                >
                  <option value="0">Produit</option>
                  <option value="1">Service</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-6">
              <label
                htmlFor="label"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Libellé <span className="text-red-500">*</span>
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  name="label"
                  id="label"
                  required
                  value={formData.label}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary placeholder:text-muted block w-full rounded-md border-0 px-3 py-1.5 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
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
                  name="price"
                  id="price"
                  value={formData.price}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary placeholder:text-muted block w-full rounded-md border-0 py-1.5 pr-10 pl-3 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-muted sm:text-sm">€</span>
                </div>
              </div>
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="tva_tx"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Taux TVA
              </label>
              <div className="relative mt-2 rounded-md shadow-sm">
                <input
                  type="number"
                  step="0.1"
                  name="tva_tx"
                  id="tva_tx"
                  value={formData.tva_tx}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary placeholder:text-muted block w-full rounded-md border-0 py-1.5 pr-10 pl-3 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-muted sm:text-sm">%</span>
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
            {saving ? 'Enregistrement en cours...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
