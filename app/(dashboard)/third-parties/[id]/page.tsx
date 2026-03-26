"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../services/api';

export default function ThirdPartyDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [tier, setTier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTier = async () => {
      try {
        const response = await api.get(`/thirdparties/${id}`);
        if (response.data) {
          setTier(response.data);
        } else {
          setError("Tiers introuvable.");
        }
      } catch (err: any) {
        setError("Erreur lors de la récupération des informations du tiers.");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchTier();
  }, [id]);

  const getTierType = (tier: any) => {
    const types = [];
    if (String(tier.client) === '1' || String(tier.client) === '3') types.push('Client');
    if (String(tier.client) === '2' || String(tier.client) === '3') types.push('Prospect');
    if (String(tier.fournisseur) === '1') types.push('Fournisseur');
    return types.length > 0 ? types.join(' / ') : 'Non défini';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-sm text-muted">Chargement des détails de la fiche...</div>
      </div>
    );
  }

  if (error || !tier) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.push('/third-parties')} className="text-sm text-primary hover:underline decoration-primary">
          &larr; Retour à la liste
        </button>
        <div className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-inset ring-red-600/20">{error || "Introuvable"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center">
        <button 
          onClick={() => router.push('/third-parties')} 
          className="text-sm text-muted hover:text-foreground hover:underline transition-colors"
        >
          &larr; Retour à la liste
        </button>
      </div>
      
      {/* Title Header */}
      <div className="sm:flex sm:items-center sm:justify-between py-2 border-b border-border">
        <div className="flex items-center space-x-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{tier.name}</h1>
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {getTierType(tier)}
          </span>
        </div>
      </div>

      {/* Grid panels */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
        
        {/* Contact Info Card */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-border bg-background px-5 py-4">
            <h3 className="text-base font-semibold leading-6 text-foreground">Coordonnées de Contact</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Email Principal</p>
              <p className="mt-1 text-sm text-foreground">
                {tier.email ? <a href={`mailto:${tier.email}`} className="text-primary hover:underline">{tier.email}</a> : <span className="text-muted italic">Non renseigné</span>}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Téléphone</p>
              <p className="mt-1 text-sm text-foreground">
                {tier.phone ? <a href={`tel:${tier.phone}`} className="text-primary hover:underline">{tier.phone}</a> : <span className="text-muted italic">Non renseigné</span>}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Site Web</p>
              <p className="mt-1 text-sm text-foreground">
                {tier.url ? <a href={tier.url.startsWith('http') ? tier.url : `https://${tier.url}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">{tier.url}</a> : <span className="text-muted italic">Non renseigné</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Address Card */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-border bg-background px-5 py-4">
            <h3 className="text-base font-semibold leading-6 text-foreground">Adresse Postale</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Rue / Voie</p>
              <p className="mt-1 text-sm text-foreground">{tier.address || <span className="text-muted italic">Non renseignée</span>}</p>
            </div>
            <div className="flex space-x-8">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Code Postal</p>
                <p className="mt-1 text-sm text-foreground">{tier.zip || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Ville</p>
                <p className="mt-1 text-sm text-foreground">{tier.town || '-'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Pays</p>
              <p className="mt-1 text-sm text-foreground">{tier.country || '-'}</p>
            </div>
          </div>
        </div>
        
        {/* Identifiants Légaux Card */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm sm:col-span-2 transition-shadow hover:shadow-md">
          <div className="border-b border-border bg-background px-5 py-4">
            <h3 className="text-base font-semibold leading-6 text-foreground">Identifiants Légaux & Informations Référentiel</h3>
          </div>
          <div className="p-5 flex flex-col sm:flex-row sm:space-x-12 space-y-4 sm:space-y-0">
             <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Numéro de TVA</p>
              <p className="mt-1 text-sm text-foreground">{tier.tva_intra || <span className="text-muted italic">Non renseigné</span>}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">SIRET</p>
              <p className="mt-1 text-sm text-foreground">{tier.idprof2 || <span className="text-muted italic">Non renseigné</span>}</p>
            </div>
             <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Code Client</p>
              <p className="mt-1 text-sm text-foreground font-mono bg-background px-2 py-0.5 rounded border border-border">{tier.code_client || 'Généré automatiquement'}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
