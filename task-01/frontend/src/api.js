const BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4001' : '');

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  getProducts: () => request('/api/products'),
  createProduct: (body) => request('/api/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),

  getOrders: () => request('/api/orders'),
  checkout: (items, idempotencyKey) =>
    request('/api/orders/checkout', { method: 'POST', body: JSON.stringify({ items, idempotencyKey }) }),
  cancelOrder: (id) => request(`/api/orders/${id}/cancel`, { method: 'POST' }),

  pay: (orderId, outcome, idempotencyKey) =>
    request('/api/payments', { method: 'POST', body: JSON.stringify({ orderId, outcome, idempotencyKey }) })
};

export function newIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
