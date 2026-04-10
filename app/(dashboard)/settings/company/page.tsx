'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { Organization } from '../../../../types/dolibarr';

/**
 * Page de configuration de la fiche entreprise (société freelance).
 * Lecture via GET /setup/organization
 * Mise à jour via PUT /setup/organization
 */
export default function CompanySettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Champs du formulaire
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [zip, setZip] = useState('');
  const [town, setTown] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [url, setUrl] = useState('');
  const [idprof1, setIdprof1] = useState(''); // SIRET
  const [idprof2, setIdprof2] = useState(''); // SIREN
  const [tvaIntra, setTvaIntra] = useState('');
  const [tvaAssuj, setTvaAssuj] = useState<'0' | '1'>('1');

  // Chargement des infos organisation
  useEffect(() => {
    const fetchOrg = async () => {
      try {
        // L'endpoint correct dans Dolibarr est /setup/company
        const response = await api.get('/setup/company');
        if (response.data) {
          const org = response.data as Organization;
          setName(org.name ?? '');
          setAddress(org.address ?? '');
          setZip(org.zip ?? '');
          setTown(org.town ?? '');
          setEmail(org.email ?? '');
          setPhone(org.phone ?? '');
          setUrl(org.url ?? '');
          setIdprof1(org.idprof1 ?? '');
          setIdprof2(org.idprof2 ?? '');
          setTvaIntra(org.tva_intra ?? '');
          setTvaAssuj(String(org.tva_assuj) === '1' ? '1' : '0');
        } else {
          setError("Impossible de récupérer les informations de l'entreprise.");
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchOrg();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.put('/setup/organization', {
        name,
        address,
        zip,
        town,
        email,
        phone,
        url,
        idprof1,
        idprof2,
        tva_intra: tvaIntra,
        tva_assuj: tvaAssuj,
      });
      setSuccess('Informations entreprise mises à jour avec succès.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted text-sm">
          Chargement des informations entreprise...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="border-border flex items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Entreprise
          </h1>
          <p className="text-muted mt-1 text-sm">
            Gérez les informations juridiques et fiscales de votre activité
            freelance.
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identité de l'entreprise */}
        <div className="bg-surface border-border overflow-hidden rounded-xl border shadow-sm">
          <div className="bg-background border-border border-b px-5 py-4">
            <h2 className="text-foreground text-base leading-6 font-semibold">
              Identité de l'entreprise
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
            {/* Raison sociale */}
            <div className="sm:col-span-2">
              <label
                htmlFor="name"
                className="text-foreground block text-sm font-medium"
              >
                Raison sociale / Nom commercial
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="Jean Dupont Consulting"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="company-email"
                className="text-foreground block text-sm font-medium"
              >
                E-mail de contact
              </label>
              <input
                id="company-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="contact@exemple.com"
              />
            </div>

            {/* Téléphone */}
            <div>
              <label
                htmlFor="company-phone"
                className="text-foreground block text-sm font-medium"
              >
                Téléphone
              </label>
              <input
                id="company-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="01 23 45 67 89"
              />
            </div>

            {/* Site web */}
            <div className="sm:col-span-2">
              <label
                htmlFor="company-url"
                className="text-foreground block text-sm font-medium"
              >
                Site web
              </label>
              <input
                id="company-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="https://www.exemple.com"
              />
            </div>
          </div>
        </div>

        {/* Adresse du siège */}
        <div className="bg-surface border-border overflow-hidden rounded-xl border shadow-sm">
          <div className="bg-background border-border border-b px-5 py-4">
            <h2 className="text-foreground text-base leading-6 font-semibold">
              Adresse du siège social
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3">
            {/* Adresse */}
            <div className="sm:col-span-3">
              <label
                htmlFor="address"
                className="text-foreground block text-sm font-medium"
              >
                Adresse
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="12 rue de la Paix"
              />
            </div>

            {/* Code postal */}
            <div>
              <label
                htmlFor="zip"
                className="text-foreground block text-sm font-medium"
              >
                Code postal
              </label>
              <input
                id="zip"
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="75001"
              />
            </div>

            {/* Ville */}
            <div className="sm:col-span-2">
              <label
                htmlFor="town"
                className="text-foreground block text-sm font-medium"
              >
                Ville
              </label>
              <input
                id="town"
                type="text"
                value={town}
                onChange={(e) => setTown(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="Paris"
              />
            </div>
          </div>
        </div>

        {/* Informations légales et fiscales */}
        <div className="bg-surface border-border overflow-hidden rounded-xl border shadow-sm">
          <div className="bg-background border-border border-b px-5 py-4">
            <h2 className="text-foreground text-base leading-6 font-semibold">
              Informations légales &amp; fiscales
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
            {/* SIRET */}
            <div>
              <label
                htmlFor="idprof1"
                className="text-foreground block text-sm font-medium"
              >
                SIRET{' '}
                <span className="text-muted font-normal">
                  (obligatoire en France)
                </span>
              </label>
              <input
                id="idprof1"
                type="text"
                value={idprof1}
                onChange={(e) => setIdprof1(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 font-mono text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="123 456 789 00012"
                maxLength={17}
              />
            </div>

            {/* SIREN */}
            <div>
              <label
                htmlFor="idprof2"
                className="text-foreground block text-sm font-medium"
              >
                SIREN
              </label>
              <input
                id="idprof2"
                type="text"
                value={idprof2}
                onChange={(e) => setIdprof2(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 font-mono text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="123 456 789"
                maxLength={11}
              />
            </div>

            {/* Assujetti à la TVA */}
            <div>
              <label
                htmlFor="tva-assuj"
                className="text-foreground block text-sm font-medium"
              >
                Assujettissement à la TVA
              </label>
              <select
                id="tva-assuj"
                value={tvaAssuj}
                onChange={(e) => setTvaAssuj(e.target.value as '0' | '1')}
                className="bg-background text-foreground ring-border focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
              >
                <option value="1">Oui</option>
                <option value="0">Non</option>
              </select>
            </div>

            {/* Numéro TVA intracommunautaire */}
            <div>
              <label
                htmlFor="tva-intra"
                className="text-foreground block text-sm font-medium"
              >
                N° TVA intracommunautaire
              </label>
              <input
                id="tva-intra"
                type="text"
                value={tvaIntra}
                onChange={(e) => setTvaIntra(e.target.value)}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary mt-1 block w-full rounded-md px-3 py-2 font-mono text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
                placeholder="FR 00 123456789"
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
