'use client';

import { useState, useEffect, useId } from 'react';
import { api } from '../../services/api';
import { Product } from '../../types/dolibarr';

/**
 * Représentation locale d'une ligne de devis.
 * L'identifiant temporaire `_key` permet de gérer l'état React (pas envoyé à l'API).
 */
export interface LocalLine {
  _key: string; // Clé unique locale (uuid-like)
  id?: string; // ID Dolibarr si ligne existante
  fk_product?: string; // ID du produit sélectionné
  product_type: number; // 0=produit physique, 1=service
  label: string;
  qty: number;
  subprice: number; // Prix unitaire HT
  tva_tx: number; // Taux de TVA (%)
  remise_percent: number; // Remise en pourcentage
  total_ht: number; // Calculé : qty × subprice * (1 - remise_percent/100)
  total_ttc: number; // Calculé : total_ht × (1 + tva_tx / 100)
}

interface ProposalLinesProps {
  lines: LocalLine[];
  onChange: (lines: LocalLine[]) => void;
  disabled?: boolean; // Vrai si le devis n'est pas en brouillon
}

/** Calcule les totaux globaux d'un ensemble de lignes */
function computeTotals(lines: LocalLine[]) {
  const totalHT = lines.reduce((sum, l) => sum + l.total_ht, 0);
  const totalTVA = lines.reduce(
    (sum, l) => sum + (l.total_ttc - l.total_ht),
    0
  );
  const totalTTC = lines.reduce((sum, l) => sum + l.total_ttc, 0);
  return { totalHT, totalTVA, totalTTC };
}

/** Formate un nombre en euros avec 2 décimales */
function formatEur(value: number): string {
  return (
    value.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €'
  );
}

