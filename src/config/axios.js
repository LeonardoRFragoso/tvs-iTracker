import axios from 'axios';

// Configure axios defaults
const inferApiBase = () => {
  const proto = (typeof window !== 'undefined' ? window.location.protocol : 'http:');
  const host = (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const port = (typeof window !== 'undefined' ? window.location.port : '');
  const origin = (typeof window !== 'undefined' ? window.location.origin : `${proto}//${host}${port ? ':' + port : ''}`);
  const path = (typeof window !== 'undefined' ? window.location.pathname : '/');
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  const isCRADev = ['3000', '5173', '5174'].includes(port); // suportar CRA/Vite
  const isProdLike = path.startsWith('/app') || port === '' || port === '80' || port === '443';

  // 1) Respeitar override por variável de ambiente (fora de dev)
  const env = process.env.REACT_APP_API_URL;
  if (!isCRADev && env) {
    if (env === 'same-origin') {
      console.log(`[Axios Config] Forçando same-origin por REACT_APP_API_URL: ${origin}/api`);
      return `${origin}/api`;
    }
    const url = env.replace(/\/$/, '');
    console.log(`[Axios Config] Usando REACT_APP_API_URL: ${url}`);
    return url;
  } else if (isCRADev && env) {
    console.log(`[Axios Config] Ignorando REACT_APP_API_URL em dev (porta ${port}): ${env}`);
  }

  // 2) Ambiente de desenvolvimento (CRA/Vite) → falar com :5000, mesmo quando acessado via IP
  if (isCRADev) {
    const base = `${proto}//${host}:5000/api`;
    console.log(`[Axios Config] Dev (porta ${port}). Base URL → ${base}`);
    return base;
  }

  // 3) Localhost sem porta típica de dev → ainda preferir :5000
  if (isLocalHost) {
    const base = `${proto}//${host}:5000/api`;
    console.log(`[Axios Config] Localhost. Base URL → ${base}`);
    return base;
  }

  // 4) Produção/LAN servida pelo backend (porta 80/443 ou /app) → same-origin
  if (isProdLike) {
    console.log(`[Axios Config] Produção/LAN (${origin}). Base URL → ${origin}/api`);
    return `${origin}/api`;
  }

  // 5) Padrão: tentar :5000
  const localBase = `${proto}//${host}:5000/api`;
  console.log(`[Axios Config] Padrão (fallback) Base URL → ${localBase}`);
  return localBase;
};

const baseURL = inferApiBase();
axios.defaults.baseURL = baseURL;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Add request interceptor to include auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors and connection-refused fallback
let switchedToSameOrigin = false;
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    try {
      const message = String(error?.message || '');
      const talksTo5000 = typeof axios.defaults.baseURL === 'string' && axios.defaults.baseURL.includes(':5000');
      const isConnRefused = message.includes('ERR_CONNECTION_REFUSED') || message.includes('Network Error');
      // Só trocar para same-origin se a base atual é :5000 e houve recusa de conexão
      if (!switchedToSameOrigin && talksTo5000 && isConnRefused && typeof window !== 'undefined') {
        switchedToSameOrigin = true;
        const sameOrigin = `${window.location.origin.replace(/\/$/, '')}/api`;
        console.warn('[Axios Config] Connection refused em :5000. Alternando baseURL para same-origin:', sameOrigin);
        axios.defaults.baseURL = sameOrigin;

        // Reescrever a requisição que falhou, se necessário
        const cfg = { ...error.config };
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

      // Centralized 401 handling com exceção para a rota de login
      if (error.response?.status === 401) {
        const cfg = error.config || {};
        const reqUrl = typeof cfg.url === 'string' ? cfg.url : '';
        const method = String(cfg.method || '').toLowerCase();
        const isLoginAttempt = method === 'post' && reqUrl.includes('/auth/login');
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        const atLogin = currentPath.endsWith('/login') || currentPath.endsWith('/app/login');
        if (!isLoginAttempt && !atLogin) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          const base = (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) ? '/app' : '';
          window.location.href = `${base}/login`;
        }
      }
    } catch (_) { /* no-op */ }
    return Promise.reject(error);
  }
);

export default axios;
