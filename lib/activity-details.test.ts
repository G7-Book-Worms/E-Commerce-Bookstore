import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDetails, humanizeKey } from './activity-details';

test('empty or odd details give no rows', () => {
  assert.deepEqual(describeDetails(null), []);
  assert.deepEqual(describeDetails('text'), []);
  assert.deepEqual(describeDetails([1, 2]), []);
  assert.deepEqual(describeDetails({ a: null, b: '', c: [] }), []);
});

test('orders, customers, books and tickets become links', () => {
  const rows = describeDetails({ orderId: 42, userId: 7, bookId: 3, ticketId: 9 });
  assert.deepEqual(rows.map((r) => [r.label, r.parts]), [
    ['Order', [{ text: '#42', href: '/admin/orders/42' }]],
    ['Customer', [{ text: '#7', href: '/admin/customers/7' }]],
    ['Book', [{ text: '#3', href: '/admin/books/3' }]],
    ['Ticket', [{ text: '#9', href: '/admin/messages/9' }]],
  ]);
});

test('ids that are not positive integers are not linked', () => {
  const [row] = describeDetails({ orderId: '../../x' });
  assert.deepEqual(row.parts, [{ text: '../../x' }]);
  assert.equal(describeDetails({ orderId: 0 })[0].parts[0].href, undefined);
});

test('money, booleans and stock changes are readable', () => {
  const rows = describeDetails({ totalCents: 2599, rememberMe: true, emailed: false, quantityChange: 5 });
  assert.deepEqual(rows.map((r) => `${r.label}: ${r.parts[0].text}`), [
    'Total: $25.99', 'Stay signed in: Yes', 'Email sent: No', 'Change: +5',
  ]);
});

test('the acting staff id is hidden because the Who column shows it', () => {
  const rows = describeDetails({ actorId: 1, targetId: 4, email: 'a@b.c' }, 'staff.deactivate');
  assert.deepEqual(rows.map((r) => r.key), ['targetId', 'email']);
  assert.equal(rows[0].parts[0].text, '#4');
});

test('bulk customer summaries link each customer', () => {
  const [, applied] = describeDetails({ requested: 2, applied: [5, 6] }, 'customer.bulk_delete_summary');
  assert.deepEqual(applied.parts, [{ text: '#5', href: '/admin/customers/5' }, { text: '#6', href: '/admin/customers/6' }]);
  const [other] = describeDetails({ applied: [5] }, 'order.bulk_status_changed');
  assert.equal(other.parts[0].href, undefined);
});

test('low-stock items are listed by title', () => {
  const [row] = describeDetails({ items: [{ title: 'Dune', format: 'paperback', stock: 2, threshold: 5, bookId: 11 }, { title: 'Emma', format: '', stock: 0, threshold: 3, bookId: null }] });
  assert.equal(row.label, 'Books');
  assert.deepEqual(row.parts, [
    { text: 'Dune (paperback): 2 left, alert at 5', href: '/admin/books/11' },
    { text: 'Emma: sold out, alert at 3', href: undefined },
  ]);
});

test('unknown keys get a readable label and objects are shown as JSON', () => {
  assert.equal(humanizeKey('lowStockThreshold'), 'Low stock threshold');
  assert.equal(humanizeKey('some_key'), 'Some key');
  const [row] = describeDetails({ extraInfo: { a: 1 } });
  assert.equal(row.label, 'Extra info');
  assert.equal(row.parts[0].text, '{"a":1}');
});
