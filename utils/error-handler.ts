import { ApiError } from '../types/dolibarr';

/**
 * Traduit une erreur inconnue ou une ApiError en message compréhensible en français.
 * @param error L'objet d'erreur capturé.
 * @param context Facultatif, permet d'affiner le message (ex: 'login').
 * @returns Un message d'erreur clair pour l'utilisateur.
 */
export function getErrorMessage(error: unknown, context?: string): string {
  const apiErr = error as ApiError;
  const status = apiErr.response?.status;
  
  // Extraction plus robuste du message (Dolibarr peut varier selon la config)
  const data = apiErr.response?.data as any;
  const apiMessage = data?.error?.message || data?.message || (Array.isArray(data) ? data[0]?.message : null);
  
  // Logique de secours : on cherche des mots clés dans tout l'objet data s'il est présent
  const rawDataString = data ? JSON.stringify(data).toLowerCase() : '';

  // 1. Détection prioritaire des messages de stock (même si status 503)
  if (rawDataString.includes('stocknegativforbidden') || 
      rawDataString.includes('stock cannot be negative') ||
      rawDataString.includes('stocklevelnotenough')) {
    return "La quantité de produits dans l'entrepôt de départ n'est pas suffisante et votre configuration n'autorise pas un stock négatif";
  }

  // 2. Détection des messages spécifiques renvoyés par l'API
  if (apiMessage && apiMessage.length < 250) {
    const msg = apiMessage.toLowerCase();
    
    // Autres traductions à la volée
    if (msg.includes('access denied')) return "Accès refusé. Vous n'avez pas les droits nécessaires.";
    if (msg.includes('is required')) {
      return `Le champ "${apiMessage.split(' ')[1] || 'requis'}" est obligatoire.`;
    }
  }

  // 3. Cas spécifiques au contexte (Login, Stock, etc.)
  if (context === 'login') {
    if (status === 403) {
      return "Identifiants incorrects. Vérifiez votre identifiant et votre mot de passe.";
    }
  }

  if (context === 'stock') {
    if (status === 503 || status === 500 || status === 400) {
      return "La quantité de produits dans l'entrepôt de départ n'est pas suffisante et votre configuration n'autorise pas un stock négatif";
    }
  }

  // 4. Mapping général par code de statut HTTP
  switch (status) {
    case 401:
      return "Votre session a expiré. Veuillez vous reconnecter pour continuer.";
    case 403:
      return "Accès restreint. Vous n'avez pas les droits nécessaires pour effectuer cette action.";
    case 404:
      return "La ressource demandée semble avoir été déplacée ou supprimée.";
    case 503:
      // On ne renvoie le message générique 503 QUE si on n'a rien trouvé de plus précis avant
      return "Le service est temporairement indisponible. Veuillez réessayer dans quelques minutes.";
  }

  // 5. Gestion des erreurs réseau
  if (error instanceof Error) {
    if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
      return "Impossible d'établir une connexion avec le serveur. Vérifiez votre accès internet.";
    }
  }

  return apiMessage || "Une erreur inattendue est survenue. Veuillez rafraîchir la page.";
}
