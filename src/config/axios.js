import axios from 'axios';

// Define baseURL de forma dinâmica para DEV/PROD e builds de TV
const isBrowser = typeof window !== 'undefined';
const currentPort = isBrowser ? window.location.port : '';
const isCRADev = ['3000', '5173', '5174'].includes(currentPort);

function normalizeBase(url) {
  if (!url) return '';
  return String(url).replace(/\/+$/, '');
}

let initialBaseURL = '';
const envBase = process.env.REACT_APP_API_URL && normalizeBase(process.env.REACT_APP_API_URL);

if (envBase) {
  // Permite override explícito via REACT_APP_API_URL (ex.: build:tv)
  initialBaseURL = envBase;
} else if (isBrowser && isCRADev) {
  // Em DEV (CRA/Vite), apontar para o backend Flask local em :5000
  const host = window.location.hostname || 'localhost';
  initialBaseURL = `http://${host}:5000/api`;
} else if (isBrowser) {
  // Produção: mesmo domínio (nginx proxy -> /api)
  initialBaseURL = `${normalizeBase(window.location.origin)}/api`;
} else {
  // SSR/tests: fallback simples
  initialBaseURL = '/api';
}

axios.defaults.baseURL = initialBaseURL;

// Interceptor de request: adiciona Authorization quando necessário
axios.interceptors.request.use(
  (config) => {
    const cfg = config || {};
    const urlStr = typeof cfg.url === 'string' ? cfg.url : '';

    // Pular Authorization para endpoints públicos
    const isPublic = (
      urlStr.includes('/settings/ui-preferences') ||
      urlStr.includes('/settings/player-preferences') ||
      urlStr.includes('/players/resolve-code/') ||
      /\/players\/[^/]+\/playlist/.test(urlStr) ||
      /\/players\/[^/]+\/info/.test(urlStr) ||
      urlStr.startsWith('/uploads/')
    );

    // Em modo Kiosk/TV, não enviar Authorization em nenhuma rota
    const currentPath = isBrowser ? window.location.pathname : '';
    const isKioskPath = (
      isBrowser && (
        currentPath.startsWith('/kiosk') ||
        currentPath.startsWith('/k/') ||
        currentPath.startsWith('/tv')
      )
    );

    if (!isPublic && !isKioskPath) {
      const token = isBrowser ? localStorage.getItem('access_token') : null;
      if (token) {
        cfg.headers = cfg.headers || {};
        cfg.headers.Authorization = `Bearer ${token}`;
      }
    } else if (cfg.headers && 'Authorization' in cfg.headers) {
      // garantir remoção caso axios tenha herdado headers
      delete cfg.headers.Authorization;
    }

    return cfg;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle auth errors and connection-refused fallback
let switchedToSameOrigin = false;
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const message = String(error?.message || '');
      const talksTo5000 = typeof axios.defaults.baseURL === 'string' && axios.defaults.baseURL.includes(':5000');
      // Treat only explicit connection refused as a backend-down signal; avoid broad 'Network Error' (often CORS)
      const isConnRefused = /ERR_CONNECTION_REFUSED|ECONNREFUSED/i.test(message);
      const port = isBrowser ? window.location.port : '';
      const isDev = ['3000', '5173', '5174'].includes(port);
      // Only switch to same-origin outside CRA dev, and only when truly refused
      if (!isDev && !switchedToSameOrigin && talksTo5000 && isConnRefused && isBrowser) {
        switchedToSameOrigin = true;
        const sameOrigin = `${normalizeBase(window.location.origin)}/api`;
        // eslint-disable-next-line no-console
        console.warn('[Axios Config] Connection refused em :5000. Alternando baseURL para same-origin:', sameOrigin);
        axios.defaults.baseURL = sameOrigin;

        // Reescrever a requisição que falhou, se necessário
        const cfg = { ...(error.config || {}) };
        if (typeof cfg.url === 'string') {
          try {
            const u = new URL(cfg.url, window.location.origin);
            if (u.port === '5000' || cfg.url.includes(':5000')) {
              cfg.url = sameOrigin.replace(/\/api$/, '') + u.pathname + u.search + u.hash;
            }
          } catch (_) {
            // URL relativa: deixar como está para usar o novo baseURL
          }
        }
        cfg.baseURL = sameOrigin;
        return axios(cfg);
      }

      // Centralized 401 handling com exceção para o modo Kiosk/TV
      if (error.response?.status === 401) {
        const cfg = error.config || {};
        const reqUrl = typeof cfg.url === 'string' ? cfg.url : '';
        const method = String(cfg.method || '').toLowerCase();
        const isLoginAttempt = method === 'post' && reqUrl.includes('/auth/login');
        const currentPath = isBrowser ? window.location.pathname : '';
        const atLogin = currentPath.endsWith('/login') || currentPath.endsWith('/app/login');

        const isKioskPath = (
          isBrowser && (
            currentPath.startsWith('/kiosk') || currentPath.startsWith('/k/') || currentPath.startsWith('/tv')
          )
        );
        if (isKioskPath) {
          // não redirecionar no Kiosk; apenas propagar o erro
          return Promise.reject(error);
        }

        if (!isLoginAttempt && !atLogin && isBrowser) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          const base = window.location.pathname.startsWith('/app') ? '/app' : '';
          window.location.href = `${base}/login`;
        }
      }
    } catch (_) { /* no-op */ }
    return Promise.reject(error);
  }
);

export default axios;
