// Définition du type tiers
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
  country_id?: string | number;
  country_code?: string;
  tva_intra?: string;
  idprof2?: string;
  code_client?: string;
  code_fournisseur?: string;
}

// Définition du type erreur API
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

// Définition du type produit
export interface Product {
  id: string;
  ref: string;
  label: string;
  price?: string | number;
  price_ttc?: string | number;
  tva_tx?: string | number;
  description?: string;
  stock_reel?: string | number;
  stock_theorique?: string | number;
  tosell: string | number; // 1 = en vente, 0 = hors vente
  tobuy: string | number; // 1 = en achat, 0 = hors achat
  status?: string | number;
  status_buy?: string | number;
  type: string | number; // 0 = produit, 1 = service
}

// Définition du type ligne de proposition
export interface ProposalLine {
  id?: string;
  rowid?: string;
  fk_product?: string | number;
  label?: string;
  product_label?: string;
  description?: string;
  qty: number | string;
  subprice: number | string;
  tva_tx: number | string;
  remise_percent?: number | string;
  total_ht: number | string;
  total_ttc: number | string;
  product_type?: number | string;
}

// Définition du type proposition
export interface Proposal {
  id: string;
  ref: string;
  socid: string | number;
  thirdparty?: { name?: string };
  soc_name?: string;
  name?: string;
  datep?: number | string;
  fin_validite?: number | string;
  total_ht: number | string;
  total_ttc?: number | string;
  statut: string | number;
  lines?: ProposalLine[];
}

// Définition du type règlement (paiement partiel ou total d'une facture)
export interface InvoicePayment {
  id: string | number;
  ref?: string;
  datepaye: number | string;
  paiementid?: string | number;      // ID du mode de paiement
  paiementcode?: string;             // Code du mode (ex: CB, CHQ, LIQ...)
  type?: string;                     // Autre champ pour le code du mode
  fk_bank?: string | number;         // ID du compte bancaire
  bank_account?: string;             // Label du compte bancaire
  amount: number | string;           // Montant réglé
  multicurrency_amount?: number | string;
  num_paiement?: string;             // Référence du paiement
  note_public?: string;
}

// Définition du type facture
export interface Invoice {
  id: string;
  ref: string;
  socid: string | number;
  thirdparty?: { name?: string };
  soc_name?: string;
  nom?: string;
  date?: number | string;
  datelimit?: number | string;
  date_lim_reglement?: number | string;
  date_echeance?: number | string;
  total_ht: number | string;
  total_tva?: number | string;
  total_ttc: number | string;
  paye: string | number;
  statut: string | number;
  fk_account?: string | number;
  /** Somme déjà réglée (identifiée sur le serveur du client) */
  totalpaid?: number | string;
  /** Somme déjà réglée (variantes Dolibarr classiques) */
  sumpayed?: number | string;
  already_payed?: number | string;
  remaintopay?: number | string;
  lines?: ProposalLine[];
}

// Définition du type utilisateur Dolibarr
export interface User {
  id: string | number;
  login: string;
  lastname?: string;
  firstname?: string;
  email?: string;
  job?: string;
  phone?: string;
  statut?: string | number;
  admin?: string | number;
}

// Définition du type configuration organisation
export interface Organization {
  name?: string;
  address?: string;
  zip?: string;
  town?: string;
  country_id?: string | number;
  email?: string;
  phone?: string;
  url?: string;
  idprof1?: string;   // SIRET
  idprof2?: string;   // SIREN
  tva_assuj?: string | number; // 1 = assujetti TVA, 0 = non
  tva_intra?: string; // Numéro TVA intracommunautaire
}
