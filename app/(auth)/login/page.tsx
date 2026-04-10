'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../services/api';
import { auth } from '../../../utils/auth';
import { userService } from '../../../services/user';
import { getErrorMessage } from '../../../utils/error-handler';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const apiUrl = process.env.NEXT_PUBLIC_DOLIBARR_API_URL || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!apiUrl) {
      setError("Configuration manquante : URL de l'API non définie.");
      setLoading(false);
      return;
    }

    try {
      // S'assurer que l'URL est dans le cookie pour le service API
      auth.setAuth('', apiUrl);

      const response = await api.post('/login', { login, password });

      if (
        response.data &&
        response.data.success &&
        response.data.success.token
      ) {
        auth.setAuth(response.data.success.token, apiUrl);
        // Mémorise le login pour permettre la récupération du profil en secours
        userService.saveLogin(login);
        router.push('/');
      } else {
        setError('Identifiants incorrects.');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'login'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="bg-surface w-full max-w-md space-y-8 rounded-xl p-8 shadow-lg">
        <div>
          <h1 className="text-foreground mt-6 text-center text-3xl font-bold tracking-tight">
            Connexion à DoliFree
          </h1>
          <p className="text-muted mt-2 text-center text-sm">
            Votre interface simplifiée pour Dolibarr
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
                  className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md px-3 py-1.5 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                  placeholder="Votre identifiant"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  aria-invalid={error ? 'true' : 'false'}
                />
              </div>
            </div>

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
                  className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md px-3 py-1.5 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? 'true' : 'false'}
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex w-full justify-center px-3 py-1.5 leading-6"
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
