import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center px-6 py-24 sm:py-32 lg:px-8">
      <div className="text-center">
        <p className="text-primary text-base font-semibold">404</p>
        <h1 className="text-foreground mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
          Page introuvable
        </h1>
        <p className="text-muted mt-6 text-base leading-7">
          Désolé, nous ne parvenons pas à trouver la page que vous recherchez.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/"
            className="btn-primary focus-visible:outline-primary rounded-md px-3.5 py-2.5 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </main>
  );
}
