/**
 * Client d'API pour Dolibarr basé sur fetch
 */

const getBaseUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_DOLIBARR_API_URL || '';
    if (typeof window !== 'undefined') {
        return localStorage.getItem('dolibarr_api_url') || envUrl;
    }
    return envUrl;
};

import { ApiError } from '../types/dolibarr';

interface RequestOptions extends RequestInit {
    data?: unknown;
}

export const api = {
    async fetch(endpoint: string, options: RequestOptions = {}) {
        const url = `${getBaseUrl()}${endpoint}`;

        const headers = new Headers({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(options.headers as Record<string, string> || {})
        });

        // Ajout du token si présent (côté client)
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('dolibarr_token');
            if (token) {
                headers.set('DOLAPIKEY', token);
            }
        }

        const config: RequestInit = {
            ...options,
            headers,
        };

        if (options.data) {
            config.body = JSON.stringify(options.data);
        }

        const response = await fetch(url, config);

        // Intercepteur de réponse pour gérer l'erreur 401 (Non autorisé)
        if (response.status === 401) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('dolibarr_token');
                window.location.href = '/login';
            }
            throw new Error('Unauthorized');
        }

        // Parse de la réponse JSON si status n'est pas 204 (No Content)
        let data;
        try {
            if (response.status !== 204) {
                data = await response.json();
            }
        } catch (e) {
            data = null;
        }

        if (!response.ok) {
            const error = new Error(response.statusText) as Error & ApiError;
            error.response = { status: response.status, data };
            throw error;
        }

        return { data, status: response.status };
    },

    get(endpoint: string, options?: Omit<RequestOptions, 'method'>) {
        return this.fetch(endpoint, { ...options, method: 'GET' });
    },

    post(endpoint: string, data?: unknown, options?: Omit<RequestOptions, 'method' | 'data'>) {
        return this.fetch(endpoint, { ...options, method: 'POST', data });
    },

    put(endpoint: string, data?: unknown, options?: Omit<RequestOptions, 'method' | 'data'>) {
        return this.fetch(endpoint, { ...options, method: 'PUT', data });
    },

    delete(endpoint: string, options?: Omit<RequestOptions, 'method'>) {
        return this.fetch(endpoint, { ...options, method: 'DELETE' });
    }
};
