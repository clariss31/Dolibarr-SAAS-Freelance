'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams, notFound } from 'next/navigation';
import { api } from '../../../../services/api';
import { getErrorMessage } from '../../../../utils/error-handler';
import { Invoice, InvoicePayment, ApiError } from '../../../../types/dolibarr';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formate un montant en euros avec la locale française.
 * Retourne '-' si la valeur est absente ou invalide.
 */
function formatCurrency(amount: string | number | undefined): string {
  if (amount === undefined || amount === null || amount === '') return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount));
}

/**
 * Formate un timestamp Dolibarr (secondes Unix ou chaîne ISO) en date lisible `dd/mm/yyyy`.
 * Retourne '-' si la valeur est absente ou invalide.
 */
function formatDate(timestamp: number | string | undefined): string {
  if (!timestamp) return '-';

  // Déjà au format ISO (YYYY-MM-DD ou YYYY-MM-DD HH:mm:ss)
  if (typeof timestamp === 'string' && timestamp.includes('-')) {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(timestamp));
  }

  const numTs = Number(timestamp);
  if (isNaN(numTs)) return '-';

  // Dolibarr retourne des secondes ; on détecte les millisecondes (> 10 chiffres)
  const ms = numTs < 10_000_000_000 ? numTs * 1000 : numTs;
  return new Intl.DateTimeFormat('fr-FR').format(new Date(ms));
}

/**
 * Détermine si une facture est en retard de paiement.
 * Une facture est en retard si :
 *   - son statut est 1 (impayée)
 *   - sa date d'échéance est antérieure à la date actuelle
 */
function isOverdue(inv: Invoice): boolean {
  if (Number(inv.statut) !== 1) return false;

  const limitRaw = inv.datelimit ?? inv.date_lim_reglement ?? inv.date_echeance;
  if (!limitRaw) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  let limitSeconds = 0;

  if (typeof limitRaw === 'string' && limitRaw.includes('-')) {
    const ms = new Date(limitRaw).getTime();
    if (!isNaN(ms)) limitSeconds = Math.floor(ms / 1000);
  } else {
    const raw = Number(limitRaw);
    // Normalisation : passage en secondes si retourné en millisecondes
    limitSeconds = raw > 10_000_000_000 ? Math.floor(raw / 1000) : raw;
  }

  return limitSeconds > 0 && limitSeconds < nowSeconds;
}

// ---------------------------------------------------------------------------
// Badges de statut
// ---------------------------------------------------------------------------

/** Retourne le badge coloré correspondant au statut d'une facture Dolibarr.
 * Le statut "Règlement commencé" est un statut logique déduit (statut=1 avec paiements partiels).
 */
function StatusBadge({ invoice, sommePaye }: { invoice: Invoice; sommePaye: number }) {
  // Règlement commencé : facture impayée (statut=1) avec au moins un paiement enregistré
  const isPartiallyPaid = Number(invoice.statut) === 1 && sommePaye > 0;

  switch (Number(invoice.statut)) {
    case 0:
      return (
        <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-500/10 ring-inset">
          Brouillon
        </span>
      );
    case 1:
      if (isPartiallyPaid) {
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            Règlement commencé
          </span>
        );
      }
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Impayée
        </span>
      );
    case 2:
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          Payée
        </span>
      );
    case 3:
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
          Abandonnée
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
          Inconnu
        </span>
      );
  }
}

/**
 * Détermine si un compte Dolibarr est une Caisse (argent liquide).
 * Se base sur le type technique (2) ou des mots-clés dans la référence.
 */
function isCashAccount(b: any): boolean {
  if (!b) return false;
  return (
    Number(b.type) === 2 ||
    Number(b.account_type) === 2 ||
    (typeof b.ref === 'string' &&
      (b.ref.toUpperCase().includes('CASH') ||
        b.ref.toUpperCase().includes('CAISSE')))
  );
}

// ---------------------------------------------------------------------------
// Composant principal (doit être enfant d'un <Suspense> pour useSearchParams)
// ---------------------------------------------------------------------------

