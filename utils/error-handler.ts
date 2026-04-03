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
  const apiMessage = apiErr.response?.data?.error?.message;

  // 1. Cas spécifiques au contexte
  if (context === 'login') {
    if (status === 403) {
      return "Identifiants incorrects. Vérifiez votre identifiant et votre mot de passe.";
    }
    if (status === 404) {
      return "L'URL de l'API Dolibarr semble incorrecte. Veuillez contacter votre administrateur.";
    }
  }

  // 2. Mapping général par code de statut
  switch (status) {
    case 401:
      return "Votre session a expiré. Veuillez vous reconnecter pour continuer.";
    case 403:
      return "Accès restreint. Vous n'avez pas les droits nécessaires pour effectuer cette action.";
    case 404:
      return "La ressource demandée semble avoir été déplacée ou supprimée.";
    case 500:
      return "Le serveur rencontre une erreur inattendue. Nos équipes techniques ont été prévenues.";
    case 503:
      return "Le service est temporairement indisponible. Veuillez réessayer dans quelques minutes.";
  }

  // 3. Gestion des erreurs réseau (quand pas de status)
  if (error instanceof Error) {
    if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
      return "Impossible d'établir une connexion avec le serveur. Vérifiez votre accès internet.";
    }
    
    // Si l'API renvoie un message spécifique mais qu'il n'est pas mappé ci-dessus, 
    // on peut l'afficher s'il semble compréhensible, sinon on met un message générique.
    if (apiMessage && apiMessage.length < 100) {
       // On peut tenter une traduction simple de certains termes techniques courants de Dolibarr
       return apiMessage
         .replace('Access denied', 'Accès refusé')
         .replace('Field', 'Le champ')
         .replace('is required', 'est obligatoire');
    }
  }

  return "Une erreur inattendue est survenue. Veuillez rafraîchir la page.";
}
