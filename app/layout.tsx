import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// ---------------------------------------------------------------------------
// Configuration de la typographie (Font Optimization)
// ---------------------------------------------------------------------------

/**
 * On utilise Inter comme police par défaut pour un rendu moderne et professionnel.
 * Next.js optimise automatiquement le chargement pour éviter le "Layout Shift".
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

// ---------------------------------------------------------------------------
// Métadonnées (SEO & Browser Tab)
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'DoliFree SaaS - Dolibarr pour Freelance',
  description:
    'Interface moderne et performante pour gérer votre activité freelance via Dolibarr.',
};

// ---------------------------------------------------------------------------
// Layout Racine (Root Layout)
// ---------------------------------------------------------------------------

/**
 * Ce fichier est le point d'entrée structurel de TOUTE l'application.
 * 
 * Rôles principaux :
 * 1. Définit les balises <html> et <body> (indispensables).
 * 2. Injecte les styles globaux (globals.css).
 * 3. Applique les classes utilitaires globales (ex: dark mode, antialiasing).
 * 4. Sert de parent à tous les autres layouts (auth, dashboard).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="bg-background min-h-full font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}

