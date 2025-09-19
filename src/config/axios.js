import axios from 'axios';

// Configure axios defaults
const inferApiBase = () => {
  const proto = (typeof window !== 'undefined' ? window.location.protocol : 'http:');
  const host = (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const port = (typeof window !== 'undefined' ? window.location.port : '');
  const origin = (typeof window !== 'undefined' ? window.location.origin : `${proto}//${host}${port ? ':' + port : ''}`);
  const isLocal = host === 'localhost' || host === '127.0.0.1';

  // On LAN/TV (non-localhost), ALWAYS use same-origin to avoid :5000 issues on phones/TVs
  if (!isLocal) {
    console.log(`[Axios Config] Host: ${host}, Port: ${port}, Origin: ${origin}`);
    console.log(`[Axios Config] Base URL: ${origin}/api`);
    return `${origin}/api`;
  }

  // Local development: allow REACT_APP_API_URL override, else default to :5000
  const env = process.env.REACT_APP_API_URL;
  if (env && env !== 'same-origin') {
    const url = env.replace(/\/$/, '');
    console.log(`[Axios Config] Using REACT_APP_API_URL: ${url}`);
    return url;
  }
  const localBase = `${proto}//${host}:5000/api`;
  console.log(`[Axios Config] Local development base URL: ${localBase}`);
  return localBase;
};

const baseURL = inferApiBase();
axios.defaults.baseURL = baseURL;
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Add request interceptor to include auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
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
      if (!switchedToSameOrigin && talksTo5000 && isConnRefused && typeof window !== 'undefined') {
        switchedToSameOrigin = true;
        const sameOrigin = `${window.location.origin.replace(/\/$/, '')}/api`;
        console.warn('[Axios Config] Connection refused to :5000, switching baseURL to same-origin:', sameOrigin);
        axios.defaults.baseURL = sameOrigin;

        // Rewrite the failed request URL if it is absolute or still references :5000
        const cfg = { ...error.config };
        if (typeof cfg.url === 'string') {
          try {
            const u = new URL(cfg.url, window.location.origin);
            if (u.port === '5000' || cfg.url.includes(':5000')) {
              // Preserve path/query/fragment
              cfg.url = sameOrigin.replace(/\/api$/, '') + u.pathname + u.search + u.hash;
            }
          } catch (_) {
            // cfg.url might be relative; leave as-is to use new baseURL
          }
        }
        cfg.baseURL = sameOrigin;
        return axios(cfg);
      }

      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    } catch (_) { /* no-op */ }
    return Promise.reject(error);
  }
);

export default axios;
