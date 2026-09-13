import React, { useEffect, useState } from 'react';
import { api, newIdempotencyKey } from './api.js';

export default function App() {
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({}); // productId -> qty
  const [error, setError] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '' });

  const loadProducts = () => api.getProducts().then(setProducts).catch((e) => setError(e.message));
  const loadOrders = () => api.getOrders().then(setOrders).catch((e) => setError(e.message));

  useEffect(() => {
    loadProducts();
    loadOrders();
    const interval = setInterval(() => {
      loadProducts();
      loadOrders();
    }, 5000); // poll so reservation expiry (server-side cron) is reflected in the UI
    return () => clearInterval(interval);
  }, []);

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
    const items = Object.entries(cart).map(([productId, quantity]) => ({
      productId: Number(productId),
      quantity
    }));
    if (!items.length) return setError('Cart is empty');
    try {
      const order = await api.checkout(items, newIdempotencyKey());
      setCart({});
      await loadProducts();
      await loadOrders();
      setTab('orders');
      alert(`Order #${order.id} created with status "${order.status}". You have 5 minutes to pay before it expires.`);
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

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createProduct({
        name: newProduct.name,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock)
      });
      setNewProduct({ name: '', price: '', stock: '' });
      loadProducts();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>
          Techloom POS
          <span>Order &amp; inventory console</span>
        </h1>
        <nav>
          <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
            Products
          </button>
          <button className={tab === 'cart' ? 'active' : ''} onClick={() => setTab('cart')}>
            Cart ({Object.values(cart).reduce((a, b) => a + b, 0)})
          </button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
            Orders
          </button>
        </nav>
      </header>

      {error && <div className="error">{error}</div>}

      {tab === 'products' && (
        <section>
          <h2>Inventory</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Reserved</th>
                <th>Available</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="num">${Number(p.price).toFixed(2)}</td>
                  <td className="num">{p.stock}</td>
                  <td className="num">{p.reserved_stock}</td>
                  <td className="num">{p.available_stock}</td>
                  <td>
                    <button disabled={p.available_stock <= 0} onClick={() => addToCart(p.id)}>
                      Add to cart
                    </button>
                    <button className="danger" onClick={() => api.deleteProduct(p.id).then(loadProducts)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Add product</h3>
          <form onSubmit={handleCreateProduct} className="inline-form">
            <input
              placeholder="Name"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              required
            />
            <input
              placeholder="Price"
              type="number"
              step="0.01"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              required
            />
            <input
              placeholder="Stock"
              type="number"
              value={newProduct.stock}
              onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
              required
            />
            <button type="submit">Add</button>
          </form>
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
                  {product?.name} × {qty}
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
          <h2>Orders</h2>
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
                  <td className="num">#{o.id}</td>
                  <td>
                    <span className={`badge ${o.status.toLowerCase()}`}>{o.status}</span>
                  </td>
                  <td className="num">${Number(o.total).toFixed(2)}</td>
                  <td className="num">{o.expires_at ? new Date(o.expires_at).toLocaleTimeString() : '-'}</td>
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
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
