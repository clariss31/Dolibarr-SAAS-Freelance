import Cookies from 'js-cookie';

const TOKEN_KEY = 'dolibarr_token';
const API_URL_KEY = 'dolibarr_api_url';

export const auth = {
  getToken: () => Cookies.get(TOKEN_KEY),
  getApiUrl: () => Cookies.get(API_URL_KEY),

  setAuth: (token: string, apiUrl: string) => {
    // Les cookies expirent après 7 jours par défaut
    Cookies.set(TOKEN_KEY, token, {
      expires: 7,
      secure: true,
      sameSite: 'lax',
    });
    Cookies.set(API_URL_KEY, apiUrl, {
      expires: 7,
      secure: true,
      sameSite: 'lax',
    });
  },

  clearAuth: () => {
    Cookies.remove(TOKEN_KEY);
    Cookies.remove(API_URL_KEY);
  },

  isAuthenticated: () => !!Cookies.get(TOKEN_KEY),
};
