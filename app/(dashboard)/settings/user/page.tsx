'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../services/api';
import { userService } from '../../../../services/user';
import { getErrorMessage } from '../../../../utils/error-handler';
import { User } from '../../../../types/dolibarr';

/**
 * Page de gestion du profil de l'utilisateur connecté.
 * Lecture via la logique de repli dans userService.getCurrentUser().
 * Mise à jour via PUT /users/{id}.
 */
export default function UserProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Champs du formulaire
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [job, setJob] = useState('');
  const [phone, setPhone] = useState('');

  // Chargement du profil au montage
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await userService.getCurrentUser();
        if (data) {
          setUser(data);
          setFirstname(data.firstname ?? '');
          setLastname(data.lastname ?? '');
          setEmail(data.email ?? '');
          setJob(data.job ?? '');
          setPhone(data.phone ?? '');
        } else {
          setError('Impossible de récupérer le profil utilisateur.');
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.put(`/users/${user.id}`, {
        lastname,
        firstname,
        email,
        job,
        phone,
      });
      setSuccess('Profil mis à jour avec succès.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted text-sm">Chargement du profil...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="border-border flex items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Profil
          </h1>
          <p className="text-muted mt-1 text-sm">
            Gérez vos informations personnelles et professionnelles.
          </p>
        </div>
      </div>

      {/* Alertes */}
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
      {success && (
        <div
          className="rounded-md bg-green-50 p-4 dark:bg-green-900/30"
          role="status"
        >
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            {success}
          </p>
        </div>
      )}

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-surface border-border overflow-hidden rounded-xl border shadow-sm">
          <div className="bg-background border-border border-b px-5 py-4">
            <h2 className="text-foreground text-base leading-6 font-semibold">
              Informations personnelles
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
            {/* Identifiant (lecture seule) */}
            <div className="sm:col-span-2">
              <label className="text-muted text-xs font-medium tracking-wider uppercase">
                Identifiant de connexion
              </label>
              <p className="text-foreground mt-1 font-mono text-sm">
                {user?.login ?? '-'}
              </p>
            </div>

            {/* Prénom */}
            <div>
              <label
                htmlFor="firstname"
                className="text-foreground block text-sm font-medium"
              >
                Prénom
              </label>
              <input
                id="firstname"
                type="text"
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="Jean"
              />
            </div>

            {/* Nom de famille */}
            <div>
              <label
                htmlFor="lastname"
                className="text-foreground block text-sm font-medium"
              >
                Nom de famille
              </label>
              <input
                id="lastname"
                type="text"
                value={lastname}
                onChange={(e) => setLastname(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="Dupont"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="text-foreground block text-sm font-medium"
              >
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="jean.dupont@exemple.com"
              />
            </div>

            {/* Téléphone */}
            <div>
              <label
                htmlFor="phone"
                className="text-foreground block text-sm font-medium"
              >
                Téléphone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="06 12 34 56 78"
              />
            </div>

            {/* Poste */}
            <div className="sm:col-span-2">
              <label
                htmlFor="job"
                className="text-foreground block text-sm font-medium"
              >
                Poste / Fonction
              </label>
              <input
                id="job"
                type="text"
                value={job}
                onChange={(e) => setJob(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="Consultant IT Freelance"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-foreground ring-border hover:bg-background rounded-md px-4 py-2 text-sm font-semibold ring-1 transition-colors ring-inset"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-4 py-2 disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
