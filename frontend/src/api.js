export const API_BASE = 'http://127.0.0.1:4000/api';

// Guardamos el token actual en memoria para adjuntarlo a cada petición.
let authToken = localStorage.getItem('metaPeerToken') || '';

/**
 * Permite que el contexto de autenticación actualice el token global.
 */
export function setAuthToken(token) {
  authToken = token || '';
}

/**
 * Función auxiliar que encapsula fetch con manejo de errores y cabeceras.
 * Si skipAuth es true, la petición no llevará el header Authorization.
 */
export async function fetchJson(path, options = {}) {
  const { skipAuth = false, ...rest } = options;

  const config = {
    method: rest.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(rest.headers || {})
    }
  };

  const isFormData = rest.body instanceof FormData;

  if (rest.body !== undefined) {
    if (!isFormData) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(rest.body);
    } else {
      config.body = rest.body;
    }
  }

  if (!skipAuth && authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, config);

  if (!response.ok) {
    let message = 'No pudimos completar la petición.';
    try {
      const data = await response.json();
      if (data && data.error) {
        message = data.error;
      }
    } catch (_error) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

export function getJson(path, options = {}) {
  return fetchJson(path, { ...options, method: 'GET' });
}

export function postJson(path, body, options = {}) {
  return fetchJson(path, { ...options, method: 'POST', body });
}

// Compatibilidad temporal con el código anterior.
export const get = getJson;
export const post = (path, body, options = {}) => postJson(path, body, options);
