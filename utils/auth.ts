/**
 * @file utils/auth.ts
 * 
 * Utilitaire de gestion de l'authentification via les cookies.
 * 
 * Ce module centralise le stockage et la suppression des informations de session :
 * - Jeton d'API (DOLAPIKEY)
 * - URL de l'instance Dolibarr
 * - Login de l'utilisateur (utilisé pour le fallback du profil)
 */

import Cookies from 'js-cookie';

const TOKEN_KEY = 'dolibarr_token';
const API_URL_KEY = 'dolibarr_api_url';
const LOGIN_KEY = 'dolibarr_login';

/** Configuration commune des cookies pour assurer sécurité et pérennité */
const COOKIE_OPTIONS: Cookies.CookieAttributes = {
  expires: 7,       // Expire après 7 jours
  secure: true,    // Uniquement via HTTPS (en prod)
  sameSite: 'lax', // Protection CSRF standard
};

export const auth = {
  /** Récupère le jeton d'authentification */
  getToken: () => Cookies.get(TOKEN_KEY),
  
  /** Récupère l'URL de l'API enregistrée */
  getApiUrl: () => Cookies.get(API_URL_KEY),
  
  /** Récupère le login enregistré */
  getLogin: () => Cookies.get(LOGIN_KEY),

  /**
   * Enregistre les informations d'authentification.
   * Appelée lors d'une connexion réussie.
   */
  setAuth: (token: string, apiUrl: string, login?: string) => {
    Cookies.set(TOKEN_KEY, token, COOKIE_OPTIONS);
    Cookies.set(API_URL_KEY, apiUrl, COOKIE_OPTIONS);
    if (login) {
      Cookies.set(LOGIN_KEY, login, COOKIE_OPTIONS);
    }
  },

  /**
   * Déconnecte l'utilisateur en supprimant tous les cookies de session.
   * Centralise le nettoyage pour éviter les états incohérents.
   */
  logout: () => {
    Cookies.remove(TOKEN_KEY);
    Cookies.remove(API_URL_KEY);
    Cookies.remove(LOGIN_KEY);
  },

  /** Alias pour compatibilité ascendante, redirige vers logout */
  clearAuth: () => {
    auth.logout();
  },

  /** Vérifie si l'utilisateur possède un jeton de session */
  isAuthenticated: () => !!Cookies.get(TOKEN_KEY),
};
