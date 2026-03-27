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