/** Génère une clé locale unique */
function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ProposalLines({
  lines,
  onChange,
  disabled = false,
}: ProposalLinesProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isTvaAssujetti, setIsTvaAssujetti] = useState(true);

  // Sélections de la ligne en cours d'ajout
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');

  const productSelectId = useId();
  const searchInputId = useId();
  const qtyInputId = useId();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get(
          '/products?sortfield=t.label&sortorder=ASC&limit=1000&mode=0'
        );
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

    // Vérification de l'assujettissement à la TVA
    api
      .get('/setup/company')
      .then((res) => {
        if (res.data) {
          setIsTvaAssujetti(String(res.data.tva_assuj) === '1');
        }
      })
      .catch(() => {});
  }, []);

  /** Ajoute une ligne avec le produit sélectionné */
  const handleAddLine = () => {
    if (!selectedProductId) return;
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const qty = selectedQty > 0 ? selectedQty : 1;
    const subprice = Number(product.price) || 0;
    const tva_tx = isTvaAssujetti ? Number(product.tva_tx) || 0 : 0;
    const remise_percent = 0;
    const base_ht = qty * subprice;
    const total_ht = parseFloat(
      (base_ht * (1 - remise_percent / 100)).toFixed(2)
    );
    const total_ttc = parseFloat((total_ht * (1 + tva_tx / 100)).toFixed(2));

    const newLine: LocalLine = {
      _key: newKey(),
      fk_product: product.id,
      product_type: Number(product.type) ?? 0,
      label: product.label,
      qty,
      subprice,
      tva_tx,
      remise_percent,
      total_ht,
      total_ttc,
    };

    onChange([...lines, newLine]);
    setSelectedProductId('');
    setSearchQuery('');
    setSelectedQty(1);
  };

  /** Met à jour la quantité d'une ligne existante */
  const handleQtyChange = (key: string, qty: number) => {
    handleLinePropertyChange(key, 'qty', qty > 0 ? qty : 1);
  };

  /** Helper générique pour recalculer les totaux lors d'un changement de TVA, Remise, ou QTÉ */
  const handleLinePropertyChange = (
    key: string,
    prop: keyof LocalLine,
    value: number
  ) => {
    const updated = lines.map((l) => {
      if (l._key !== key) return l;
      const updatedLine = { ...l, [prop]: value };
      const base_ht = updatedLine.qty * updatedLine.subprice;
      const total_ht = parseFloat(
        (base_ht * (1 - updatedLine.remise_percent / 100)).toFixed(2)
      );
      const total_ttc = parseFloat(
        (total_ht * (1 + updatedLine.tva_tx / 100)).toFixed(2)
      );
      return { ...updatedLine, total_ht, total_ttc };
    });
    onChange(updated);
  };

  /** Supprime une ligne */
  const handleRemoveLine = (key: string) => {
    onChange(lines.filter((l) => l._key !== key));
  };

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.label?.toLowerCase().includes(q) ||
      p.ref?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  });

  const selectedProduct = products.find((p) => p.id === selectedProductId);

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
          {/* Produit / Service (Custom Searchable Dropdown) */}
          <div className="relative flex-[3]">
            <label className="text-foreground mb-1 block text-sm font-medium">
              Produit / Service
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={loadingProducts}
                className="bg-background text-foreground ring-border focus:ring-primary flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset disabled:opacity-50"
              >
                <span className="block truncate">
                  {loadingProducts ? (
                    'Chargement...'
                  ) : selectedProduct ? (
                    <>
                      {selectedProduct.type === '1' ? '🛠️ ' : '📦 '}{' '}
                      {selectedProduct.ref} - {selectedProduct.label}
                    </>
                  ) : (
                    '-- Sélectionnez un produit/service --'
                  )}
                </span>
                <span className="pointer-events-none flex items-center">
                  <svg
                    className="text-muted h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </button>

              {isDropdownOpen && (
                <div className="bg-surface ring-border absolute z-50 mt-1 max-h-80 w-full overflow-hidden rounded-md shadow-2xl ring-1">
                  <div className="border-border bg-background sticky top-0 border-b p-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Rechercher par nom ou référence..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-surface text-foreground ring-border focus:ring-primary block w-full rounded-md border-0 px-3 py-1.5 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                    />
                  </div>
                  <ul className="max-h-60 overflow-y-auto py-1 text-sm">
                    {filteredProducts.length === 0 ? (
                      <li className="text-muted px-3 py-4 text-center italic">
                        Aucun résultat trouvé
                      </li>
                    ) : (
                      filteredProducts.map((p) => (
                        <li
                          key={p.id}
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`hover:bg-primary/10 group relative cursor-pointer px-3 py-2 select-none ${
                            selectedProductId === p.id
                              ? 'bg-primary/20 text-primary font-semibold'
                              : 'text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {p.type === '1' ? '🛠️' : '📦'}
                            </span>
                            <div className="flex flex-col">
                              <span className="block truncate font-medium">
                                {p.ref} - {p.label}
                              </span>
                              <span className="text-muted text-xs">
                                {formatEur(Number(p.price) || 0)} HT
                              </span>
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
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
                <th
                  scope="col"
                  className="text-foreground px-4 py-3 text-left font-medium"
                >
                  Désignation
                </th>
                <th
                  scope="col"
                  className="text-foreground px-4 py-3 text-right font-medium"
                >
                  P.U. HT
                </th>
                <th
                  scope="col"
                  className="text-foreground px-4 py-3 text-right font-medium"
                >
                  TVA %
                </th>
                <th
                  scope="col"
                  className="text-foreground px-4 py-3 text-right font-medium"
                >
                  Remise %
                </th>
                <th
                  scope="col"
                  className="text-foreground px-4 py-3 text-right font-medium"
                >
                  Qté
                </th>
                <th
                  scope="col"
                  className="text-foreground px-4 py-3 text-right font-medium"
                >
                  Total HT
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
                <tr
                  key={line._key}
                  className="hover:bg-surface/50 transition-colors"
                >
                  <td className="text-foreground px-4 py-3">{line.label}</td>
                  <td className="text-foreground px-4 py-3 text-right">
                    {formatEur(line.subprice)}
                  </td>
                  <td className="text-muted px-4 py-3 text-right">
                    {disabled ? (
                      <span className="text-foreground">{line.tva_tx} %</span>
                    ) : (
                      <select
                        value={line.tva_tx}
                        onChange={(e) =>
                          handleLinePropertyChange(
                            line._key,
                            'tva_tx',
                            Number(e.target.value)
                          )
                        }
                        disabled={!isTvaAssujetti}
                        title={
                          !isTvaAssujetti
                            ? "L'entreprise n'est pas assujettie à la TVA"
                            : undefined
                        }
                        className={`bg-background text-foreground ring-border focus:ring-primary w-24 rounded-md px-2 py-1 text-right text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset ${
                          !isTvaAssujetti ? 'cursor-not-allowed opacity-50' : ''
                        }`}
                      >
                        <option value="0">0 %</option>
                        <option value="2.1">2.1 %</option>
                        <option value="5.5">5.5 %</option>
                        <option value="10">10 %</option>
                        <option value="20">20 %</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {disabled ? (
                      <span className="text-foreground">
                        {line.remise_percent || 0} %
                      </span>
                    ) : (
                      <div className="flex items-center justify-end">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={line.remise_percent || 0}
                          onChange={(e) =>
                            handleLinePropertyChange(
                              line._key,
                              'remise_percent',
                              Number(e.target.value)
                            )
                          }
                          aria-label={`Remise pour ${line.label}`}
                          className="bg-background text-foreground ring-border focus:ring-primary w-24 rounded-md px-2 py-1 text-right text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                        />
                        <span className="text-muted ml-1 text-xs">%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {disabled ? (
                      <span className="text-foreground">{line.qty}</span>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={line.qty}
                        onChange={(e) =>
                          handleQtyChange(line._key, Number(e.target.value))
                        }
                        aria-label={`Quantité pour ${line.label}`}
                        className="bg-background text-foreground ring-border focus:ring-primary w-16 rounded-md px-2 py-1 text-right text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
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
