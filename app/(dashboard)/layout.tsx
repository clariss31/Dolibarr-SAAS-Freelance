"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth } from '../../utils/auth';
import ProfileMenu from '../../components/ui/ProfileMenu';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Icones SVG
// ---------------------------------------------------------------------------

function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BoxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function ShoppingBagIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function CreditCardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const navigation = [
  { name: 'Tableau de bord', href: '/', icon: HomeIcon },
  { name: 'Tiers', href: '/third-parties', icon: UsersIcon },
  { name: 'Produits & Services', href: '/products-services', icon: BoxIcon },
  { name: 'Commerce', href: '/commerce', icon: ShoppingBagIcon },
  {
    name: 'Facturation & Paiement',
    href: '/billing-payments',
    icon: CreditCardIcon,
  },
];

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

/**
 * Layout racine du dashboard.
 * Gère l'authentification globale, la navigation principale (Desktop/Mobile)
 * et l'affichage du menu profil.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- Initialisation ---

  useEffect(() => {
    setMounted(true);
    if (!auth.isAuthenticated()) {
      router.push('/login');
    }
  }, [router]);

  // Fermer le menu mobile lors d'un changement de route
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-surface shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-muted hover:text-foreground inline-flex items-center justify-center rounded-md p-2 transition-colors lg:hidden"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">Ouvrir le menu</span>
              {isMenuOpen ? (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>

            {/* Desktop Navigation */}
            <nav
              className="hidden h-full lg:flex lg:items-center lg:space-x-8"
              aria-label="Navigation principale"
            >
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (pathname !== '/' &&
                    item.href !== '/' &&
                    pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative flex h-full items-center space-x-2 px-1 text-sm font-medium transition-all duration-200
                      ${
                        isActive
                          ? 'text-primary'
                          : 'text-muted hover:text-foreground'
                      }
                    `}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        isActive ? 'text-primary' : 'text-muted'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{item.name}</span>

                    {/* Active Indicator (Underline) */}
                    {isActive && (
                      <div className="absolute bottom-[-10px] left-0 right-0 h-0.5 bg-primary" />
                    )}
                    {!isActive && (
                      <div className="absolute bottom-[-10px] left-0 right-0 h-0.5 bg-transparent transition-colors duration-200 hover:bg-border" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Profil Menu */}
          <div className="flex shrink-0 items-center gap-4">
            <ProfileMenu />
          </div>
        </div>

        {/* Mobile Menu Panel */}
        {isMenuOpen && (
          <div className="border-t border-border bg-surface lg:hidden">
            <nav className="space-y-1 px-4 py-3" aria-label="Navigation mobile">
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (pathname !== '/' &&
                    item.href !== '/' &&
                    pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center space-x-3 rounded-xl px-4 py-3 text-base font-medium transition-all
                      ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted hover:bg-muted/5 hover:text-foreground'
                      }
                    `}
                  >
                    <Icon
                      className={`h-6 w-6 ${
                        isActive ? 'text-primary' : 'text-muted'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

