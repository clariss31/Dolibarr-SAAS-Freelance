/**
 * @file proxy.ts
 * 
 * Middleware de sécurité et de redirection pour l'application.
 * 
 * Ce fichier gère la protection des routes en vérifiant la présence d'un jeton 
 * d'authentification Dolibarr dans les cookies de la requête.
 * 
 * Logique de redirection :
 * 1. Accès à /login avec un token valide -> Redirection vers l'accueil (/).
 * 2. Accès à une page protégée sans token -> Redirection vers /login.
 * 3. Assets publics (images, _next, favicon) -> Toujours autorisés.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Fonction principale du middleware.
 * 
 * @param request - La requête entrante Next.js.
 * @returns La réponse Next.js (redirection ou passage au suivant).
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get('dolibarr_token')?.value;
  const { pathname } = request.nextUrl;

  // 1. Redirection des utilisateurs déjà connectés
  // Si l'utilisateur est sur la page de login mais possède déjà un jeton valide.
  if (pathname.startsWith('/login') && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. Vérification des droits d'accès
  // On identifie si la route demandée est publique ou nécessite un jeton.
  const isAuthPage = pathname.startsWith('/login');
  const isPublicAsset = pathname.match(/\.(.*)$/) || pathname.startsWith('/_next');

  // Si pas de jeton et que la page n'est pas publique, redirection vers le login.
  if (!token && !isAuthPage && !isPublicAsset) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * Configuration du matcher pour le middleware.
 * Exclut les routes API et les fichiers statiques de base pour optimiser les performances.
 */
export const config = {
  matcher: [
    /*
     * Match tous les chemins sauf :
     * - api (routes API internes)
     * - _next/static (fichiers statiques Next.js)
     * - _next/image (optimisation d'images)
     * - favicon.ico (icône du site)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
