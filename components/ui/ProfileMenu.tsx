'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '../../utils/auth';
import { userService } from '../../services/user';
import { User } from '../../types/dolibarr';

// Icône utilisateur (avatar)
function UserCircleIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function BuildingIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function LogOutIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/**
 * Menu déroulant de profil utilisateur.
 * Affiche les initiales ou une icône par défaut dans un avatar.
 * Les entrées du menu permettent : Mon Profil, Mon Entreprise, Déconnexion.
 */
export default function ProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Récupère le profil de l'utilisateur au montage
  useEffect(() => {
    userService.getCurrentUser().then((u) => {
      if (u) setUser(u);
    });
  }, []);

  // Ferme le menu si on clique en dehors
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ferme le menu à l'appui sur Echap
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  /** Calcule les initiales à afficher dans l'avatar */
  const getInitials = (): string => {
    if (user?.firstname && user?.lastname) {
      return `${user.firstname[0]}${user.lastname[0]}`.toUpperCase();
    }
    if (user?.login) {
      return user.login.slice(0, 2).toUpperCase();
    }
    return '?';
  };

  /** Nom complet ou identifiant de l'utilisateur */
  const getDisplayName = (): string => {
    if (user?.firstname || user?.lastname) {
      return `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim();
    }
    return user?.login ?? 'Profil';
  };

  const handleLogout = () => {
    setIsOpen(false);
    auth.clearAuth();
    userService.clearLogin();
    router.push('/login');
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Bouton déclencheur - avatar avec initiales */}
      <button
        id="profile-menu-button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="border-border bg-surface hover:bg-background focus-visible:ring-primary flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Menu de profil"
      >
        {user ? (
          <span className="text-primary text-xs font-bold">
            {getInitials()}
          </span>
        ) : (
          <UserCircleIcon className="text-muted h-5 w-5" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="profile-menu-button"
          className="border-border bg-surface ring-border/20 absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl border shadow-lg ring-1"
        >
          {/* En-tête du menu : affiche le nom & login */}
          <div className="border-border border-b px-4 py-3">
            <p className="text-foreground truncate text-sm font-semibold">
              {getDisplayName()}
            </p>
            {user?.email && (
              <p className="text-muted mt-0.5 truncate text-xs">{user.email}</p>
            )}
          </div>

          <div className="py-1">
            {/* Lien Mon Profil */}
            <Link
              href="/settings/user"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="text-foreground hover:bg-background flex items-center gap-3 px-4 py-2 text-sm transition-colors"
            >
              <UserCircleIcon className="text-muted h-4 w-4 shrink-0" />
              Profil
            </Link>

            {/* Lien Mon Entreprise */}
            <Link
              href="/settings/company"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="text-foreground hover:bg-background flex items-center gap-3 px-4 py-2 text-sm transition-colors"
            >
              <BuildingIcon className="text-muted h-4 w-4 shrink-0" />
              Entreprise
            </Link>
          </div>

          {/* Déconnexion */}
          <div className="border-border border-t py-1">
            <button
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOutIcon className="h-4 w-4 shrink-0" />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
