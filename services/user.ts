/**
 * Service de récupération du profil utilisateur courant.
 * Stratégie de repli :
 *   1. Tentative via GET /users/info
 *   2. Si 404, tentative via GET /users/login/{login} (login extrait du cookie de session)
 */
import { api } from './api';
import { User } from '../types/dolibarr';

/**
 * Récupère le login stocké dans le cookie de session.
 * L'API Dolibarr retourne le login dans la réponse de connexion ;
 * on le persiste lors du login pour permettre le repli.
 */
const LOGIN_KEY = 'dolibarr_login';

export const userService = {
  /** Mémorise le login après authentification */
  saveLogin(login: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOGIN_KEY, login);
    }
  },

  /** Retourne le login mémorisé ou null */
  getSavedLogin(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LOGIN_KEY);
    }
    return null;
  },

  /** Supprime le login mémorisé (lors de la déconnexion) */
  clearLogin() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOGIN_KEY);
    }
  },

  /**
   * Récupère le profil de l'utilisateur connecté.
   * Tentative A : GET /users/info
   * Tentative B : GET /users/login/{login} si le login est disponible
   */
  async getCurrentUser(): Promise<User | null> {
    // Tentative A : /users/info
    try {
      const response = await api.get('/users/info');
      if (response.data) {
        return response.data as User;
      }
    } catch {
      // Continuer vers la tentative B
    }

    // Tentative B : /users/login/{login}
    const savedLogin = this.getSavedLogin();
    if (savedLogin) {
      try {
        const response = await api.get(`/users/login/${encodeURIComponent(savedLogin)}`);
        if (response.data) {
          return response.data as User;
        }
      } catch {
        // Échec silencieux
      }
    }

    return null;
  },
};