/**
 * Page de détail d'une facture (client ou fournisseur).
 *
 * - Charge la facture via GET /invoices/{id} ou GET /supplierinvoices/{id}.
 * - Redirige vers 404 si la ressource est introuvable.
 * - Affiche les informations générales, les montants et les lignes.
 * - Propose les actions Modifier / Supprimer uniquement en statut Brouillon (0).
 */
function InvoiceDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** 'client' | 'supplier' — détermine l'endpoint API utilisé. */
  const typeParam = searchParams?.get('type') ?? 'client';
  /** Préfixe d'endpoint selon le type de facture. */
  const endpoint = typeParam === 'supplier' ? '/supplierinvoices' : '/invoices';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [thirdPartyName, setThirdPartyName] = useState('-');

  // ---------------------------------------------------------------------------
  // États de la Modal de Paiement
  // ---------------------------------------------------------------------------
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().substring(0, 10)
  );
  const [paymentMode, setPaymentMode] = useState('6'); // Défaut: Carte bancaire (6)
  const [paymentAccount, setPaymentAccount] = useState('');
  const [paymentNum, setPaymentNum] = useState('');
  const [paymentEmitter, setPaymentEmitter] = useState('');
  const [paymentBank, setPaymentBank] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [paymentModes] = useState<any[]>([
    { id: 6, label: 'Carte bancaire' },
    { id: 3, label: 'Chèque' },
    { id: 4, label: 'Espèce' },
    { id: 7, label: 'Ordre de prélèvement' },
    { id: 2, label: 'Virement bancaire' },
  ]);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Liste des règlements rattachés à la facture
  const [payments, setPayments] = useState<InvoicePayment[]>([]);

  // ---------------------------------------------------------------------------
  // États de la Modal d'Abandon (Annnulation)
  // ---------------------------------------------------------------------------
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [abandonReason, setAbandonReason] = useState('BADDEBT'); // Par défaut: Mauvais payeur
  const [abandonComment, setAbandonComment] = useState('');
  const [isSubmittingAbandon, setIsSubmittingAbandon] = useState(false);

  // ---------------------------------------------------------------------------
  // Chargement de la facture
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;

    const fetchInvoice = async () => {
      try {
        const response = await api.get(`${endpoint}/${id}`);

        if (!response.data) {
          setError('Facture introuvable.');
          return;
        }

        const inv = response.data as Invoice;
        setInvoice(inv);

        // Résolution du nom du tiers (même logique robuste que la page d'édition)
        const name = inv.soc_name ?? inv.nom ?? inv.thirdparty?.name;
        if (name) {
          setThirdPartyName(name);
        } else if (inv.socid) {
          try {
            const tierResp = await api.get(`/thirdparties/${inv.socid}`);
            setThirdPartyName(
              tierResp.data?.name ?? tierResp.data?.nom ?? `ID: ${inv.socid}`
            );
          } catch {
            setThirdPartyName(`ID: ${inv.socid}`);
          }
        }
      } catch (err: unknown) {
        const apiErr = err as ApiError;
        // Redirection 404 si la facture n'existe pas
        if (apiErr.response?.status === 404) {
          notFound();
        } else {
          setError(getErrorMessage(err));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id, endpoint]);

  // Chargement des règlements existants sur la facture
  useEffect(() => {
    if (!id || !endpoint) return;
    const fetchPayments = async () => {
      try {
        // Uniquement disponible pour les factures client
        if (endpoint === '/invoices') {
          const res = await api.get(`/invoices/${id}/payments`);
          if (Array.isArray(res.data)) {
            setPayments(res.data);
          }
        }
      } catch {
        // Silencieux : certaines versions Dolibarr ne supportent pas cet endpoint
      }
    };
    fetchPayments();
  }, [id, endpoint]);

  // Chargement des dépendances paiement (comptes bancaires)
  useEffect(() => {
    const fetchSetup = async () => {
      try {
        const banksRes = await api.get('/bankaccounts');
        if (banksRes.data) {
          setBankAccounts(banksRes.data);
          if (banksRes.data.length > 0 && !paymentAccount) {
            setPaymentAccount(String(banksRes.data[0].id));
          }
        }
      } catch (e) {
        console.error('Erreur chargement comptes bancaires');
      }
    };
    fetchSetup();
  }, []); // On charge une fois au montage

  // ---------------------------------------------------------------------------
  // Handler de suppression
  // ---------------------------------------------------------------------------

  /** Demande confirmation puis supprime le brouillon de facture. */
  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce brouillon ?'))
      return;

    setIsDeleting(true);
    setError('');

    try {
      await api.delete(`${endpoint}/${id}`);
      router.push('/billing-payments');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setIsDeleting(false);
    }
  };

  /** Valide la facture (passage en impayée) */
  const handleValidate = async () => {
    if (
      !window.confirm(
        'Voulez-vous valider cette facture ? Elle ne sera plus modifiable par la suite.'
      )
    )
      return;
    setIsDeleting(true); // réutilisation de l'état loading pour bloquer les boutons
    setError('');
    try {
      // Endpoint classique: /invoices/{id}/validate
      await api.post(`${endpoint}/${id}/validate`, {
        idwarehouse: 0,
        notrigger: 0,
      });
      window.location.reload();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setIsDeleting(false);
    }
  };

  /** Passe une facture impayée en abandonnée */
  const handleCancel = () => {
    setShowAbandonModal(true);
  };

  /** Soumet l'abandon de la facture à l'API Dolibarr */
  const submitAbandon = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAbandon(true);
    setError('');

    try {
      console.log(`Tentative d'abandon via PUT...`);
      // Comme votre Swagger ne montre pas d'endpoint d'action pour l'abandon, 
      // on utilise le PUT générique en envoyant le statut 3 (Abandonnée)
      // On passe id_reason ET close_code pour être sûr de couvrir toutes les variantes Dolibarr
      await api.put(`${endpoint}/${id}`, {
        statut: "3",
        status: "3",
        id_reason: abandonReason,
        close_code: abandonReason,
        close_note: abandonComment,
        note_private: abandonComment // Fallback sécurité
      });
      
      console.log(`✅ Succès de l'abandon via PUT`);
      window.location.reload();
    } catch (err: any) {
      console.error(`❌ Échec de l'abandon via PUT`, err);
      setError(`Échec de l'abandon. Votre API ne semble pas supporter les actions directes. Erreur finale: ${getErrorMessage(err)}`);
      setIsSubmittingAbandon(false);
    }
  };

  /** Rouvre une facture abandonnée (repasse en impayée) */
  const handleReopen = async () => {
    if (
      !window.confirm('Rouvrir cette facture ? Elle sera reclassée en impayée.')
    )
      return;
    setIsDeleting(true);
    setError('');
    try {
      await api.post(`${endpoint}/${id}/settounpaid`, { idwarehouse: 0 });
      window.location.reload();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setIsDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handler du Règlement
  // ---------------------------------------------------------------------------

  const handleOpenPayment = () => {
    // Pré-remplir avec le reste à payer (TTC - somme des règlements existants)
    const total = Number(invoice?.total_ttc) || 0;
    const dejaRegle = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const reste = Math.max(0, total - dejaRegle);
    setPaymentAmount(reste.toFixed(2));
    setShowPaymentModal(true);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPayment(true);
    setError('');

    try {
      const amountParsed = parseFloat(paymentAmount.replace(',', '.'));
      if (isNaN(amountParsed) || amountParsed <= 0) {
        throw new Error('Montant invalide');
      }

      const totalTtcComputed = Number(invoice?.total_ttc) || 0;
      const dateSeconds = Math.floor(new Date(paymentDate).getTime() / 1000);

      const payload = {
        datepaye: dateSeconds,
        paymentid: Number(paymentMode),
        accountid: Number(paymentAccount),
        closepaidinvoices: (sommePaye + amountParsed) >= totalTtcComputed ? 'yes' : 'no',
        num_payment: paymentNum || '',
        comment: paymentComment || '',
        chqemetteur: paymentEmitter || '',
        chqbank: paymentBank || '',
        arrayofamounts: {
          [id]: {
            amount: amountParsed
          }
        }
      };

      await api.post(`${endpoint}/paymentsdistributed`, payload);
      window.location.reload();
    } catch (err: any) {
      console.group('❌ Erreur paiement');
      console.warn('err complet :', err);
      console.warn('err.response.data :', err?.response?.data);
      console.groupEnd();

      // Extraction propre du message d'erreur de Dolibarr s'il existe
      const apiMessage = err?.response?.data?.error?.message;
      setError(apiMessage || getErrorMessage(err));
      setIsSubmittingPayment(false);
      setShowPaymentModal(false);
    }
  };

  const closeModal = () => {
    setShowPaymentModal(false);
    setIsSubmittingPayment(false);
  };

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted text-center text-sm">
          Chargement de la facture...
        </p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/billing-payments')}
          className="text-primary decoration-primary text-sm hover:underline"
        >
          &larr; Retour à la liste
        </button>
        <div
          className="rounded-md bg-red-50 p-4 text-red-800 ring-1 ring-red-600/20 ring-inset"
          role="alert"
        >
          {error || 'Introuvable'}
        </div>
      </div>
    );
  }

  const isDraft = Number(invoice.statut) === 0;

  // Calcul de la TVA totale si absente de la réponse API
  const totalHt = Number(invoice.total_ht) || 0;
  const totalTtc = Number(invoice.total_ttc) || 0;
  const totalTva = Number(invoice.total_tva) || totalTtc - totalHt;

  // Calcul du mont déjà réglé et du reste à payer à partir des règlements chargés
  const sommePaye = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const resteAPayer = Math.max(0, totalTtc - sommePaye);

  // Détection du conflit Caisse vs Mode de paiement non-espèce
  const selectedBankData = bankAccounts.find(
    (b) => String(b.id) === paymentAccount
  );
  const showMismatchError =
    selectedBankData && isCashAccount(selectedBankData) && paymentMode !== '4';
  const mismatchErrorMessage =
    "Ce compte bancaire est de type caisse et n'accepte que le mode de règlement de type espèce.";

  // Date d'échéance (plusieurs noms de champ selon la version Dolibarr)
  const dueDateRaw =
    invoice.datelimit ?? invoice.date_lim_reglement ?? invoice.date_echeance;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center">
        <button
          onClick={() => router.push('/billing-payments')}
          className="text-muted hover:text-foreground text-sm transition-colors hover:underline"
        >
          &larr; Retour à la liste
        </button>
      </div>

      {/* En-tête : référence, statut et actions */}
      <div className="border-border border-b py-2 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-foreground text-3xl font-bold tracking-tight">
            {invoice.ref}
          </h1>
          <StatusBadge invoice={invoice} sommePaye={sommePaye} />
        </div>

        {/* Actions disponibles selon le statut */}
        <div className="mt-4 sm:mt-0 sm:flex sm:items-center sm:space-x-4">
          {/* Si Brouillon (0) on peut Modifier, Valider, Supprimer */}
          {isDraft && (
            <>
              <button
                disabled={isDeleting}
                onClick={handleValidate}
                className="inline-flex cursor-pointer justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-600 transition-colors ring-inset hover:bg-emerald-700 disabled:opacity-50"
              >
                Valider
              </button>
              <button
                disabled={isDeleting}
                onClick={() =>
                  router.push(`/billing-payments/${id}/edit?type=${typeParam}`)
                }
                className="inline-flex cursor-pointer justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 transition-colors ring-inset hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700"
              >
                Modifier
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDelete}
                className="text-sm font-semibold text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
              >
                {isDeleting && isDraft ? 'Action...' : 'Supprimer'}
              </button>
            </>
          )}

          {/* Si Impayée (1) OU Règlement commencé on peut saisir un nouveau règlement ou abandonner */}
          {Number(invoice.statut) === 1 && (
            <>
              <button
                disabled={isDeleting}
                onClick={handleOpenPayment}
                className="inline-flex cursor-pointer justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-600 transition-colors ring-inset hover:bg-emerald-700 disabled:opacity-50"
              >
                Saisir un règlement
              </button>
              <button
                disabled={isDeleting}
                onClick={handleCancel}
                className="inline-flex cursor-pointer justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-gray-300 transition-colors ring-inset hover:bg-red-50 disabled:opacity-50 dark:bg-gray-800 dark:text-red-400 dark:ring-gray-700 dark:hover:bg-red-900/30"
              >
                Abandonner
              </button>
            </>
          )}

          {/* Si Abandonnée (3) on peut la rouvrir en impayée */}
          {Number(invoice.statut) === 3 && (
            <button
              disabled={isDeleting}
              onClick={handleReopen}
              className="inline-flex cursor-pointer justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 transition-colors ring-inset hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700"
            >
              Rouvrir
            </button>
          )}
        </div>
      </div>

      {/* Panneaux d'informations */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Informations générales */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
              Informations générales
            </h3>
          </div>
          <div className="space-y-4 p-5">
            {/* Date de facturation */}
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Date facturation
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {formatDate(invoice.date)}
              </p>
            </div>

            {/* Date d'échéance avec indicateur de retard */}
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Date d'échéance
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p
                  className={`text-sm font-medium ${isOverdue(invoice) ? 'font-bold text-red-600 dark:text-red-400' : 'text-foreground'}`}
                >
                  {formatDate(dueDateRaw)}
                </p>
                {isOverdue(invoice) && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    RETARD
                  </span>
                )}
              </div>
            </div>

            {/* Tiers associé */}
            <div>
              <p className="text-muted text-xs font-medium tracking-wider uppercase">
                Tiers
              </p>
              <p className="text-foreground mt-1 text-sm font-medium">
                {thirdPartyName}
              </p>
            </div>
          </div>
        </div>

        {/* Montants */}
        <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm">
          <div className="border-border bg-background border-b px-5 py-4">
            <h3 className="text-foreground text-base leading-6 font-semibold">
              Montants
            </h3>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="text-muted text-sm font-medium">Montant HT</p>
              <p className="text-foreground text-sm font-semibold">
                {formatCurrency(totalHt)}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-muted text-sm font-medium">Montant TVA</p>
              <p className="text-foreground text-sm font-semibold">
                {formatCurrency(totalTva)}
              </p>
            </div>
            <div className="border-border mt-2 flex items-center justify-between border-t pt-2">
              <p className="text-muted text-base font-semibold">Montant TTC</p>
              <p className="text-primary text-base font-bold">
                {formatCurrency(totalTtc)}
              </p>
            </div>
          </div>

          {/* Tableau des règlements (visible si au moins un paiement enregistré) */}
          {payments.length > 0 && (
            <div className="border-border border-t px-5 pt-4 pb-5">
              <p className="text-foreground mb-3 text-sm font-semibold">Règlements</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-muted text-xs uppercase">
                      <th className="pb-2 pr-4 text-left font-medium">Date</th>
                      <th className="pb-2 pr-4 text-left font-medium">Type</th>
                      <th className="pb-2 pr-4 text-left font-medium">Compte bancaire</th>
                      <th className="pb-2 text-right font-medium">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                      {payments.map((p, idx) => {
                        // Résolution de la date (Dolibarr utilise datep, datepaye, date ou date_creation)
                        const pDate = p.datepaye ?? (p as any).datep ?? (p as any).date ?? (p as any).date_creation;

                        // Résolution du libellé du mode de paiement
                        const pMode = String(p.type ?? p.paiementid ?? p.paiementcode ?? (p as any).type_id ?? (p as any).type_code ?? '');
                        const modeMapping: Record<string, string> = {
                          '6': 'Carte bancaire', 'CB': 'Carte bancaire',
                          '3': 'Chèque', 'CHQ': 'Chèque',
                          '4': 'Espèce', 'LIQ': 'Espèce',
                          '7': 'Ordre de prélèvement', 'PRE': 'Ordre de prélèvement',
                          '2': 'Virement bancaire', 'VIR': 'Virement bancaire'
                        };
                        
                        const modeLabel = modeMapping[pMode] ?? 
                          paymentModes.find(m => String(m.id) === pMode)?.label ??
                          p.paiementcode ?? 
                          (p as any).paiement_type_label ?? 
                          (p.paiementid ? `Mode #${p.paiementid}` : '-');

                        // Résolution du libellé du compte bancaire (plusieurs noms de champs possibles)
                        const pBankId = String(p.fk_bank ?? (p as any).fk_account ?? (p as any).account_id ?? (p as any).fk_bank_account ?? '');
                        
                        // Si on n'a toujours pas d'ID de banque sur le paiement, on tente d'utiliser celui par défaut de la facture
                        const finalBankId = pBankId || String(invoice.fk_account ?? '');

                        const bankLabel =
                          bankAccounts.find(b => String(b.id) === finalBankId)?.label ??
                          bankAccounts.find(b => String(b.id) === finalBankId)?.ref ??
                          p.bank_account ??
                          (p as any).bank_label ??
                          (finalBankId ? `Compte #${finalBankId}` : '-');

                      return (
                        <tr
                          key={p.id != null ? String(p.id) : `pay-${idx}`}
                          className="hover:bg-background/50 transition-colors"
                        >
                          <td className="text-foreground py-2 pr-4 whitespace-nowrap">
                            {formatDate(pDate)}
                          </td>
                          <td className="text-muted py-2 pr-4 whitespace-nowrap">
                            {modeLabel}
                          </td>
                          <td className="text-muted py-2 pr-4 whitespace-nowrap">
                            {bankLabel}
                          </td>
                          <td className="text-foreground py-2 text-right font-medium whitespace-nowrap">
                            {formatCurrency(p.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Récapitulatif déjà réglé / reste à payer */}
              <div className="border-border mt-3 space-y-1 border-t pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Déjà réglé (hors avoirs et acomptes)</span>
                  <span className="text-foreground font-medium">{formatCurrency(sommePaye)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Facturée</span>
                  <span className="text-foreground font-medium">{formatCurrency(totalTtc)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-bold">
                  <span className="text-foreground">Reste à payer</span>
                  <span className={resteAPayer > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                    {formatCurrency(resteAPayer)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lignes de la facture */}
      <div className="border-border bg-surface mt-8 overflow-hidden rounded-xl border shadow-sm">
        <div className="border-border bg-background border-b px-5 py-4">
          <h3 className="text-foreground text-base leading-6 font-semibold">
            Lignes de la facture
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="divide-border min-w-full divide-y">
            <thead className="bg-background">
              <tr>
                <th
                  scope="col"
                  className="text-foreground w-[45%] py-3.5 pr-3 pl-4 text-left text-sm font-semibold sm:pl-6"
                >
                  Description
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-center text-sm font-semibold"
                >
                  TVA
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-right text-sm font-semibold"
                >
                  P.U. HT
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-center text-sm font-semibold"
                >
                  Qté
                </th>
                <th
                  scope="col"
                  className="text-foreground px-3 py-3.5 text-right text-sm font-semibold"
                >
                  Total HT
                </th>
              </tr>
            </thead>
            <tbody className="divide-border bg-surface divide-y">
              {!invoice.lines?.length ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-muted py-6 text-center text-sm italic"
                  >
                    Aucune ligne pour cette facture
                  </td>
                </tr>
              ) : (
                invoice.lines.map((line, idx) => {
                  const lineId = line.id ?? line.rowid ?? `line-${idx}`;
                  const description =
                    line.label ?? line.description ?? line.product_label ?? '-';
                  const tva = Number(line.tva_tx) || 0;
                  const puHt = Number(line.subprice) || 0;
                  const qty = Number(line.qty) || 1;
                  const lineTotalHt = Number(line.total_ht) || puHt * qty;

                  return (
                    <tr
                      key={lineId}
                      className="hover:bg-background/50 transition-colors"
                    >
                      <td className="text-foreground py-4 pr-3 pl-4 align-top text-sm sm:pl-6">
                        <div className="whitespace-pre-wrap">{description}</div>
                      </td>
                      <td className="text-muted px-3 py-4 text-center align-top text-sm whitespace-nowrap">
                        {tva}%
                      </td>
                      <td className="text-muted px-3 py-4 text-right align-top text-sm whitespace-nowrap">
                        {formatCurrency(puHt)}
                      </td>
                      <td className="text-muted px-3 py-4 text-center align-top text-sm whitespace-nowrap">
                        {qty}
                      </td>
                      <td className="text-foreground px-3 py-4 text-right align-top text-sm font-medium whitespace-nowrap">
                        {formatCurrency(lineTotalHt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Saisie Règlement */}
      {showPaymentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface relative w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all sm:my-8 dark:bg-gray-900">
            <form onSubmit={submitPayment}>
              <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                <h3
                  className="text-foreground text-lg leading-6 font-semibold"
                  id="modal-title"
                >
                  Saisir un règlement
                </h3>
              </div>

              {/* Message d'erreur Dolibarr si incompatibilité sélection Caisse/Mode */}
              {showMismatchError && (
                <div className="mx-6 mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-600/20 ring-inset">
                  {mismatchErrorMessage}
                </div>
              )}

              <div className="space-y-4 px-6 py-5">
                <div>
                  <label
                    htmlFor="payDate"
                    className="text-foreground block text-sm font-medium"
                  >
                    Date de paiement
                  </label>
                  <input
                    type="date"
                    id="payDate"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="focus:ring-primary mt-1 block w-full rounded-md border px-3 py-2 text-sm ring-1 ring-gray-300 focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="payMode"
                    className="text-foreground block text-sm font-medium"
                  >
                    Mode de règlement
                  </label>
                  <select
                    id="payMode"
                    required
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="focus:ring-primary mt-1 block w-full rounded-md border px-3 py-2 text-sm ring-1 ring-gray-300 focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  >
                    {paymentModes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label || m.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="payBank"
                    className="text-foreground block text-sm font-medium"
                  >
                    Compte bancaire à créditer
                  </label>
                  <select
                    id="payBank"
                    required
                    value={paymentAccount}
                    onChange={(e) => setPaymentAccount(e.target.value)}
                    className="focus:ring-primary mt-1 block w-full rounded-md border px-3 py-2 text-sm ring-1 ring-gray-300 focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  >
                    {bankAccounts.length === 0 && (
                      <option value="">Aucun compte trouvé</option>
                    )}
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.ref} - {b.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="payNum"
                    className="text-foreground block text-sm font-medium"
                  >
                    Numéro (Chèque/Virement N°)
                  </label>
                  <input
                    type="text"
                    id="payNum"
                    value={paymentNum}
                    onChange={(e) => setPaymentNum(e.target.value)}
                    className="focus:ring-primary mt-1 block w-full rounded-md border px-3 py-2 text-sm ring-1 ring-gray-300 focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                    placeholder="Ex: CHQ123456"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="payEmitter"
                      className="text-foreground block text-sm font-medium"
                    >
                      Émetteur
                    </label>
                    <input
                      type="text"
                      id="payEmitter"
                      value={paymentEmitter}
                      onChange={(e) => setPaymentEmitter(e.target.value)}
                      className="focus:ring-primary mt-1 block w-full rounded-md border px-3 py-2 text-sm ring-1 ring-gray-300 focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="payBankName"
                      className="text-foreground block text-sm font-medium"
                    >
                      Banque
                    </label>
                    <input
                      type="text"
                      id="payBankName"
                      value={paymentBank}
                      onChange={(e) => setPaymentBank(e.target.value)}
                      className="focus:ring-primary mt-1 block w-full rounded-md border px-3 py-2 text-sm ring-1 ring-gray-300 focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="payComment"
                    className="text-foreground block text-sm font-medium"
                  >
                    Commentaires
                  </label>
                  <textarea
                    id="payComment"
                    rows={2}
                    value={paymentComment}
                    onChange={(e) => setPaymentComment(e.target.value)}
                    className="focus:ring-primary mt-1 block w-full rounded-md border px-3 py-2 text-sm ring-1 ring-gray-300 focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="payAmount"
                    className="text-foreground block text-sm font-medium"
                  >
                    Montant (TTC)
                  </label>
                  <div className="relative mt-1 rounded-md shadow-sm">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      id="payAmount"
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="focus:ring-primary block w-full rounded-md border px-3 py-2 text-sm ring-1 ring-gray-300 focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:ring-gray-700"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <span className="text-gray-500 sm:text-sm">€</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-row-reverse gap-3 rounded-b-xl bg-gray-50 px-6 py-4 dark:bg-gray-800">
                <button
                  type="submit"
                  disabled={
                    isSubmittingPayment ||
                    !paymentAccount ||
                    !paymentMode ||
                    !!showMismatchError
                  }
                  className="btn-primary inline-flex justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
                >
                  {isSubmittingPayment
                    ? 'Enregistrement...'
                    : 'Valider le paiement'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="focus:ring-primary inline-flex justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset hover:bg-gray-50 focus:ring-2 focus:outline-none dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-600"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'abandon de facture */}
      {showAbandonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-xl font-bold text-foreground">Annuler la facture</h3>
              <button
                onClick={() => setShowAbandonModal(false)}
                className="text-muted hover:text-foreground transition-colors"
                aria-label="Fermer"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={submitAbandon} className="p-6 space-y-6">
              <p className="text-sm text-foreground">
                Pour quelle raison voulez-vous classer la facture abandonnée ?
              </p>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="abandonReason"
                    value="BADDEBT"
                    checked={abandonReason === 'BADDEBT'}
                    onChange={(e) => setAbandonReason(e.target.value)}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span className="text-sm text-foreground">Mauvais payeur</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="abandonReason"
                    value="REPL"
                    checked={abandonReason === 'REPL'}
                    onChange={(e) => setAbandonReason(e.target.value)}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span className="text-sm text-foreground">Remplacement par une autre facture</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="abandonReason"
                    value="OTHER"
                    checked={abandonReason === 'OTHER'}
                    onChange={(e) => setAbandonReason(e.target.value)}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                  />
                  <span className="text-sm text-foreground">Autre</span>
                </label>
              </div>

              <div>
                <label htmlFor="abandonComment" className="block text-sm font-medium text-foreground mb-1">
                  Commentaire
                </label>
                <textarea
                  id="abandonComment"
                  rows={3}
                  value={abandonComment}
                  onChange={(e) => setAbandonComment(e.target.value)}
                  placeholder="Expliquez brièvement la raison..."
                  className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none dark:text-white"
                />
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <svg className="h-5 w-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p>
                  Êtes-vous sûr de vouloir annuler la facture <strong>{invoice.ref}</strong> ? Cette action est irréversible.
                </p>
              </div>

              <div className="flex flex-row-reverse gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingAbandon}
                  className="inline-flex justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {isSubmittingAbandon ? 'Traitement...' : 'Oui, abandonner'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAbandonModal(false)}
                  className="inline-flex justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700"
                >
                  Non
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export par défaut — résolution des params asynchrones (Next.js App Router)
// ---------------------------------------------------------------------------

/**
 * Point d'entrée de la route `/billing-payments/[id]`.
 *
 * Résout les `params` asynchrones avec `use()`, puis délègue à
 * `InvoiceDetailContent` enveloppé dans `<Suspense>` (requis pour `useSearchParams`).
 */
export default function InvoiceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense
      fallback={
        <div className="text-muted flex items-center justify-center py-20 text-sm">
          Chargement...
        </div>
      }
    >
      <InvoiceDetailContent id={id} />
    </Suspense>
  );
}
