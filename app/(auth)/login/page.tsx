'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../services/api';
import { auth } from '../../../utils/auth';
import { userService } from '../../../services/user';
import { getErrorMessage } from '../../../utils/error-handler';

/** URL de l'API Dolibarr, définie dans les variables d'environnement (.env.local). */
const API_URL = process.env.NEXT_PUBLIC_DOLIBARR_API_URL ?? '';

/**
 * Page d'authentification.
 *
 * Flux :
 * 1. L'utilisateur saisit son identifiant et son mot de passe Dolibarr.
 * 2. On appelle POST /login pour obtenir le jeton API (DOLAPIKEY).
 * 3. Le jeton et l'URL de l'API sont persistés via `auth.setAuth()`.
 * 4. Le login est mémorisé dans `userService` pour permettre la récupération
 *    du profil en cas d'échec de GET /users/info (repli sur GET /users/login/{login}).
 * 5. Redirection vers le tableau de bord.
 */
export default function LoginPage() {
  const router = useRouter();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /** Soumet le formulaire d'authentification. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Vérification préalable de la configuration
    if (!API_URL) {
      setError("Configuration manquante : URL de l'API non définie.");
      setLoading(false);
      return;
    }

    try {
      // Pré-enregistrement de l'URL pour que le service API puisse l'utiliser
      auth.setAuth('', API_URL);

      const response = await api.post('/login', { login, password });
      const token = response.data?.success?.token;

      if (!token) {
        setError('Identifiants incorrects.');
        return;
      }

      // Persistance du jeton et du login pour les appels API suivants
      auth.setAuth(token, API_URL);
      userService.saveLogin(login);

      router.push('/');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'login'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="bg-surface w-full max-w-md space-y-8 rounded-xl p-8 shadow-lg">
        {/* En-tête */}
        <div>
          <h1 className="text-foreground mt-6 text-center text-3xl font-bold tracking-tight">
            Connexion à DoliFree
          </h1>
          <p className="text-muted mt-2 text-center text-sm">
            Votre interface simplifiée pour Dolibarr
          </p>
        </div>

        {/* Formulaire */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Message d'erreur accessible */}
          {error && (
            <div
              className="rounded-md bg-red-50 p-4 dark:bg-red-900/30"
              role="alert"
            >
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {error}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {/* Champ identifiant */}
            <div>
              <label
                htmlFor="login"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Identifiant
              </label>
              <div className="mt-2">
                <input
                  id="login"
                  name="login"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Votre identifiant"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  aria-invalid={error ? 'true' : 'false'}
                  className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md px-3 py-1.5 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            {/* Champ mot de passe */}
            <div>
              <label
                htmlFor="password"
                className="text-foreground block text-sm leading-6 font-medium"
              >
                Mot de passe
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? 'true' : 'false'}
                  className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md px-3 py-1.5 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                />
              </div>
            </div>
          </div>

          {/* Bouton de soumission */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full justify-center px-3 py-1.5 leading-6"
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </main>
  );
}
