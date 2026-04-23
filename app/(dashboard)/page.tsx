'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../services/api';
import { getErrorMessage } from '../../utils/error-handler';
import {
  Invoice,
  Proposal,
  Product,
  ThirdParty,
  Organization,
} from '../../types/dolibarr';
import StatCard from '../../components/dashboard/StatCard';
import PeriodFilter, { Period } from '../../components/dashboard/PeriodFilter';

export default function DashboardRootPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Period State
  const [period, setPeriod] = useState<Period>({ type: 'month' });

  // Company State
  const [isTvaAssuj, setIsTvaAssuj] = useState(true);

  // KPI States
  const [stats, setStats] = useState({
    caHT: 0,
    caHTPrevious: 0,
    caTTC: 0,
    caTVA: 0,
    unpaidInvoicesHT: 0,
    unpaidInvoicesTTC: 0,
    unpaidInvoicesTVA: 0,
    unpaidInvoicesOverdueHT: 0,
    pendingProposalsHT: 0,
    pendingProposalsTTC: 0,
    pendingProposalsTVA: 0,
    upcomingSupplierHT: 0,
    upcomingSupplierTTC: 0,
    upcomingSupplierTVA: 0,
    upcomingSupplierOverdueHT: 0,
  });

  // Recent Activity States
  const [recentThirdParties, setRecentThirdParties] = useState<ThirdParty[]>(
    []
  );
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [recentServices, setRecentServices] = useState<Product[]>([]);
  const [recentProposals, setRecentProposals] = useState<Proposal[]>([]);
  const [recentClientInvoices, setRecentClientInvoices] = useState<Invoice[]>(
    []
  );
  const [recentSupplierInvoices, setRecentSupplierInvoices] = useState<
    Invoice[]
  >([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError('');
      try {
        const now = new Date();
        let startTs = 0;
        let endTs = Math.floor(now.getTime() / 1000);

        if (period.type === 'week') {
          startTs = Math.floor(
            new Date(now.getTime() - 7 * 24 * 3600 * 1000).getTime() / 1000
          );
        } else if (period.type === 'month') {
          startTs = Math.floor(
            new Date(now.getTime() - 30 * 24 * 3600 * 1000).getTime() / 1000
          );
        } else if (period.type === 'year') {
          startTs = Math.floor(
            new Date(now.getTime() - 365 * 24 * 3600 * 1000).getTime() / 1000
          );
        } else if (
          period.type === 'custom' &&
          period.startDate &&
          period.endDate
        ) {
          startTs = Math.floor(period.startDate.getTime() / 1000);
          endTs = Math.floor(period.endDate.getTime() / 1000) + 86399;
        } else {
          startTs = Math.floor(
            new Date(now.getTime() - 30 * 24 * 3600 * 1000).getTime() / 1000
          );
        }

        let prevStartTs = 0;
        let prevEndTs = 0;

        if (period.type === 'week') {
          prevEndTs = startTs - 1;
          prevStartTs = prevEndTs - 7 * 24 * 3600 + 1;
        } else if (period.type === 'month') {
          prevEndTs = startTs - 1;
          prevStartTs = prevEndTs - 30 * 24 * 3600 + 1;
        } else if (period.type === 'year') {
          prevEndTs = startTs - 1;
          prevStartTs = prevEndTs - 365 * 24 * 3600 + 1;
        } else if (
          period.type === 'custom' &&
          period.startDate &&
          period.endDate
        ) {
          const delta = endTs - startTs + 1;
          prevEndTs = startTs - 1;
          prevStartTs = prevEndTs - delta + 1;
        } else {
          prevEndTs = startTs - 1;
          prevStartTs = prevEndTs - 30 * 24 * 3600 + 1;
        }

        const [
          invoicesKpiRes,
          proposalsKpiRes,
          supplierKpiRes,
          thirdPartiesRes,
          productsRes,
          servicesRes,
          proposalsRes,
          clientInvoicesRes,
          supplierInvoicesRes,
          companyRes,
        ] = await Promise.allSettled([
          api.get('/invoices?limit=1000&sortfield=t.datec&sortorder=DESC'),
          api.get('/proposals?limit=100&sqlfilters=(t.fk_statut:=:1)'),
          api.get('/supplierinvoices?limit=100&sqlfilters=(t.fk_statut:=:1)'),
          api.get('/thirdparties?limit=5&sortfield=t.tms&sortorder=DESC'),
          api.get('/products?limit=5&sortfield=t.tms&sortorder=DESC&mode=1'),
          api.get('/products?limit=5&sortfield=t.tms&sortorder=DESC&mode=2'),
          api.get('/proposals?limit=5&sortfield=t.tms&sortorder=DESC'),
          api.get('/invoices?limit=5&sortfield=t.tms&sortorder=DESC'),
          api.get('/supplierinvoices?limit=5&sortfield=t.tms&sortorder=DESC'),
          api.get('/setup/company'),
        ]);

        const nowTs = Math.floor(Date.now() / 1000);

        const newStats = {
          caHT: 0,
          caHTPrevious: 0,
          caTTC: 0,
          caTVA: 0,
          unpaidInvoicesHT: 0,
          unpaidInvoicesTTC: 0,
          unpaidInvoicesTVA: 0,
          unpaidInvoicesOverdueHT: 0,
          pendingProposalsHT: 0,
          pendingProposalsTTC: 0,
          pendingProposalsTVA: 0,
          upcomingSupplierHT: 0,
          upcomingSupplierTTC: 0,
          upcomingSupplierTVA: 0,
          upcomingSupplierOverdueHT: 0,
        };

        if (
          invoicesKpiRes.status === 'fulfilled' &&
          invoicesKpiRes.value.data
        ) {
          const invs: Invoice[] = invoicesKpiRes.value.data;

          const currentInvs = invs.filter(
            (inv) =>
              inv.date &&
              Number(inv.date) >= startTs &&
              Number(inv.date) <= endTs &&
              Number(inv.statut) > 0
          );

          newStats.caHT = currentInvs.reduce(
            (acc, inv) => acc + Number(inv.total_ht || 0),
            0
          );
          newStats.caTTC = currentInvs.reduce(
            (acc, inv) => acc + Number(inv.total_ttc || 0),
            0
          );
          newStats.caTVA = newStats.caTTC - newStats.caHT;

          newStats.caHTPrevious = invs
            .filter(
              (inv) =>
                inv.date &&
                Number(inv.date) >= prevStartTs &&
                Number(inv.date) <= prevEndTs &&
                Number(inv.statut) > 0
            )
            .reduce((acc, inv) => acc + Number(inv.total_ht || 0), 0);

          const unpaid = invs.filter((inv) => Number(inv.statut) === 1);
          newStats.unpaidInvoicesHT = unpaid.reduce(
            (acc, inv) => acc + Number(inv.total_ht || 0),
            0
          );
          newStats.unpaidInvoicesTTC = unpaid.reduce(
            (acc, inv) => acc + Number(inv.total_ttc || 0),
            0
          );
          newStats.unpaidInvoicesTVA =
            newStats.unpaidInvoicesTTC - newStats.unpaidInvoicesHT;

          newStats.unpaidInvoicesOverdueHT = unpaid
            .filter((inv) =>
              isOverdue(
                inv.datelimit || inv.date_lim_reglement || inv.date_echeance,
                nowTs
              )
            )
            .reduce((acc, inv) => acc + Number(inv.total_ht || 0), 0);
        }

        if (
          proposalsKpiRes.status === 'fulfilled' &&
          proposalsKpiRes.value.data
        ) {
          const props: Proposal[] = proposalsKpiRes.value.data;
          newStats.pendingProposalsHT = props.reduce(
            (acc, prop) => acc + Number(prop.total_ht || 0),
            0
          );
          newStats.pendingProposalsTTC = props.reduce(
            (acc, prop) => acc + Number(prop.total_ttc || 0),
            0
          );
          newStats.pendingProposalsTVA =
            newStats.pendingProposalsTTC - newStats.pendingProposalsHT;
        }

        if (
          supplierKpiRes.status === 'fulfilled' &&
          supplierKpiRes.value.data
        ) {
          const sInvs: Invoice[] = supplierKpiRes.value.data;
          const upcoming = sInvs.filter((inv) => Number(inv.statut) === 1);

          newStats.upcomingSupplierHT = upcoming.reduce(
            (acc, inv) => acc + Number(inv.total_ht || 0),
            0
          );
          newStats.upcomingSupplierTTC = upcoming.reduce(
            (acc, inv) => acc + Number(inv.total_ttc || 0),
            0
          );
          newStats.upcomingSupplierTVA =
            newStats.upcomingSupplierTTC - newStats.upcomingSupplierHT;

          newStats.upcomingSupplierOverdueHT = upcoming
            .filter((inv) =>
              isOverdue(
                inv.datelimit || inv.date_lim_reglement || inv.date_echeance,
                nowTs
              )
            )
            .reduce((acc, inv) => acc + Number(inv.total_ht || 0), 0);
        }

        setStats(newStats);

        // Process Lists
        if (thirdPartiesRes.status === 'fulfilled')
          setRecentThirdParties(thirdPartiesRes.value.data || []);
        if (productsRes.status === 'fulfilled')
          setRecentProducts(productsRes.value.data || []);
        if (servicesRes.status === 'fulfilled')
          setRecentServices(servicesRes.value.data || []);
        if (proposalsRes.status === 'fulfilled')
          setRecentProposals(proposalsRes.value.data || []);
        if (clientInvoicesRes.status === 'fulfilled')
          setRecentClientInvoices(clientInvoicesRes.value.data || []);
        if (supplierInvoicesRes.status === 'fulfilled')
          setRecentSupplierInvoices(supplierInvoicesRes.value.data || []);

        if (companyRes.status === 'fulfilled' && companyRes.value.data) {
          const org = companyRes.value.data as Organization;
          setIsTvaAssuj(String(org.tva_assuj) === '1');
        }

        // If many critical requests failed, show a warning
        const failures = [
          invoicesKpiRes,
          proposalsKpiRes,
          supplierKpiRes,
        ].filter((r) => r.status === 'rejected');
        if (failures.length >= 2) {
          setError(
            "Certaines données n'ont pas pu être récupérées. Le service est peut-être ralenti."
          );
        }
      } catch (err: unknown) {
        console.error('Error fetching dashboard data:', err);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [period]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const isOverdue = (
    limitStr: string | number | undefined,
    nowSeconds: number
  ) => {
    if (!limitStr) return false;
    let parsedTs = 0;
    if (typeof limitStr === 'string' && limitStr.includes('-')) {
      // Handles '2026-04-01' or '2026-04-01 00:00:00'
      const millis = new Date(limitStr).getTime();
      if (!isNaN(millis)) {
        parsedTs = Math.floor(millis / 1000);
      }
    } else {
      parsedTs = Number(limitStr);
      // Dolibarr returns seconds, but if it has more than 10 digits it might be ms
      if (parsedTs > 10000000000) parsedTs = Math.floor(parsedTs / 1000);
    }
    return parsedTs > 0 && parsedTs < nowSeconds;
  };

  const formatDate = (timestamp: number | string | undefined) => {
    if (!timestamp) return '-';
    const numTs = Number(timestamp);
    if (isNaN(numTs)) return '-';
    const ms = numTs < 10000000000 ? numTs * 1000 : numTs;
    // Format Jour/Mois/Année (YY)
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(new Date(ms));
  };

  const RecentList = ({
    title,
    items,
    type,
    createLink,
  }: {
    title: string;
    items: any[];
    type:
      | 'thirdparty'
      | 'product'
      | 'proposal'
      | 'client-invoice'
      | 'supplier-invoice';
    createLink?: string;
  }) => {
    const getLink = (item: any) => {
      switch (type) {
        case 'thirdparty':
          return `/third-parties/${item.id}`;
        case 'product':
          return `/products-services/${item.id}`;
        case 'proposal':
          return `/commerce/${item.id}`;
        case 'client-invoice':
          return `/billing-payments/${item.id}?type=client`;
        case 'supplier-invoice':
          return `/billing-payments/${item.id}?type=supplier`;
      }
    };

    const getStatusColor = (status: string | number) => {
      const s = String(status);
      switch (s) {
        case '1':
          return 'bg-amber-100 text-amber-700'; // Impayée / Ouvert
        case '2':
          return 'bg-emerald-100 text-emerald-700'; // Payée / Signé
        case '3':
          return 'bg-red-100 text-red-700'; // Abandonnée / Non signé
        case '4':
          return 'bg-purple-100 text-purple-700'; // Facturé
        case '0':
        default:
          return 'bg-gray-100 text-gray-600'; // Brouillon
      }
    };

    const isDetailed =
      type === 'proposal' ||
      type === 'client-invoice' ||
      type === 'supplier-invoice';

    return (
      <div className="bg-surface border-border flex h-full flex-col overflow-hidden rounded-xl border shadow-sm">
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
          {createLink && (
            <Link
              href={createLink}
              className="btn-primary flex h-6 w-6 items-center justify-center rounded-md p-0 text-sm font-bold"
              title="Créer nouveau"
            >
              +
            </Link>
          )}
        </div>
        <div className="flex-1 divide-y divide-gray-100 dark:divide-gray-800">
          {items.length === 0 ? (
            <p className="text-muted px-5 py-8 text-center text-xs italic">
              Aucune donnée récente
            </p>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={getLink(item)}
                className="group block px-5 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <div className="flex items-center">
                  <div className="min-w-0 flex-1">
                    {isDetailed ? (
                      <div className="flex items-center space-x-6">
                        <span className="text-foreground group-hover:text-primary min-w-[80px] flex-1 truncate text-sm font-medium transition-colors">
                          {item.ref}
                        </span>
                        <div className="flex items-center space-x-8 text-xs whitespace-nowrap">
                          <span className="text-foreground min-w-[75px] text-right font-semibold">
                            {formatCurrency(Number(item.total_ht || 0))}
                          </span>
                          <span className="text-muted min-w-[65px] text-center">
                            {formatDate(
                              item.fin_validite ||
                                item.datelimit ||
                                item.date_lim_reglement ||
                                item.date_echeance ||
                                item.date
                            )}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${getStatusColor(
                              item.statut
                            )}`}
                          >
                            ●
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-foreground group-hover:text-primary truncate text-sm font-medium transition-colors">
                        {item.name || item.nom || item.label || 'Sans nom'}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <span className="text-muted group-hover:text-primary text-sm transition-colors">
                      →
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">
            Tableau de bord
          </h1>
          <p className="text-muted mt-2 text-sm">
            Chargement de vos indicateurs...
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-surface border-border h-32 animate-pulse rounded-xl border shadow-sm"
            ></div>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-surface border-border h-64 animate-pulse rounded-xl border shadow-sm"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold tracking-tight">
            Tableau de bord
          </h1>
          <p className="text-muted mt-2 text-sm">
            Aperçu global de votre activité freelance
          </p>
        </div>
        <PeriodFilter period={period} onChange={setPeriod} />
      </div>

      {error && (
        <div 
          className="animate-in fade-in slide-in-from-top-2 rounded-lg border border-red-900/50 bg-[#2d1414] p-4 text-sm font-medium text-[#ff6b6b] shadow-lg duration-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* KPI Section */}
      {(() => {
        let caTrend;
        if (stats.caHTPrevious > 0) {
          const change =
            ((stats.caHT - stats.caHTPrevious) / stats.caHTPrevious) * 100;
          caTrend = {
            value: `${Math.abs(change).toFixed(1)} %`,
            isPositive: change >= 0,
          };
        } else if (stats.caHT > 0) {
          caTrend = {
            value: `100 %`,
            isPositive: true,
          };
        }

        return (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Chiffre d'affaires HT"
              value={formatCurrency(stats.caHT)}
              trend={caTrend}
              icon="📈"
              colorClassName="text-blue-600"
              description={
                isTvaAssuj
                  ? `${formatCurrency(stats.caTTC)} TTC - ${formatCurrency(stats.caTVA)} TVA`
                  : undefined
              }
            />
            <StatCard
              label="Devis en attente HT"
              value={formatCurrency(stats.pendingProposalsHT)}
              icon="📄"
              colorClassName="text-purple-600"
              description={
                isTvaAssuj
                  ? `${formatCurrency(stats.pendingProposalsTTC)} TTC - ${formatCurrency(stats.pendingProposalsTVA)} TVA`
                  : undefined
              }
              href="/commerce"
            />
            <StatCard
              label="Factures clients impayées HT"
              value={formatCurrency(stats.unpaidInvoicesHT)}
              subValue={
                stats.unpaidInvoicesOverdueHT > 0
                  ? formatCurrency(stats.unpaidInvoicesOverdueHT)
                  : undefined
              }
              icon="⏳"
              colorClassName="text-amber-600"
              description={
                isTvaAssuj
                  ? `${formatCurrency(stats.unpaidInvoicesTTC)} TTC - ${formatCurrency(stats.unpaidInvoicesTVA)} TVA`
                  : undefined
              }
              href="/billing-payments?tab=client"
            />
            <StatCard
              label="Factures fourn. impayées HT"
              value={formatCurrency(stats.upcomingSupplierHT)}
              subValue={
                stats.upcomingSupplierOverdueHT > 0
                  ? formatCurrency(stats.upcomingSupplierOverdueHT)
                  : undefined
              }
              icon="💳"
              colorClassName="text-red-600"
              description={
                isTvaAssuj
                  ? `${formatCurrency(stats.upcomingSupplierTTC)} TTC - ${formatCurrency(stats.upcomingSupplierTVA)} TVA`
                  : undefined
              }
              href="/billing-payments?tab=supplier"
            />
          </div>
        );
      })()}

      {/* Recent Activity Section */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <RecentList
            title="Derniers tiers"
            items={recentThirdParties}
            type="thirdparty"
            createLink="/third-parties/create"
          />
          <RecentList
            title="Derniers devis"
            items={recentProposals}
            type="proposal"
            createLink="/commerce/create"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <RecentList
            title="Derniers produits"
            items={recentProducts}
            type="product"
            createLink="/products-services/create?type=0"
          />
          <RecentList
            title="Derniers services"
            items={recentServices}
            type="product"
            createLink="/products-services/create?type=1"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <RecentList
            title="Dernières factures clients"
            items={recentClientInvoices}
            type="client-invoice"
            createLink="/billing-payments/create?type=client"
          />
          <RecentList
            title="Dernières factures fournisseurs"
            items={recentSupplierInvoices}
            type="supplier-invoice"
            createLink="/billing-payments/create?type=supplier"
          />
        </div>
      </div>
    </div>
  );
}
