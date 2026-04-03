import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('dolibarr_token')?.value;
  const { pathname } = request.nextUrl;

  // 1. Si l'utilisateur est sur une page d'authentification (login)
  // et qu'il a déjà un token, on le redirige vers le tableau de bord
  if (pathname.startsWith('/login') && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. Si l'utilisateur essaie d'accéder à une page protégée sans token
  // On considère que tout ce qui n'est pas /login ou des assets statiques est protégé
  const isAuthPage = pathname.startsWith('/login');
  const isPublicAsset = pathname.match(/\.(.*)$/) || pathname.startsWith('/_next');

  if (!token && !isAuthPage && !isPublicAsset) {
    const loginUrl = new URL('/login', request.url);
    // On pourrait ajouter un paramètre 'callback' pour revenir ici après login
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Configuration des routes sur lesquelles le middleware doit s'exécuter
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
