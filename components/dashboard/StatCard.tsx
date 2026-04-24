'use client';

import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatCardProps {
  /** Titre de la carte */
  label: string;
  /** Valeur principale affichée en gras */
  value: string | number;
  /** Valeur secondaire affichée en rouge (ex: montant en retard) */
  subValue?: string | number;
  /** Icône ou emoji d'illustration */
  icon: string | React.ReactNode;
  /** Texte d'aide ou détails supplémentaires en bas de carte */
  description?: string;
  /** Indicateur de tendance (évolution en %) */
  trend?: {
    value: string;
    isPositive: boolean;
  };
  /** Couleur thématique de l'icône (ex: 'text-blue-600') */
  colorClassName?: string;
  /** Lien optionnel vers une page de détail */
  href?: string;
}

// ---------------------------------------------------------------------------
// Composant Principal
// ---------------------------------------------------------------------------

/**
 * Carte d'indicateur clé (KPI) pour le dashboard.
 * Affiche une valeur, une tendance et une description avec un style premium.
 */
export default function StatCard({
  label,
  value,
  subValue,
  icon,
  description,
  trend,
  colorClassName = 'text-primary',
  href,
}: StatCardProps) {
  // --- Contenu de la carte ---
  const CardContent = (
    <div className="bg-surface border-border hover:border-primary/50 overflow-hidden rounded-xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
      {/* Icone */}
      <div className="flex items-center justify-between">
        <div
          className={`rounded-lg bg-background p-2 text-2xl ${colorClassName} ring-1 ring-inset ring-gray-500/10 dark:ring-gray-400/20`}
        >
          {icon}
        </div>
      </div>

      {/* Textes */}
      <div className="mt-4">
        <h3 className="text-muted text-sm font-medium tracking-wide uppercase">
          {label}
        </h3>
        <div className="mt-1 flex items-baseline justify-between">
          <p className="text-foreground text-2xl font-bold tracking-tight">
            {value}
            {/* Montant en retard / secondaire */}
            {subValue && (
              <span className="ml-2 text-[0.6em] font-medium text-red-400 dark:text-red-400/80">
                ({subValue})
              </span>
            )}
            {/* Tendance (↑ / ↓) */}
            {trend && (
              <span
                className={`ml-2 text-[0.6em] font-medium ${
                  trend.isPositive
                    ? 'text-green-500 dark:text-green-400'
                    : 'text-red-400 dark:text-red-400/80'
                }`}
              >
                ({trend.isPositive ? '↑' : '↓'} {trend.value})
              </span>
            )}
          </p>
        </div>

        {/* Description détaillée */}
        {description && <p className="text-muted mt-1 text-xs">{description}</p>}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  if (href) {
    return (
      <Link href={href} className="group block">
        {CardContent}
      </Link>
    );
  }

  return CardContent;
}

