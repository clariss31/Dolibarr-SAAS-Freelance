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
