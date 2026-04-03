"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../services/api';
import { auth } from '../../../utils/auth';
import { ApiError } from '../../../types/dolibarr';

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
      
      if (response.data && response.data.success && response.data.success.token) {
        auth.setAuth(response.data.success.token, apiUrl);
        router.push('/');
      } else {
        setError('Identifiants incorrects.');
      }
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      if (apiErr.response?.status === 404) {
        setError("L'URL de l'API semble incorrecte (404).");
      } else {
        setError(
          apiErr.response?.data?.error?.message ||
          "Erreur de connexion. Vérifiez vos identifiants ou l'URL de l'API."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-surface p-8 shadow-lg">
        <div>
          <h1 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
            Connexion à DoliFree
          </h1>
          <p className="mt-2 text-center text-sm text-muted">
            Votre interface simplifiée pour Dolibarr
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4" role="alert">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label 
                htmlFor="login" 
                className="block text-sm font-medium leading-6 text-foreground"
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
                  className="block w-full rounded-md bg-background py-1.5 px-3 text-foreground ring-1 ring-inset ring-border placeholder:text-muted focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
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
                className="block text-sm font-medium leading-6 text-foreground"
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
                  className="block w-full rounded-md bg-background py-1.5 px-3 text-foreground ring-1 ring-inset ring-border placeholder:text-muted focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
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
