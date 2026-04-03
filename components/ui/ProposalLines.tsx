'use client';

import { useState, useEffect, useId } from 'react';
import { api } from '../../services/api';
import { Product } from '../../types/dolibarr';

/**
 * Représentation locale d'une ligne de devis.
 * L'identifiant temporaire `_key` permet de gérer l'état React (pas envoyé à l'API).
 */
export interface LocalLine {
  _key: string;         // Clé unique locale (uuid-like)
  id?: string;          // ID Dolibarr si ligne existante
  fk_product?: string;  // ID du produit sélectionné
  product_type: number; // 0=produit physique, 1=service
  label: string;
  qty: number;
  subprice: number;     // Prix unitaire HT
  tva_tx: number;       // Taux de TVA (%)
  total_ht: number;     // Calculé : qty × subprice
  total_ttc: number;    // Calculé : total_ht × (1 + tva_tx / 100)
}

interface ProposalLinesProps {
  lines: LocalLine[];
  onChange: (lines: LocalLine[]) => void;
  disabled?: boolean; // Vrai si le devis n'est pas en brouillon
}

/** Calcule les totaux globaux d'un ensemble de lignes */
function computeTotals(lines: LocalLine[]) {
  const totalHT = lines.reduce((sum, l) => sum + l.total_ht, 0);
  const totalTVA = lines.reduce((sum, l) => sum + (l.total_ttc - l.total_ht), 0);
  const totalTTC = lines.reduce((sum, l) => sum + l.total_ttc, 0);
  return { totalHT, totalTVA, totalTTC };
}

