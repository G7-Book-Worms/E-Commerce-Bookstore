// Minimal fake Stripe API for the end-to-end tests (only what checkout uses). Port 12111.
// Every checkout "pays" immediately with a Visa ending 4242; refunds are recorded at /_refunds.
const http = require('http');
const sessions = {}; const coupons = {}; let n = 0; const refunds = [];
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const p = new URLSearchParams(body);
    const send = (o) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    if (req.method === 'POST' && req.url === '/v1/coupons') {
      const id = 'co_' + ++n; coupons[id] = Number(p.get('amount_off')); return send({ id, object: 'coupon' });
    }
    if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
      let total = 0;
      for (let i = 0; p.has(`line_items[${i}][quantity]`); i++) {
        total += Number(p.get(`line_items[${i}][quantity]`)) * Number(p.get(`line_items[${i}][price_data][unit_amount]`));
      }
      const coupon = p.get('discounts[0][coupon]'); if (coupon) total -= coupons[coupon];
      const id = 'cs_test_' + Date.now().toString(36) + '_' + ++n;
      sessions[id] = { id, object: 'checkout.session', amount_total: total, payment_status: 'paid', metadata: { orderId: p.get('metadata[orderId]') } };
      return send({ ...sessions[id], url: p.get('success_url').replace('{CHECKOUT_SESSION_ID}', id) });
    }
    const m = req.url.match(/^\/v1\/checkout\/sessions\/([^?]+)/);
    if (req.method === 'GET' && m && sessions[m[1]]) {
      return send({ ...sessions[m[1]], payment_intent: { id: 'pi_' + m[1], latest_charge: { payment_method_details: { card: { brand: 'visa', last4: '4242' } } } } });
    }
    if (req.method === 'POST' && req.url === '/v1/refunds') { refunds.push(p.get('payment_intent')); return send({ id: 're_' + ++n, object: 'refund' }); }
    if (req.url === '/_refunds') return send(refunds);
    res.statusCode = 404; send({ error: { message: 'mock: unknown ' + req.method + ' ' + req.url } });
  });
}).listen(12111, () => console.log('stripe mock on 12111'));
