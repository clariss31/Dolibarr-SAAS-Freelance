/**
 * @file services/api.ts
 *
 * Service d'appel à l'API REST de Dolibarr.
 *
 * Ce module centralise toutes les requêtes HTTP vers Dolibarr. Il gère :
 * - La récupération de l'URL de base (depuis le localStorage ou les variables d'environnement).
 * - L'injection automatique du jeton d'authentification (`DOLAPIKEY`).
 * - L'interception globale des erreurs 401 (redirection vers /login).
 * - Le parsing automatique du JSON et la gestion des réponses sans contenu (204).
 */

import { auth } from '../utils/auth';

/**
 * Récupère l'URL de base de l'API Dolibarr.
 * Priorité au réglage utilisateur stocké (auth), sinon repli sur le .env.
 */
const getBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_DOLIBARR_API_URL ?? '';
  return auth.getApiUrl() ?? envUrl;
};

/**
 * Options étendues pour les requêtes fetch.
 */
interface RequestOptions extends RequestInit {
  /** Données à envoyer dans le corps de la requête (sera converti en JSON). */
  data?: unknown;
}

/**
 * Client API universel pour Dolibarr.
 */
export const api = {
  /**
   * Effectue une requête HTTP générique vers l'API.
   *
   * @param endpoint - Le chemin de l'API (ex: '/invoices/1').
   * @param options - Options de la requête (méthode, headers, corps).
   * @throws {Error} Relance une erreur avec la réponse attachée si le statut n'est pas "ok".
   */
  async fetch(endpoint: string, options: RequestOptions = {}) {
    const url = `${getBaseUrl()}${endpoint}`;

    const headers = new Headers({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    });

    // Injection automatique de la clé API si l'utilisateur est authentifié
    const token = auth.getToken();
    if (token) {
      headers.set('DOLAPIKEY', token);
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    // Sérialisation automatique du corps de la requête
    if (options.data !== undefined) {
      config.body = JSON.stringify(options.data);
    }

    const response = await fetch(url, config);

    // --- Intercepteur global : Session expirée ---
    if (response.status === 401) {
      auth.logout();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Non autorisé : session expirée ou jeton invalide.');
    }

    // --- Extraction des données ---
    let data = null;
    try {
      // On ne parse le JSON que s'il y a du contenu (pas 204 No Content)
      if (response.status !== 204) {
        data = await response.json();
      }
    } catch (e) {
      // Si le JSON est malformé ou absent malgré le status, on garde null
      data = null;
    }

    // --- Gestion des erreurs HTTP ---
    if (!response.ok) {
      // On crée une erreur enrichie avec les données de la réponse
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error = new Error(response.statusText || 'Erreur API') as any;
      error.response = {
        status: response.status,
        data,
      };
      throw error;
    }

    return {
      data,
      status: response.status,
      headers: response.headers,
    };
  },

  /** Requête GET */
  get(endpoint: string, options?: Omit<RequestOptions, 'method'>) {
    return this.fetch(endpoint, { ...options, method: 'GET' });
  },

  /** Requête POST */
  post(
    endpoint: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'data'>
  ) {
    return this.fetch(endpoint, { ...options, method: 'POST', data });
  },

  /** Requête PUT */
  put(
    endpoint: string,
    data?: unknown,
    options?: Omit<RequestOptions, 'method' | 'data'>
  ) {
    return this.fetch(endpoint, { ...options, method: 'PUT', data });
  },

  /** Requête DELETE */
  delete(endpoint: string, options?: Omit<RequestOptions, 'method'>) {
    return this.fetch(endpoint, { ...options, method: 'DELETE' });
  },
};
