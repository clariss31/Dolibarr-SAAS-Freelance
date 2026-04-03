<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Mission : DoliFree SaaS - Interface Moderne Dolibarr pour Freelance

Tu es l'assistant expert pour le projet de Clarisse chez Pichinov. Ton but est de moderniser l'expérience Dolibarr via une interface SaaS performante et accessible pour des freelances.

## 🛠 Stack Technique Obligatoire

- **Framework** : Next.js (App Router) avec React.
- **Langage** : TypeScript (Typage strict pour les interfaces API).
- **Styles** : Tailwind CSS (Design moderne et responsive).
- **Backend** : API REST Dolibarr (Connexion sécurisée par token).

## ♿ Règles d'Accessibilité (Critères de réussite)

Toute interface générée doit respecter le standard **WCAG 2.1 Niveau AA**:

- **Sémantique** : Utiliser les balises HTML5 appropriées et les attributs ARIA nécessaires.
- **Navigation** : Rendre l'interface 100% utilisable au clavier.
- **Images** : Ne jamais omettre l'attribut `alt` (texte alternatif).
- **Formulaires** : Labels explicites et gestion des erreurs accessible.
- **Vérification** : Le code doit passer le plugin WAVE sans erreurs.

## 📱 Responsivité & UI

- **Design** : Mobile-first obligatoire. L'interface doit s'adapter parfaitement aux mobiles, tablettes et ordinateurs.
- **Performance** : Aucune erreur tolérée dans la console.
- **CRUD** : Les pages métier doivent permettre la lecture, création, modification et suppression de données [cite: 11-43].

## 📂 Structure du Projet

Respecter scrupuleusement l'architecture suivante :

- `/app` : Routes (Groupes `(auth)` et `(dashboard)` avec layouts séparés).
- `/components` : Composants UI (accessibles) et formulaires complexes.
- `/services` : Logique d'appel à l'API REST Dolibarr.
- `/types` : Définition des interfaces TypeScript (Tiers, Factures, Produits).
- `/utils` : Fonctions utilitaires (formatage de prix/dates).

## 📝 Qualité du Code

- **TypeScript Strict** : Aucun type `any` n'est toléré. Les interfaces de données et API doivent obligatoirement être déclarées en amont dans le dossier `/types`.
- **Naming** : Fonctions et composants nommés de manière explicite et rigoureuse.
- **Commentaires** : Commenter le code uniquement lorsque la logique métier est complexe.
- **Justification** : Chaque nouvelle librairie ajoutée devra être justifiée.
- **Dépendances** : S'assurer régulièrement que les dépendances sont à jour.
- **Gitignore** : Vérifier à chaque étape que le `.gitignore` est à jour afin de ne publier aucun fichier inutile ni aucune information sensible.
- **Styles & CSS** : Centraliser les variables globales (couleurs, polices, thèmes de base) dans `app/globals.css` via l'at-rule `@theme inline`. Ne pas créer de fichiers `.css` séparés par composant. Privilégier exclusivement l'utilisation des classes utilitaires intégrées à Tailwind CSS dans les composants React.
- **Langue & Routage** : Les noms des dossiers (routes) et des fichiers doivent **impérativement être en anglais** (ex: `third-parties`, `billing-payments`). Le texte affiché à l'utilisateur reste en français.
- **Nettoyage** : Tout fichier de log ou d'erreur temporaire créé pour le débuggage doit être impérativement supprimé une fois le problème résolu.

## 🗺️ Périmètre des Pages (6 total)

1. **Dashboard** : KPIs financiers (CA, impayés) et activités récentes.
2. **Authentification** : Login sécurisé et redirection après connexion.
3. **Tiers** : Gestion CRUD complète des clients et prospects.
4. **Produits & Services** : Catalogue complet avec prix et types.
5. **Commerce** : Gestion des propositions commerciales (devis) et de leurs statuts.
6. **Facturation** : Suivi des paiements, factures et indicateurs de retard.

<!-- END:nextjs-agent-rules -->
