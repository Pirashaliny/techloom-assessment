import React, { useEffect, useState } from 'react';
import { api, newIdempotencyKey } from './api.js';

export default function App() {
  const [tab, setTab] = useState('shop');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ search: '', category: '', minPrice: '', maxPrice: '' });
  const [cart, setCart] = useState({});
  const [customerName, setCustomerName] = useState('Guest');
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  const loadProducts = () => api.getProducts(filters).then(setProducts).catch((e) => setError(e.message));
  const loadOrders = () => api.getOrders(customerName).then(setOrders).catch((e) => setError(e.message));

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    loadProducts();
  }, [filters]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000); // reflects server-side reservation expiry
    const pInterval = setInterval(loadProducts, 5000);
    return () => {
      clearInterval(interval);
      clearInterval(pInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerName]);

  const addToCart = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeFromCart = (id) =>
    setCart((c) => {
      const next = { ...c };
      if (next[id] > 1) next[id] -= 1;
      else delete next[id];
      return next;
    });

  const handleCheckout = async () => {
    setError('');
    const items = Object.entries(cart).map(([productId, quantity]) => ({ productId: Number(productId), quantity }));
    if (!items.length) return setError('Cart is empty');
    try {
      const order = await api.checkout(customerName, items, newIdempotencyKey());
      setCart({});
      await loadProducts();
      await loadOrders();
      setTab('orders');
      alert(`Order #${order.id} reserved. Total $${Number(order.total).toFixed(2)}. Complete payment within 5 minutes.`);
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePay = async (orderId, outcome) => {
    setError('');
    try {
      await api.pay(orderId, outcome, newIdempotencyKey());
      await loadProducts();
      await loadOrders();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCancel = async (orderId) => {
    setError('');
    try {
      await api.cancelOrder(orderId);
      await loadProducts();
      await loadOrders();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Loomstead</h1>
        <nav>
          <button className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}>
            Shop
          </button>
          <button className={tab === 'cart' ? 'active' : ''} onClick={() => setTab('cart')}>
            Cart ({Object.values(cart).reduce((a, b) => a + b, 0)})
          </button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
            Order History
          </button>
        </nav>
      </header>

      <div className="inline-form" style={{ margin: '10px 0' }}>
        <label>
          Customer:{' '}
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value || 'Guest')} />
        </label>
      </div>

      {error && <div className="error">{error}</div>}

      {tab === 'shop' && (
        <section>
          <h2>Products</h2>
          <div className="inline-form">
            <input
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              placeholder="Min price"
              type="number"
              value={filters.minPrice}
              onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
            />
            <input
              placeholder="Max price"
              type="number"
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
            />
          </div>

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Available</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong className="product-name">{p.name}</strong>
                    <br />
                    <small>{p.description}</small>
                  </td>
                  <td>{p.category}</td>
                  <td>${Number(p.price).toFixed(2)}</td>
                  <td>{p.available_stock}</td>
                  <td>
                    <button disabled={p.available_stock <= 0} onClick={() => addToCart(p.id)}>
                      Add to cart
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan="5">No products match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'cart' && (
        <section>
          <h2>Cart</h2>
          {Object.keys(cart).length === 0 && <p>Cart is empty.</p>}
          <ul>
            {Object.entries(cart).map(([id, qty]) => {
              const product = products.find((p) => p.id === Number(id));
              return (
                <li key={id}>
                  {product?.name || `#${id}`} × {qty}
                  <button onClick={() => removeFromCart(Number(id))}>-</button>
                  <button onClick={() => addToCart(Number(id))}>+</button>
                </li>
              );
            })}
          </ul>
          {Object.keys(cart).length > 0 && <button onClick={handleCheckout}>Checkout (reserve stock)</button>}
        </section>
      )}

      {tab === 'orders' && (
        <section>
          <h2>Order History — {customerName}</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Total</th>
                <th>Expires</th>
                <th>Items</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>
                    <span className={`badge ${o.status.toLowerCase()}`}>{o.status}</span>
                  </td>
                  <td>${Number(o.total).toFixed(2)}</td>
                  <td>{o.expires_at ? new Date(o.expires_at).toLocaleTimeString() : '-'}</td>
                  <td>{o.items.map((it) => `${it.product_name} x${it.quantity}`).join(', ')}</td>
                  <td>
                    {o.status === 'Reserved' && (
                      <>
                        <button onClick={() => handlePay(o.id, 'success')}>Pay: Success</button>
                        <button onClick={() => handlePay(o.id, 'failure')}>Pay: Fail</button>
                        <button onClick={() => handlePay(o.id, 'timeout')}>Pay: Timeout</button>
                        <button className="danger" onClick={() => handleCancel(o.id)}>
                          Cancel
                        </button>
                      </>
                    )}
                    {o.status === 'Paid' && (
                      <button className="danger" onClick={() => handleCancel(o.id)}>
                        Cancel &amp; refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="6">No orders yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
