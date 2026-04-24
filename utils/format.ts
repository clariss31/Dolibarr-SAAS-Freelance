/**
 * Formate un montant en Euros.
 */
export function formatCurrency(amount: string | number | undefined): string {
  const numericAmount = Number(amount) || 0;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(numericAmount);
}

/**
 * Formate un timestamp Dolibarr (secondes) en date lisible (DD/MM/YYYY).
 */
export function formatDate(timestamp: number | string | undefined): string {
  if (!timestamp) return '-';
  const numTs = Number(timestamp);
  if (isNaN(numTs)) return '-';

  // Détection : Dolibarr = secondes (< 10^10), JS = millisecondes
  const ms = numTs < 10000000000 ? numTs * 1000 : numTs;
  const date = new Date(ms);

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Convertit un timestamp (secondes) en chaîne YYYY-MM-DD pour les inputs HTML5.
 */
export function timestampToDateString(ts: string | number | undefined): string {
  if (!ts) return '';
  const numTs = Number(ts);
  if (isNaN(numTs)) return '';

  const ms = numTs < 10000000000 ? numTs * 1000 : numTs;
  const date = new Date(ms);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Convertit une chaîne YYYY-MM-DD en timestamp (secondes).
 */
export function dateStringToTimestamp(dateStr: string): number | null {
  if (!dateStr) return null;
  // Utiliser midi pour éviter les décalages de fuseau horaire
  return Math.floor(new Date(dateStr + 'T12:00:00').getTime() / 1000);
}

/**
 * Calcule le nombre de jours entre deux dates au format YYYY-MM-DD.
 */
export function calculateDaysDiff(
  dateStartStr: string,
  dateEndStr: string
): number {
  if (!dateStartStr || !dateEndStr) return 0;
  const start = new Date(dateStartStr + 'T12:00:00');
  const end = new Date(dateEndStr + 'T12:00:00');
  const diffTime = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Formate un taux de TVA ou un pourcentage en supprimant les zéros inutiles à droite.
 */
export function formatVat(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '0 %';
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('fr-FR').format(num) + ' %';
}
