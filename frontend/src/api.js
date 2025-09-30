export const API = 'http://127.0.0.1:4000/api';

async function handleResponse(response) {
  if (!response.ok) {
    let message = 'Unexpected error.';
    try {
      const data = await response.json();
      if (data && data.error) {
        message = data.error;
      }
    } catch (_) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  return response;
}

export async function get(path) {
  const response = await fetch(`${API}${path}`);
  const handled = await handleResponse(response);
  return handled.json();
}

export async function post(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const handled = await handleResponse(response);
  return handled.json();
}
