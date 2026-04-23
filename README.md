# DoliFree SaaS - Interface Moderne Dolibarr pour Freelance

DoliFree est une application web moderne conçue pour simplifier la gestion quotidienne des freelances. Elle se connecte à votre instance **Dolibarr ERP/CRM** existante via son API REST pour offrir une expérience utilisateur fluide, rapide et mobile-first.

## 🚀 Fonctionnalités principales

- **Tableau de bord** : KPIs financiers en temps réel (CA, impayés, etc.).
- **Gestion des Tiers** : CRUD complet des clients et fournisseurs.
- **Commerce** : Gestion des propositions commerciales (devis).
- **Facturation & Règlements** : Suivi des factures clients/fournisseurs et saisie des paiements.
- **Catalogue** : Gestion des produits et services.

## 🛠 Configuration et Installation

### 1. Prérequis

- Une instance **Dolibarr** (v14+ recommandée) avec le module **API REST** activé.
- **Node.js** (v18+) et **npm** (ou yarn) installés sur votre machine.

### 2. Configuration de l'environnement

Créez un fichier `.env.local` à la racine du projet et configurez l'URL de l'API de votre Dolibarr :

```bash
# Exemple de configuration dans .env.local
NEXT_PUBLIC_DOLIBARR_API_URL=https://votre-dolibarr.com/api/index.php
```

> [!IMPORTANT]
> L'URL doit pointer vers le fichier `index.php` du dossier `/api/` de votre installation Dolibarr.

### 3. Installation des dépendances

Installez les bibliothèques nécessaires au projet :

```bash
npm install
```

### 4. Lancement de l'application

Démarrez le serveur de développement :

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000).

## 🧰 Stack Technique

- **Framework** : Next.js (App Router)
- **Langage** : TypeScript (Typage strict)
- **Styles** : Tailwind CSS 4.0
- **Authentification** : Gestion par Token API Dolibarr (DOLAPIKEY)
- **Accessibilité** : Respect des standards WCAG 2.1

## 📄 Licence

Projet développé pour Clarisse (Pichinov) dans le cadre de la modernisation de l'interface Dolibarr pour les indépendants.
