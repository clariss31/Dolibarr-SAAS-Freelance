/**
 * @file services/user.ts
 * 
 * Service de gestion du profil utilisateur et de son identité.
 * 
 * Ce module gère la persistance du login utilisateur via des cookies pour faciliter 
 * la récupération de son profil complet via l'API Dolibarr.
 * 
 * Stratégie de récupération du profil :
 * 1. Tentative via `GET /users/info` (méthode standard recommandée).
 * 2. Repli (Fallback) : Si `/users/info` échoue (souvent dû à des restrictions 
 *    de permissions sur certaines versions), le service utilise le login 
 *    mémorisé dans les cookies pour appeler `GET /users/login/{login}`.
 */

import Cookies from 'js-cookie';
import { api } from './api';
import { User } from '../types/dolibarr';

/** Clé utilisée pour stocker le login dans les cookies. */
const LOGIN_COOKIE_KEY = 'dolibarr_login';

/**
 * Service pour les opérations liées aux utilisateurs Dolibarr.
 */
export const userService = {
  /**
   * Mémorise le login de l'utilisateur dans un cookie après une authentification réussie.
   * Utilisé pour le mécanisme de repli lors de la récupération du profil.
   * 
   * @param login - Identifiant de l'utilisateur (login Dolibarr).
   */
  saveLogin(login: string): void {
    Cookies.set(LOGIN_COOKIE_KEY, login, {
      expires: 7,
      secure: true,
      sameSite: 'lax',
    });
  },

  /**
   * Récupère le login mémorisé depuis les cookies.
   * 
   * @returns Le login ou undefined s'il n'est pas trouvé.
   */
  getSavedLogin(): string | undefined {
    return Cookies.get(LOGIN_COOKIE_KEY);
  },

  /**
   * Supprime le login mémorisé. 
   * Doit être appelé lors de la déconnexion de l'utilisateur.
   */
  clearLogin(): void {
    Cookies.remove(LOGIN_COOKIE_KEY);
  },

  /**
   * Récupère le profil complet de l'utilisateur actuellement connecté.
   * 
   * Met en œuvre une double tentative (standard puis repli par login)
   * pour maximiser les chances de succès selon les réglages de l'instance Dolibarr.
   * 
   * @returns Le profil de l'utilisateur (User) ou null en cas d'échec total.
   */
  async getCurrentUser(): Promise<User | null> {
    // --- Tentative A : Endpoint standard /users/info ---
    try {
      const response = await api.get('/users/info');
      if (response.data) {
        return response.data as User;
      }
    } catch (error) {
      // Échec silencieux, on tente la méthode de repli
    }

    // --- Tentative B : Endpoint de repli via le login sauvegardé ---
    const savedLogin = this.getSavedLogin();
    if (savedLogin) {
      try {
        const response = await api.get(`/users/login/${encodeURIComponent(savedLogin)}`);
        if (response.data) {
          return response.data as User;
        }
      } catch (error) {
        // Échec définitif
      }
    }

    return null;
  },
};
