"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth } from '../../utils/auth';

function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

function BoxIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
}

function ShoppingBagIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
}

function CreditCardIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
}

function LogOutIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}

const navigation = [
  { name: 'Tableau de bord', href: '/', icon: HomeIcon },
  { name: 'Tiers', href: '/third-parties', icon: UsersIcon },
  { name: 'Produits & Services', href: '/products-services', icon: BoxIcon },
  { name: 'Commerce', href: '/commerce', icon: ShoppingBagIcon },
  { name: 'Facturation & Paiement', href: '/billing-payments', icon: CreditCardIcon },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Secure dashboard route (client-side fallback/backup for middleware)
    if (!auth.isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  const handleLogout = () => {
    auth.clearAuth();
    router.push('/login');
  };

  if (!mounted) return null; // Prevent hydration mismatch

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-surface shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          <nav className="flex flex-1 items-center space-x-2 overflow-x-auto py-2 sm:space-x-4 md:space-x-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {navigation.map((item) => {
              const isActive = pathname === item.href || (pathname !== '/' && item.href !== '/' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex shrink-0 flex-col items-center justify-center border-b-2 p-2 px-3 text-xs font-medium transition-colors duration-200 sm:flex-row sm:space-x-2 sm:text-sm
                    ${isActive 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted hover:border-border hover:text-foreground'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`h-5 w-5 sm:mb-0 ${isActive ? 'text-primary' : 'text-muted'}`} />
                  <span className="mt-1 sm:mt-0">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-4 flex items-center border-l border-border pl-4 shrink-0">
            <button
              onClick={handleLogout}
              className="flex flex-col items-center justify-center p-2 text-xs font-medium text-red-600 transition-colors hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 sm:flex-row sm:space-x-2 sm:text-sm"
              aria-label="Se déconnecter"
            >
              <LogOutIcon className="h-5 w-5 sm:mb-0" />
              <span className="mt-1 sm:mt-0">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
