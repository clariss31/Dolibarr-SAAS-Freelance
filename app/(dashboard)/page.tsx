'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../services/api';
import { getErrorMessage } from '../../utils/error-handler';
import { Invoice, Proposal, Product, ThirdParty } from '../../types/dolibarr';
import StatCard from '../../components/dashboard/StatCard';

export default function DashboardRootPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // KPI States
  const [stats, setStats] = useState({
    caMonthHT: 0,
    unpaidInvoicesCount: 0,
    pendingProposalsHT: 0,
    upcomingSupplierHT: 0,
  });

  // Recent Activity States
  const [recentThirdParties, setRecentThirdParties] = useState<ThirdParty[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [recentServices, setRecentServices] = useState<Product[]>([]);
  const [recentProposals, setRecentProposals] = useState<Proposal[]>([]);
  const [recentClientInvoices, setRecentClientInvoices] = useState<Invoice[]>([]);
  const [recentSupplierInvoices, setRecentSupplierInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError('');
      try {
        const now = new Date();
        // Month boundary for current month's CA
        const year = now.getFullYear();
        const month = now.getMonth();
        const startOfMonth = new Date(year, month, 1, 0, 0, 0);
        const startOfMonthTs = Math.floor(startOfMonth.getTime() / 1000);

        // We fetch KPIs and Lists using allSettled to ensure failure of one doesn't kill the whole page
        const [
          invoicesKpiRes,
          proposalsKpiRes,
          supplierKpiRes,
          thirdPartiesRes,
          productsRes,
          servicesRes,
          proposalsRes,
          clientInvoicesRes,
          supplierInvoicesRes
        ] = await Promise.allSettled([
          api.get('/invoices?limit=200&sortfield=t.datec&sortorder=DESC'),
          api.get('/proposals?limit=100&sqlfilters=(t.fk_statut:=:1)'),
          api.get('/supplierinvoices?limit=100&sqlfilters=(t.fk_statut:=:1)'),
          api.get('/thirdparties?limit=5&sortfield=t.tms&sortorder=DESC'),
          api.get('/products?limit=5&sortfield=t.tms&sortorder=DESC&mode=1'),
          api.get('/products?limit=5&sortfield=t.tms&sortorder=DESC&mode=2'),
          api.get('/proposals?limit=5&sortfield=t.tms&sortorder=DESC'),
          api.get('/invoices?limit=5&sortfield=t.tms&sortorder=DESC'),
          api.get('/supplierinvoices?limit=5&sortfield=t.tms&sortorder=DESC'),
        ]);

        // Process results
        const newStats = { caMonthHT: 0, unpaidInvoicesCount: 0, pendingProposalsHT: 0, upcomingSupplierHT: 0 };
        
        if (invoicesKpiRes.status === 'fulfilled' && invoicesKpiRes.value.data) {
          const invs: Invoice[] = invoicesKpiRes.value.data;
          newStats.caMonthHT = invs
            .filter((inv) => inv.date && Number(inv.date) >= startOfMonthTs && Number(inv.statut) > 0)
            .reduce((acc, inv) => acc + Number(inv.total_ht || 0), 0);
          newStats.unpaidInvoicesCount = invs.filter((inv) => Number(inv.statut) === 1).length;
        }

        if (proposalsKpiRes.status === 'fulfilled' && proposalsKpiRes.value.data) {
          const props: Proposal[] = proposalsKpiRes.value.data;
          newStats.pendingProposalsHT = props.reduce((acc, prop) => acc + Number(prop.total_ht || 0), 0);
        }

        if (supplierKpiRes.status === 'fulfilled' && supplierKpiRes.value.data) {
          const sInvs: Invoice[] = supplierKpiRes.value.data;
          newStats.upcomingSupplierHT = sInvs.reduce((acc, inv) => acc + Number(inv.total_ht || 0), 0);
        }

        setStats(newStats);

        // Process Lists
        if (thirdPartiesRes.status === 'fulfilled') setRecentThirdParties(thirdPartiesRes.value.data || []);
        if (productsRes.status === 'fulfilled') setRecentProducts(productsRes.value.data || []);
        if (servicesRes.status === 'fulfilled') setRecentServices(servicesRes.value.data || []);
        if (proposalsRes.status === 'fulfilled') setRecentProposals(proposalsRes.value.data || []);
        if (clientInvoicesRes.status === 'fulfilled') setRecentClientInvoices(clientInvoicesRes.value.data || []);
        if (supplierInvoicesRes.status === 'fulfilled') setRecentSupplierInvoices(supplierInvoicesRes.value.data || []);

        // If many critical requests failed, show a warning
        const failures = [invoicesKpiRes, proposalsKpiRes, supplierKpiRes].filter(r => r.status === 'rejected');
        if (failures.length >= 2) {
           setError("Certaines données n'ont pas pu être récupérées. Le service est peut-être ralenti.");
        }

      } catch (err: unknown) {
        console.error('Error fetching dashboard data:', err);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
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
  }: {
    title: string;
    items: any[];
    type:
      | 'thirdparty'
      | 'product'
      | 'proposal'
      | 'client-invoice'
      | 'supplier-invoice';
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
      <div className="bg-surface border-border flex flex-col overflow-hidden rounded-xl border h-full shadow-sm">
        <div className="border-border border-b px-5 py-4">
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
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
                        <span className="text-foreground text-sm font-medium truncate min-w-[80px] flex-1 transition-colors group-hover:text-primary">
                          {item.ref}
                        </span>
                        <div className="flex items-center space-x-8 whitespace-nowrap text-xs">
                          <span className="text-foreground min-w-[75px] text-right font-semibold">
                            {formatCurrency(Number(item.total_ht || 0))}
                          </span>
                          <span className="text-muted min-w-[65px] text-center">
                            {formatDate(
                              item.fin_validite ||
                                item.datelimit ||
                                item.date_lim_reglement ||
                                item.date
                            )}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(
                              item.statut
                            )}`}
                          >
                            ●
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-foreground text-sm font-medium truncate transition-colors group-hover:text-primary">
                        {item.name || item.nom || item.label || 'Sans nom'}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <span className="text-muted text-sm transition-colors group-hover:text-primary">
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
          <h1 className="text-foreground text-3xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted mt-2 text-sm">Chargement de vos indicateurs...</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface border-border h-32 animate-pulse rounded-xl border shadow-sm"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mt-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface border-border h-64 animate-pulse rounded-xl border shadow-sm"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted mt-2 text-sm">Aperçu global de votre activité freelance</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 ring-1 ring-red-600/20 ring-inset dark:bg-red-900/30">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* KPI Section */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="CA HT (Mois)"
          value={formatCurrency(stats.caMonthHT)}
          icon="📈"
          colorClassName="text-blue-600"
          description="Chiffre d'affaires facturé ce mois"
        />
        <StatCard
          label="Factures impayées"
          value={stats.unpaidInvoicesCount}
          icon="⏳"
          colorClassName="text-amber-600"
          description="Factures clients en attente de règlement"
          href="/billing-payments"
        />
        <StatCard
          label="Devis en attente"
          value={formatCurrency(stats.pendingProposalsHT)}
          icon="📄"
          colorClassName="text-purple-600"
          description="Total des propositions ouvertes"
          href="/commerce"
        />
        <StatCard
          label="Échéances fournisseurs"
          value={formatCurrency(stats.upcomingSupplierHT)}
          icon="💳"
          colorClassName="text-red-600"
          description="Montant total à régler aux fournisseurs"
          href="/billing-payments"
        />
      </div>

      {/* Recent Activity Section */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <RecentList title="Derniers Tiers" items={recentThirdParties} type="thirdparty" />
          <RecentList title="Derniers Devis" items={recentProposals} type="proposal" />
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <RecentList title="Derniers Produits" items={recentProducts} type="product" />
          <RecentList title="Derniers Services" items={recentServices} type="product" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <RecentList title="Dernières Factures Clients" items={recentClientInvoices} type="client-invoice" />
          <RecentList title="Dernières Factures Fournisseurs" items={recentSupplierInvoices} type="supplier-invoice" />
        </div>
      </div>
    </div>
  );
}
