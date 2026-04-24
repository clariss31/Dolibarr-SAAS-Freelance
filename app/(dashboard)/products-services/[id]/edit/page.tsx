'use client';

/**
 * @file app/(dashboard)/products-services/[id]/edit/page.tsx
 *
 * Page d'édition d'un produit ou d'un service Dolibarr.
 *
 * Fonctionnalités :
 * - Chargement des données du produit et des entrepôts.
 * - Gestion de l'assujettissement à la TVA (config Dolibarr).
 * - Mise à jour des informations de base (réf, libellé, prix, description).
 * - Ajustement rapide du stock physique pour les produits.
 * - Suppression définitive de la fiche.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '../../../../../utils/error-handler';
import { Product, ApiError } from '../../../../../types/dolibarr';

// ---------------------------------------------------------------------------
// Helpers (Extract outside component for purity and performance)
// ---------------------------------------------------------------------------

/**
 * Décode les entités HTML (ex: &eacute; -> é).
 * Utilise un élément textarea temporaire (trick standard côté client).
 */
function decodeHtmlEntities(html: string): string {
  if (typeof document === 'undefined') return html;
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // --- États globaux ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // --- États Données Dolibarr ---
  const [productData, setProductData] = useState<Product | null>(null);
  const [isTvaAssujetti, setIsTvaAssujetti] = useState(true);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // --- État Formulaire ---
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

  // --- État Ajustement Stock ---
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [stockQty, setStockQty] = useState<number | ''>('');
  const [adjustingStock, setAdjustingStock] = useState(false);
  const [stockMessage, setStockMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // --- Logique de récupération ---

  /** Charge les données métier */
  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');

    try {
      // 1. Récupération parallèle du produit et des entrepôts
      const [prodRes, wareRes] = await Promise.all([
        api.get(`/products/${id}`),
        api.get(`/warehouses?limit=100`).catch(() => ({ data: [] })),
      ]);

      if (prodRes.data) {
        const product: Product = prodRes.data;
        setProductData(product);

        // Initialisation du formulaire
        setFormData({
          ref: product.ref || '',
          label: product.label || '',
          type: String(product.type || '0'),
          price:
            product.price && Number(product.price) !== 0
              ? String(Number(product.price).toFixed(2))
              : '',
          tva_tx: product.tva_tx
            ? String(parseFloat(product.tva_tx.toString()))
            : '',
          description: product.description
            ? decodeHtmlEntities(product.description)
            : '',
          tosell: String(product.status ?? product.tosell ?? '0'),
          tobuy: String(product.status_buy ?? product.tobuy ?? '0'),
        });
      } else {
        setError('Produit introuvable.');
      }

      // Gestion des entrepôts pour l'ajustement de stock
      if (
        wareRes.data &&
        Array.isArray(wareRes.data) &&
        wareRes.data.length > 0
      ) {
        setWarehouses(wareRes.data);
        setSelectedWarehouse(wareRes.data[0].id);
      }

      // 2. Vérification de l'assujettissement TVA (Config Entreprise)
      const companyRes = await api.get('/setup/company').catch(() => null);
      if (companyRes?.data) {
        setIsTvaAssujetti(String(companyRes.data.tva_assuj) === '1');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Handlers ---

  /** Met à jour le stock physique dynamiquement */
  const handleAdjustStock = async () => {
    if (!stockQty || stockQty === 0 || !selectedWarehouse) return;

    setAdjustingStock(true);
    setStockMessage(null);
    try {
      await api.post('/stockmovements', {
        product_id: parseInt(id),
        warehouse_id: parseInt(selectedWarehouse),
        qty: Number(stockQty),
      });

      setStockMessage({
        type: 'success',
        text: 'Stock mis à jour avec succès.',
      });
      setStockQty('');

      // Rafraîchissement silencieux des données produit
      const updated = await api.get(`/products/${id}?_t=${Date.now()}`);
      if (updated.data) setProductData(updated.data);
    } catch (err: unknown) {
      setStockMessage({
        type: 'error',
        text: getErrorMessage(err, 'stock') || 'Erreur lors de la mise à jour.',
      });
    } finally {
      setAdjustingStock(false);
    }
  };

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
      const priceHt = parseFloat(formData.price || '0');
      const tvaRate = parseFloat(formData.tva_tx || '0');

      const payload: any = {
        ref: formData.ref,
        label: formData.label,
        type: formData.type,
        status: parseInt(formData.tosell, 10),
        status_buy: parseInt(formData.tobuy, 10),
        price: priceHt,
        price_base_type: 'HT',
        tva_tx: tvaRate,
        description: formData.description,
        // Pour Dolibarr avec module multiprix activé
        multiprices: { '1': priceHt },
        multiprices_base_type: { '1': 'HT' },
        multiprices_tva_tx: { '1': tvaRate },
        multiprices_tx: { '1': tvaRate },
      };

      console.log('Submitting payload with multiprice support:', payload);

      await api.put(`/products/${id}`, payload);
      router.push(`/products-services/${id}`); // Retour au détail
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /** Suppression définitive */
  const handleDelete = async () => {
    if (
      !window.confirm(
        'Supprimer définitivement cette fiche ? Cette action est irréversible.'
      )
    )
      return;

    try {
      await api.delete(`/products/${id}`);
      router.push('/products-services');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  };

  // --- Rendu ---

  if (loading) {
    return (
      <div className="text-muted flex h-48 animate-pulse items-center justify-center text-sm italic">
        Préparation de la fiche produit...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Modifier {formData.type === '1' ? 'le service' : 'le produit'}
          </h1>
          <p className="text-muted mt-2 text-sm">
            Mise à jour des caractéristiques, du prix et du stock.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleDelete}
            className="text-sm font-medium text-red-500 transition-colors hover:text-red-700"
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
        <div className="animate-in fade-in slide-in-from-top-2 rounded-lg border border-red-900/50 bg-[#2d1414] p-4 text-sm font-medium text-[#ff6b6b] shadow-lg duration-300">
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="border-border flex w-full overflow-hidden rounded-md border shadow-sm sm:w-64 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, type: '0' }))}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${formData.type === '0' ? 'bg-primary text-background' : 'text-muted hover:bg-muted/10'}`}
                >
                  Produit
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, type: '1' }))}
                  className={`border-border flex-1 border-l px-4 py-2 text-sm font-medium transition-colors ${formData.type === '1' ? 'bg-primary text-background' : 'text-muted hover:bg-muted/10'}`}
                >
                  Service
                </button>
              </div>
              <input
                type="text"
                name="label"
                required
                value={formData.label}
                onChange={handleChange}
                placeholder="Nom de l'élément"
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
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
              value={formData.ref}
              onChange={handleChange}
              className="bg-background text-foreground ring-border block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset"
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

        <div className="border-border flex items-center justify-end border-t pt-6">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-6 py-2 shadow-sm disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>

      {/* Ajustement Stock (Uniquement pour Produits) */}
      {formData.type === '0' && productData && (
        <section className="border-border bg-surface space-y-4 rounded-xl border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-lg font-bold">
              Ajustement du stock physique
            </h2>
            <div className="text-sm">
              Physique :{' '}
              <span className="text-primary font-bold">
                {productData.stock_reel || '0'}
              </span>{' '}
              | Virtuel :{' '}
              <span className="text-muted-foreground font-bold">
                {productData.stock_theorique || '0'}
              </span>
            </div>
          </div>

          {stockMessage && (
            <div
              className={`animate-in fade-in rounded-lg p-4 text-sm font-medium shadow-sm duration-300 ${
                stockMessage.type === 'success'
                  ? 'border border-green-900/30 bg-[#142d1a] text-[#71f88e]'
                  : 'border border-red-900/50 bg-[#2d1414] text-[#ff6b6b]'
              }`}
            >
              {stockMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-foreground mb-2 block text-xs font-bold uppercase">
                Entrepôt
              </label>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="bg-background text-foreground ring-border w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset"
              >
                {warehouses.length === 0 ? (
                  <option value="">Aucun entrepôt disponible</option>
                ) : (
                  warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label || w.ref}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="text-foreground mb-2 block text-xs font-bold uppercase">
                Correction (+/-)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={stockQty}
                  onChange={(e) =>
                    setStockQty(e.target.value ? Number(e.target.value) : '')
                  }
                  placeholder="Ex: 5 ou -2"
                  className="bg-background text-foreground ring-border flex-1 rounded-md px-3 py-2 text-sm ring-1 ring-inset"
                />
                <button
                  type="button"
                  onClick={handleAdjustStock}
                  disabled={
                    adjustingStock || warehouses.length === 0 || !stockQty
                  }
                  className="bg-primary text-background rounded-md px-4 py-2 text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  {adjustingStock ? '...' : 'Ajuster'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
