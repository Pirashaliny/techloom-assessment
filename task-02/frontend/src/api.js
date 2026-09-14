const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4002';

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
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
    return request(`/api/products${qs.toString() ? `?${qs}` : ''}`);
  },
  getCategories: () => request('/api/products/categories'),
  getProduct: (id) => request(`/api/products/${id}`),

  getOrders: (customer) => request(`/api/orders${customer ? `?customer=${encodeURIComponent(customer)}` : ''}`),
  getOrder: (id) => request(`/api/orders/${id}`),
  checkout: (customerName, items, idempotencyKey) =>
    request('/api/orders/checkout', {
      method: 'POST',
      body: JSON.stringify({ customerName, items, idempotencyKey })
    }),
  cancelOrder: (id) => request(`/api/orders/${id}/cancel`, { method: 'POST' }),

  pay: (orderId, outcome, idempotencyKey) =>
    request('/api/payments', { method: 'POST', body: JSON.stringify({ orderId, outcome, idempotencyKey }) })
};

export function newIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
