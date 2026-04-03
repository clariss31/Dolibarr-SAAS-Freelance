'use client';

import Link from 'next/link';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string | React.ReactNode;
  description?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  colorClassName?: string; // e.g., 'text-blue-600'
  href?: string;
}

export default function StatCard({
  label,
  value,
  icon,
  description,
  trend,
  colorClassName = 'text-primary',
  href,
}: StatCardProps) {
  const CardContent = (
    <div className="bg-surface border-border hover:border-primary/50 overflow-hidden rounded-xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
      <div className="flex items-center justify-between">
        <div className={`rounded-lg bg-background p-2 text-2xl ${colorClassName} ring-1 ring-inset ring-gray-500/10 dark:ring-gray-400/20`}>
          {icon}
        </div>
        {trend && (
          <div
            className={`flex items-center text-xs font-medium ${
              trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {trend.isPositive ? '↑' : '↓'} {trend.value}
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-muted text-sm font-medium tracking-wide uppercase">{label}</h3>
        <div className="mt-1 flex items-baseline justify-between">
          <p className="text-foreground text-2xl font-bold tracking-tight">
            {value}
          </p>
        </div>
        {description && (
          <p className="text-muted mt-1 text-xs truncate">
            {description}
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block group">
        {CardContent}
      </Link>
    );
  }

  return CardContent;
}
