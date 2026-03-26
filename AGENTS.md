<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Mission : DoliFree SaaS - Interface Moderne Dolibarr pour Freelance

Tu es l'assistant expert pour le projet de Clarisse chez Pichinov. [cite_start]Ton but est de moderniser l'expérience Dolibarr via une interface SaaS performante et accessible pour des freelances.

## 🛠 Stack Technique Obligatoire
* [cite_start]**Framework** : Next.js (App Router) avec React.
* [cite_start]**Langage** : TypeScript (Typage strict pour les interfaces API).
* [cite_start]**Styles** : Tailwind CSS (Design moderne et responsive).
* [cite_start]**Backend** : API REST Dolibarr (Connexion sécurisée par token).

## ♿ Règles d'Accessibilité (Critères de réussite)
[cite_start]Toute interface générée doit respecter le standard **WCAG 2.1 Niveau AA**:
* [cite_start]**Sémantique** : Utiliser les balises HTML5 appropriées et les attributs ARIA nécessaires.
* [cite_start]**Navigation** : Rendre l'interface 100% utilisable au clavier.
* [cite_start]**Images** : Ne jamais omettre l'attribut `alt` (texte alternatif).
* [cite_start]**Formulaires** : Labels explicites et gestion des erreurs accessible.
* [cite_start]**Vérification** : Le code doit passer le plugin WAVE sans erreurs.

## 📱 Responsivité & UI
* **Design** : Mobile-first obligatoire. [cite_start]L'interface doit s'adapter parfaitement aux mobiles, tablettes et ordinateurs.
* [cite_start]**Performance** : Aucune erreur tolérée dans la console.
* [cite_start]**CRUD** : Les pages métier doivent permettre la lecture, création, modification et suppression de données [cite: 11-43].

## 📂 Structure du Projet
Respecter scrupuleusement l'architecture suivante :
* `/app` : Routes (Groupes `(auth)` et `(dashboard)` avec layouts séparés).
* `/components` : Composants UI (accessibles) et formulaires complexes.
* `/services` : Logique d'appel à l'API REST Dolibarr.
* `/types` : Définition des interfaces TypeScript (Tiers, Factures, Produits).
* `/utils` : Fonctions utilitaires (formatage de prix/dates).

## 📝 Qualité du Code
* [cite_start]**Naming** : Fonctions et composants nommés de manière explicite et rigoureuse.
* [cite_start]**Commentaires** : Commenter le code uniquement lorsque la logique métier est complexe.
* [cite_start]**Justification** : Chaque nouvelle librairie ajoutée devra être justifiée.

## 🗺️ Périmètre des Pages (6 total)
1. **Dashboard** : KPIs financiers (CA, impayés) et activités récentes.
2. [cite_start]**Authentification** : Login sécurisé et redirection après connexion.
3. **Tiers** : Gestion CRUD complète des clients et prospects.
4. **Produits & Services** : Catalogue complet avec prix et types.
5. **Commerce** : Gestion des propositions commerciales (devis) et de leurs statuts.
6. **Facturation** : Suivi des paiements, factures et indicateurs de retard.

<!-- END:nextjs-agent-rules -->
