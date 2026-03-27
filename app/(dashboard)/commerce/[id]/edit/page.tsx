'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../../services/api';
import { Proposal, ApiError } from '../../../../../types/dolibarr';

export default function EditCommercePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [formData, setFormData] = useState({
    statut: '0',
    datep: '',
    fin_validite: '',
    total_ht: '',
  });

  const [proposalRef, setProposalRef] = useState('');
  const [clientName, setClientName] = useState('Chargement...');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Helper to convert timestamp (seconds) to YYYY-MM-DD for <input type="date">
  const timestampToDateString = (ts: string | number | undefined) => {
    if (!ts) return '';
    const date = new Date(Number(ts) * 1000);
    // Pad months and days
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Helper to convert YYYY-MM-DD back to timestamp (seconds)
  const dateStringToTimestamp = (dateStr: string) => {
    if (!dateStr) return null;
    return Math.floor(new Date(dateStr).getTime() / 1000);
  };

  useEffect(() => {
    const fetchProposal = async () => {
      try {
        const response = await api.get(`/proposals/${id}`);
        if (response.data) {
          const d = response.data as Proposal;
          setProposalRef(d.ref);
          setFormData({
            statut: String(d.statut ?? '0'),
            datep: timestampToDateString(d.datep),
            fin_validite: timestampToDateString(d.fin_validite),
            total_ht: d.total_ht ? String(d.total_ht) : '',
          });

          // Résolution du nom du Tiers
          if (d.thirdparty?.name) {
            setClientName(d.thirdparty.name);
          } else if (d.soc_name || d.name) {
            setClientName(d.soc_name || d.name || '');
          } else if (d.socid) {
            try {
              const tierResp = await api.get(`/thirdparties/${d.socid}`);
              setClientName(
                tierResp.data?.name ||
                  tierResp.data?.nom ||
                  `Tiers ID: ${d.socid}`
              );
            } catch {
              setClientName(`Tiers ID: ${d.socid}`);
            }
          } else {
            setClientName('Inconnu');
          }
        }
      } catch (err: unknown) {
        setError('Erreur lors de la récupération des données du devis.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProposal();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload: Record<string, unknown> = {
      statut: parseInt(formData.statut, 10),
      datep: dateStringToTimestamp(formData.datep),
      fin_validite: dateStringToTimestamp(formData.fin_validite),
    };

    if (formData.total_ht !== '') {
      payload.total_ht = parseFloat(formData.total_ht);
    }

    try {
      await api.put(`/proposals/${id}`, payload);
      router.push(`/commerce/${id}`);
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      setError(
        apiErr.response?.data?.error?.message ||
          'Erreur inattendue lors de la mise à jour.'
      );
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        'Êtes-vous sûr de vouloir supprimer définitivement ce devis ? Cette action est irréversible.'
      )
    ) {
      return;
    }
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/proposals/${id}`);
      router.push('/commerce');
    } catch (err: unknown) {
      const apiErr = err as Error & ApiError;
      setError(
        apiErr.response?.data?.error?.message ||
          'Impossible de supprimer ce devis.'
      );
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted text-center text-sm">
          Chargement de la fiche d'édition...
        </div>
      </div>
    );
  }

  // Le devis n'est modifiable au niveau du prix que s'il est un brouillon (0)
  const isDraft = formData.statut === '0';

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* En-tête de la page d'édition */}
      <div className="border-border flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            Modifier le devis {proposalRef}
          </h1>
          <p className="text-muted mt-1 text-sm">
            Modification de l'état, dates et montants.
          </p>
        </div>
        <div className="flex items-center space-x-6">
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="text-sm font-semibold text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
          >
            {deleting ? 'Suppression...' : 'Supprimer ce devis'}
          </button>
          <button
            onClick={() => router.back()}
            className="text-muted hover:text-foreground text-sm font-medium transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Formulaire */}
      <form
        onSubmit={handleSubmit}
        className="border-border bg-surface space-y-8 rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
          {/* Client Assoçié (Lecture Seule) */}
          <div className="sm:col-span-2">
            <label
              htmlFor="clientName"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              Client / Prospect
            </label>
            <div className="mt-2">
              <input
                type="text"
                id="clientName"
                value={clientName}
                disabled
                className="bg-muted/10 text-foreground ring-border block w-full cursor-not-allowed rounded-md border-0 px-3 py-2 opacity-70 ring-1 ring-inset sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Statut */}
          <div className="sm:col-span-2">
            <label
              htmlFor="statut"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              État du devis *
            </label>
            <div className="mt-2">
              <select
                id="statut"
                name="statut"
                required
                value={formData.statut}
                onChange={handleChange}
                className="bg-background text-foreground ring-border focus:ring-primary block w-full rounded-md px-3 py-2 text-sm ring-1 ring-inset focus:ring-2 focus:ring-inset"
              >
                <option value="0">Brouillon</option>
                <option value="1">Ouvert</option>
                <option value="2">Signé</option>
                <option value="3">Non signé</option>
                <option value="4">Facturé</option>
              </select>
            </div>
          </div>

          {/* Date de proposition */}
          <div>
            <label
              htmlFor="datep"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              Date de proposition *
            </label>
            <div className="mt-2">
              <input
                type="date"
                id="datep"
                name="datep"
                required
                value={formData.datep}
                onChange={handleChange}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Date de fin de validité */}
          <div>
            <label
              htmlFor="fin_validite"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              Date de fin de validité
            </label>
            <div className="mt-2">
              <input
                type="date"
                id="fin_validite"
                name="fin_validite"
                value={formData.fin_validite}
                onChange={handleChange}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary block w-full rounded-md border-0 px-3 py-2 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {/* Montant HT */}
          <div className="sm:col-span-2">
            <label
              htmlFor="total_ht"
              className="text-foreground block text-sm leading-6 font-medium"
            >
              Montant HT
            </label>
            <div className="relative mt-2 rounded-md shadow-sm sm:max-w-xs">
              <input
                type="number"
                step="0.01"
                id="total_ht"
                name="total_ht"
                disabled={!isDraft}
                value={formData.total_ht}
                onChange={handleChange}
                className="bg-background text-foreground ring-border placeholder:text-muted focus:ring-primary disabled:bg-muted/10 block w-full rounded-md border-0 px-3 py-2 pr-10 ring-1 ring-inset focus:ring-2 focus:ring-inset disabled:cursor-not-allowed disabled:opacity-70 sm:text-sm sm:leading-6"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-muted sm:text-sm">€</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-border flex items-center justify-end border-t pt-6">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary-hover focus-visible:outline-primary inline-flex justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            {saving ? 'Sauvegarde en cours...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
