/**
 * @file services/user.ts
 * 
 * Service de gestion du profil utilisateur.
 * 
 * Ce module permet de récupérer les informations détaillées de l'utilisateur
 * connecté en s'appuyant sur les jetons stockés dans les cookies (via auth.ts).
 * 
 * Stratégie de récupération du profil :
 * 1. Tentative via `GET /users/info` (méthode standard).
 * 2. Repli (Fallback) : Utilisation du login stocké pour appeler `GET /users/login/{login}`.
 */

import { auth } from '../utils/auth';
import { api } from './api';
import { User } from '../types/dolibarr';

/**
 * Service pour les opérations liées aux utilisateurs Dolibarr.
 */
export const userService = {
  /**
   * Mémorise le login (Délégué à l'utilitaire auth).
   * @param login - Identifiant utilisateur.
   */
  saveLogin(login: string): void {
    // On passe par setAuth mais en ne mettant à jour que le login si nécessaire,
    // ou plus simplement on utilise directement Cookies via auth si on veut garder la logique ici.
    // Cependant, pour la propreté, auth.setAuth gère déjà cela lors de la connexion.
    auth.setAuth(auth.getToken() || '', auth.getApiUrl() || '', login);
  },

  /** Récupère le login mémorisé. */
  getSavedLogin(): string | undefined {
    return auth.getLogin();
  },

  /** Effectue une déconnexion complète (Tokens + Login). */
  logout(): void {
    auth.logout();
  },

  /**
   * Récupère le profil complet de l'utilisateur actuellement connecté.
   * 
   * @returns Le profil de l'utilisateur (User) ou null en cas d'échec total.
   */
  async getCurrentUser(): Promise<User | null> {
    // --- Tentative A : Endpoint standard ---
    try {
      const response = await api.get('/users/info');
      if (response.data) {
        return response.data as User;
      }
    } catch {
      // Ignoré pour tenter le repli
    }

    // --- Tentative B : Endpoint de repli via login ---
    const savedLogin = auth.getLogin();
    if (savedLogin) {
      try {
        const response = await api.get(`/users/login/${encodeURIComponent(savedLogin)}`);
        if (response.data) {
          return response.data as User;
        }
      } catch {
        // Échec définitif
      }
    }

    return null;
  },
};
