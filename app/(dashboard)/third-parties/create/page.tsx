'use client';

/**
 * @file app/(dashboard)/third-parties/create/page.tsx
 *
 * Page de création d'un nouveau tiers Dolibarr.
 *
 * Fonctionnalités :
 * - Formulaire unifié pour Clients, Prospects et Fournisseurs.
 * - Prise en charge du type initial via paramètre d'URL (?type=...).
 * - Nettoyage automatique du payload pour compatibilité Dolibarr.
 * - Gestion de la génération automatique des codes tiers (-1).
 * - Validation simple et gestion des erreurs API.
 */

import { useState, Suspense, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { ApiError } from '../../../../types/dolibarr';

// ---------------------------------------------------------------------------
// Composant Wrapper (Pour Suspense avec useSearchParams)
// ---------------------------------------------------------------------------

export default function CreateThirdPartyPage() {
  return (
    <Suspense
      fallback={
        <div className="text-muted flex h-48 animate-pulse items-center justify-center text-sm italic">
          Chargement du formulaire...
        </div>
      }
    >
      <CreateThirdPartyForm />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Incrémente la partie numérique d'un code (ex: CU2404-001 -> CU2404-002)
 */
function incrementCode(code: string): string {
  return code.replace(/(\d+)(?!.*\d)/, (match) => {
    const next = parseInt(match, 10) + 1;
    return next.toString().padStart(match.length, '0');
  });
}

// ---------------------------------------------------------------------------
// Composant Formulaire
// ---------------------------------------------------------------------------

function CreateThirdPartyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Type par défaut via URL (ex: ?type=fournisseur)
  const initialType = searchParams.get('type') || 'client';

  // --- États ---
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    url: '',
    address: '',
    zip: '',
    town: '',
    country_id: '1', // France par défaut
    tva_intra: '',
    idprof2: '',
    code_client: '',
    code_fournisseur: '',
    t_type: initialType,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // --- Pays ---
  const [countries, setCountries] = useState<{id: string | number, label: string}[]>([
    { id: '1', label: 'France' } // Fallback par défaut
  ]);
  const [loadingCountries, setLoadingCountries] = useState(true);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await api.get('/setup/dictionary/countries?sortfield=label&sortorder=ASC&lang=fr_FR');
        if (Array.isArray(res.data)) {
          setCountries(res.data.filter((c: any) => String(c.active) === '1'));
        }
      } catch (err) {
        // En cas d'erreur API, on garde au moins la France
        console.warn('Erreur lors du chargement des pays', err);
      } finally {
        setLoadingCountries(false);
      }
    };
    fetchCountries();
  }, []);

  // --- Suggestions ---

  /** Suggère le prochain code libre en se basant sur le dernier existant */
  const suggestNextCode = useCallback(async (type: string) => {
    const field = type === 'fournisseur' ? 't.code_fournisseur' : 't.code_client';
    try {
      // On cherche le dernier code par ordre décroissant
      const res = await api.get(`/thirdparties?limit=1&sortfield=${field}&sortorder=DESC`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        const lastCode = type === 'fournisseur' ? res.data[0].code_fournisseur : res.data[0].code_client;
        if (lastCode && lastCode !== '-1') {
          return incrementCode(lastCode);
        }
      }
    } catch (e) {
      console.warn('Impossible de suggérer un code:', e);
    }
    return '';
  }, []);

  // Pré-remplissage au montage et changement de type
  useEffect(() => {
    const fillSuggestion = async () => {
      const suggested = await suggestNextCode(formData.t_type);
      if (suggested) {
        setFormData(prev => ({
          ...prev,
          [formData.t_type === 'fournisseur' ? 'code_fournisseur' : 'code_client']: suggested
        }));
      }
    };
    fillSuggestion();
  }, [formData.t_type, suggestNextCode]);

  // --- Handlers ---

  /** Gère les changements de champs standard */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /** Soumission principale */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // --- Calcul des statuts Dolibarr ---
    const clientStatus =
      formData.t_type === 'client' ? 1 : formData.t_type === 'prospect' ? 2 : 0;
    const fournisseurStatus = formData.t_type === 'fournisseur' ? 1 : 0;

    // --- Construction du payload ---
    const payload: Record<string, unknown> = {
      ...formData,
      client: clientStatus,
      fournisseur: fournisseurStatus,
    };

    // Suppression de la clé de gestion interne
    delete payload.t_type;

    // Nettoyage des chaînes vides pour éviter les conflits Dolibarr
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, v]) => v !== '')
    );

    // --- Logique de génération de codes ---
    // Si aucun code n'est fourni, on force '-1' pour que Dolibarr le génère
    if (clientStatus > 0 && !cleanPayload.code_client) {
      cleanPayload.code_client = '-1';
    }
    if (fournisseurStatus > 0 && !cleanPayload.code_fournisseur) {
      cleanPayload.code_fournisseur = '-1';
    }

    // --- Vérification de l'existence du code ---
    const targetCode = formData.t_type === 'fournisseur' ? formData.code_fournisseur : formData.code_client;
    if (targetCode && targetCode !== '-1') {
      try {
        const field = formData.t_type === 'fournisseur' ? 't.code_fournisseur' : 't.code_client';
        const checkRes = await api.get(`/thirdparties?sqlfilters=(${field}:=:'${targetCode}')`);
        if (Array.isArray(checkRes.data) && checkRes.data.length > 0) {
          setError("Code client ou fournisseur déjà utilisé, un nouveau code est suggéré");
          // Re-suggérer un nouveau code
          const newSuggestion = await suggestNextCode(formData.t_type);
          if (newSuggestion) {
            setFormData(prev => ({
              ...prev,
              [formData.t_type === 'fournisseur' ? 'code_fournisseur' : 'code_client']: newSuggestion
            }));
          }
          setSaving(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      } catch (e) {
        // En cas d'erreur de check, on continue
      }
    }

    try {
      const response = await api.post(`/thirdparties`, cleanPayload);
      const newId = response.data; // Dolibarr renvoie l'ID
      router.push(`/third-parties/${newId}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  // --- Rendu ---

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Nouveau tiers
          </h1>
          <p className="text-muted mt-1 text-sm">
            Ajouter une nouvelle fiche entreprise ou contact dans votre
            catalogue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-muted hover:text-foreground text-sm font-medium transition-colors"
        >
          Annuler
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Formulaire Utama */}
      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
      >
        {/* Section : Informations de base */}
        <section className="border-border border-b pb-6">
          <h2 className="text-foreground text-base font-semibold">
            Informations principales
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="name"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Nom / Raison sociale *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                autoFocus
                value={formData.name}
                onChange={handleChange}
                placeholder="Ex: Entreprise Pichinov"
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="dynamic_code"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                {formData.t_type === 'fournisseur' ? 'Code fournisseur' : 'Code client'}
              </label>
              <input
                type="text"
                id="dynamic_code"
                name={formData.t_type === 'fournisseur' ? 'code_fournisseur' : 'code_client'}
                value={formData.t_type === 'fournisseur' ? formData.code_fournisseur : formData.code_client}
                onChange={handleChange}
                placeholder="Laissé vide : généré automatiquement"
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
          </div>
        </section>

        {/* Section : Classification */}
        <section className="border-border border-b pb-6">
          <h2 className="text-foreground text-base font-semibold">
            Classification
          </h2>
          <div className="mt-4 max-w-md">
            <label
              htmlFor="t_type"
              className="text-foreground mb-2 block text-sm font-medium"
            >
              Type de tiers
            </label>
            <select
              id="t_type"
              name="t_type"
              value={formData.t_type}
              onChange={handleChange}
              className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
            >
              <option value="client">Client</option>
              <option value="prospect">Prospect</option>
              <option value="fournisseur">Fournisseur</option>
            </select>
          </div>
        </section>

        {/* Section : Contact */}
        <section className="border-border border-b pb-6">
          <h2 className="text-foreground text-base font-semibold">
            Coordonnées de contact
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="email"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Téléphone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="url"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Site web (URL)
              </label>
              <input
                type="url"
                id="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
          </div>
        </section>

        {/* Section : Adresse */}
        <section className="border-border border-b pb-6">
          <h2 className="text-foreground text-base font-semibold">
            Adresse postale
          </h2>
          <div className="mt-4 space-y-4">
            <div className="max-w-xl">
              <label
                htmlFor="address"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Rue / Voie
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="zip"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  Code Postal
                </label>
                <input
                  type="text"
                  id="zip"
                  name="zip"
                  value={formData.zip}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
                />
              </div>
              <div>
                <label
                  htmlFor="town"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  Ville
                </label>
                <input
                  type="text"
                  id="town"
                  name="town"
                  value={formData.town}
                  onChange={handleChange}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
                />
              </div>
              <div>
                <label
                  htmlFor="country_id"
                  className="text-foreground mb-2 block text-sm font-medium"
                >
                  Pays
                </label>
                <select
                  id="country_id"
                  name="country_id"
                  value={formData.country_id}
                  onChange={handleChange}
                  disabled={loadingCountries}
                  className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 disabled:opacity-50"
                >
                  {countries.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Section : Legal */}
        <section className="pb-2">
          <h2 className="text-foreground text-base font-semibold">
            Identifiants légaux
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="tva_intra"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                Numéro de TVA
              </label>
              <input
                type="text"
                id="tva_intra"
                name="tva_intra"
                value={formData.tva_intra}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
            <div>
              <label
                htmlFor="idprof2"
                className="text-foreground mb-2 block text-sm font-medium"
              >
                SIRET
              </label>
              <input
                type="text"
                id="idprof2"
                name="idprof2"
                value={formData.idprof2}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2"
              />
            </div>
          </div>
        </section>

        {/* Footer : Actions */}
        <div className="border-border flex items-center justify-end space-x-4 border-t pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="text-muted hover:text-foreground text-sm font-medium transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex justify-center px-6 py-2 shadow-sm"
          >
            {saving ? 'Création...' : 'Créer le tiers'}
          </button>
        </div>
      </form>
    </div>
  );
}
