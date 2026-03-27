export interface ThirdParty {
  id: string;
  name: string;
  client: string | number;
  fournisseur: string | number;
  email?: string;
  phone?: string;
  url?: string;
  address?: string;
  zip?: string;
  town?: string;
  country?: string;
  tva_intra?: string;
  idprof2?: string;
  code_client?: string;
  code_fournisseur?: string;
}

export interface ApiError {
  response?: {
    status?: number;
    data?: {
      error?: {
        message?: string;
        code?: string | number;
      };
    };
  };
}

export interface Product {
  id: string;
  ref: string;
  label: string;
  price?: string | number;
  price_ttc?: string | number;
  tva_tx?: string | number;
  description?: string;
  reel_stock?: string | number;
  virtual_stock?: string | number;
  tosell: string | number; // 1 = en vente, 0 = hors vente
  tobuy: string | number;  // 1 = en achat, 0 = hors achat
  type: string | number;   // 0 = produit, 1 = service
}

export interface ProposalLine {
  id?: string;
  rowid?: string;              // Dolibarr retourne parfois cet alias
  fk_product?: string | number;
  label?: string;              // Peut être vide si ligne produit
  product_label?: string;      // Nom du produit (champ réel de l'API Dolibarr)
  description?: string;        // Description libre
  qty: number | string;        // Dolibarr retourne des strings
  subprice: number | string;   // Prix unitaire HT
  up?: number | string;        // Alias de subprice dans certaines versions
  tva_tx: number | string;     // Taux de TVA (%)
  total_ht: number | string;
  total_ttc: number | string;
}

export interface Proposal {
  id: string;
  ref: string;
  socid: string | number;
  thirdparty?: { name?: string };
  soc_name?: string;
  name?: string;
  datep?: number | string; // Date de proposition (Timestamp)
  fin_validite?: number | string; // Date de fin (Timestamp)
  total_ht: number | string;
  total_ttc?: number | string;
  statut: string | number; // 0=Brouillon, 1=Ouvert, 2=Signée, 3=Non Signée, 4=Facturée
  lines?: ProposalLine[];
}
