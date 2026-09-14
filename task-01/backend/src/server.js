require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const paymentsRouter = require('./routes/payments');
const { startReservationExpiryJob } = require('./services/reservationExpiry');
const { runMigrate } = require('./migrate');

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, service: 'task-01-pos-backend' }));
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'task-01-pos-backend' }));
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);

const publicDir = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) =>
    res.json({
      ok: true,
      service: 'task-01-pos-backend',
      health: '/api/health'
    })
  );
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});

const PORT = process.env.PORT || 4001;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function start() {
  // Bind immediately so Railway healthchecks pass while MySQL is still coming up.
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Task-01 POS backend listening on 0.0.0.0:${PORT}`);
  });

  let jobStarted = false;
  for (let i = 1; i <= 30; i++) {
    try {
      await runMigrate();
      if (!jobStarted) {
        startReservationExpiryJob();
        jobStarted = true;
      }
      console.log('Database ready; reservation expiry job started');
      return;
    } catch (err) {
      console.error(`Database init attempt ${i}/30: ${err.message}`);
      await sleep(2000);
    }
  }
  console.error('Database init did not complete; HTTP server is still listening');
}

start();