/** Formate un nombre en euros avec 2 décimales */
function formatEur(value: number): string {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/** Génère une clé locale unique */
function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ProposalLines({ lines, onChange, disabled = false }: ProposalLinesProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Sélections de la ligne en cours d'ajout
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState<number>(1);

  const productSelectId = useId();
  const qtyInputId = useId();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get('/products?sortfield=t.label&sortorder=ASC&limit=500&mode=1');
        if (response.data && Array.isArray(response.data)) {
          setProducts(response.data as Product[]);
        }
      } catch (err) {
        console.error('Erreur de chargement des produits', err);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  /** Ajoute une ligne avec le produit sélectionné */
  const handleAddLine = () => {
    if (!selectedProductId) return;
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const qty = selectedQty > 0 ? selectedQty : 1;
    const subprice = Number(product.price) || 0;
    const tva_tx = Number(product.tva_tx) || 0;
    const total_ht = parseFloat((qty * subprice).toFixed(2));
    const total_ttc = parseFloat((total_ht * (1 + tva_tx / 100)).toFixed(2));

    const newLine: LocalLine = {
      _key: newKey(),
      fk_product: product.id,
      product_type: Number(product.type) ?? 0,
      label: product.label,
      qty,
      subprice,
      tva_tx,
      total_ht,
      total_ttc,
    };

    onChange([...lines, newLine]);
    setSelectedProductId('');
    setSelectedQty(1);
  };

  /** Met à jour la quantité d'une ligne existante */
  const handleQtyChange = (key: string, qty: number) => {
    const updated = lines.map((l) => {
      if (l._key !== key) return l;
      const newQty = qty > 0 ? qty : 1;
      const total_ht = parseFloat((newQty * l.subprice).toFixed(2));
      const total_ttc = parseFloat((total_ht * (1 + l.tva_tx / 100)).toFixed(2));
      return { ...l, qty: newQty, total_ht, total_ttc };
    });
    onChange(updated);
  };

  /** Supprime une ligne */
  const handleRemoveLine = (key: string) => {
    onChange(lines.filter((l) => l._key !== key));
  };

  const { totalHT, totalTVA, totalTTC } = computeTotals(lines);

  return (
    <section aria-labelledby="lines-heading" className="space-y-4">
      <h2
        id="lines-heading"
        className="text-foreground border-border border-b pb-2 text-base font-semibold"
      >
        Lignes de devis
      </h2>

      {/* Sélecteur d'ajout de ligne */}
      {!disabled && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {/* Produit / Service */}
          <div className="flex-1">
            <label
              htmlFor={productSelectId}
              className="text-foreground mb-1 block text-sm font-medium"
            >
              Produit / Service
            </label>
            <select
              id={productSelectId}
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              disabled={loadingProducts}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset disabled:opacity-50"
            >
              <option value="">
                {loadingProducts ? 'Chargement...' : '-- Sélectionnez un produit --'}
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {formatEur(Number(p.price) || 0)} HT
                </option>
              ))}
            </select>
          </div>

          {/* Quantité */}
          <div className="w-28">
            <label
              htmlFor={qtyInputId}
              className="text-foreground mb-1 block text-sm font-medium"
            >
              Quantité
            </label>
            <input
              type="number"
              id={qtyInputId}
              min={1}
              step={1}
              value={selectedQty}
              onChange={(e) => setSelectedQty(Number(e.target.value))}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
            />
          </div>

          {/* Bouton Ajouter */}
          <button
            type="button"
            onClick={handleAddLine}
            disabled={!selectedProductId}
            className="btn-primary inline-flex h-[38px] items-center justify-center px-4"
          >
            Ajouter la ligne
          </button>
        </div>
      )}

      {/* Tableau des lignes */}
      {lines.length > 0 ? (
        <div className="overflow-x-auto rounded-lg">
          <table className="ring-border w-full text-sm ring-1">
            <thead className="bg-surface">
              <tr>
                <th scope="col" className="text-foreground px-4 py-3 text-left font-medium">
                  Désignation
                </th>
                <th scope="col" className="text-foreground px-4 py-3 text-right font-medium">
                  Prix unit. HT
                </th>
                <th scope="col" className="text-foreground px-4 py-3 text-right font-medium">
                  TVA %
                </th>
                <th scope="col" className="text-foreground px-4 py-3 text-right font-medium">
                  Qté
                </th>
                <th scope="col" className="text-foreground px-4 py-3 text-right font-medium">
                  Sous-total HT
                </th>
                {!disabled && (
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Supprimer</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {lines.map((line) => (
                <tr key={line._key} className="hover:bg-surface/50 transition-colors">
                  <td className="text-foreground px-4 py-3">{line.label}</td>
                  <td className="text-foreground px-4 py-3 text-right">
                    {formatEur(line.subprice)}
                  </td>
                  <td className="text-muted px-4 py-3 text-right">{line.tva_tx} %</td>
                  <td className="px-4 py-3 text-right">
                    {disabled ? (
                      <span className="text-foreground">{line.qty}</span>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={line.qty}
                        onChange={(e) => handleQtyChange(line._key, Number(e.target.value))}
                        aria-label={`Quantité pour ${line.label}`}
                        className="bg-background text-foreground ring-border focus:ring-primary w-20 rounded-md px-2 py-1 text-right text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                      />
                    )}
                  </td>
                  <td className="text-foreground px-4 py-3 text-right font-medium">
                    {formatEur(line.total_ht)}
                  </td>
                  {!disabled && (
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line._key)}
                        aria-label={`Supprimer la ligne ${line.label}`}
                        className="text-red-500 transition-colors hover:text-red-700"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted rounded-lg border border-dashed py-8 text-center text-sm">
          {disabled
            ? 'Aucune ligne sur ce devis.'
            : 'Ajoutez des produits ou services pour les voir apparaître ici.'}
        </p>
      )}

      {/* Récapitulatif des totaux — toujours en lecture seule */}
      {lines.length > 0 && (
        <dl
          className="bg-surface ring-border divide-border divide-y rounded-lg ring-1"
          aria-label="Récapitulatif des totaux"
        >
          <div className="flex justify-between px-4 py-3 text-sm">
            <dt className="text-muted">Total HT</dt>
            <dd className="text-foreground font-medium" aria-live="polite">
              {formatEur(totalHT)}
            </dd>
          </div>
          <div className="flex justify-between px-4 py-3 text-sm">
            <dt className="text-muted">TVA</dt>
            <dd className="text-foreground font-medium" aria-live="polite">
              {formatEur(totalTVA)}
            </dd>
          </div>
          <div className="flex justify-between px-4 py-3 text-sm font-semibold">
            <dt className="text-foreground">Total TTC</dt>
            <dd className="text-foreground" aria-live="polite">
              {formatEur(totalTTC)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
