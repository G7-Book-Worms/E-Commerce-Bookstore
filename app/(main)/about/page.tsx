export const metadata = { title: 'About | Book Worms' };

// One page for the footer links (About, Shipping, Privacy, Terms)
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-10 text-stone-700">
      <section id="about">
        <h1 className="font-serif text-3xl font-bold text-stone-900">About Book Worms</h1>
        <p className="mt-3">
          Book Worms is an online bookstore built by CS 3773 Group 7 at UTSA as a class project.
          Browse the catalog, add books to your cart, and check out with a test payment.
        </p>
      </section>
      <section id="shipping">
        <h2 className="font-serif text-2xl font-bold text-stone-900">Shipping</h2>
        <p className="mt-2">Orders ship to the address on your account. This is a demo store, so nothing is actually shipped.</p>
      </section>
      <section id="privacy">
        <h2 className="font-serif text-2xl font-bold text-stone-900">Privacy</h2>
        <p className="mt-2">
          We store your name, email, addresses and orders to run your account. Passwords are stored as one-way hashes,
          and card numbers never reach our servers; payments are handled by Stripe in test mode.
        </p>
      </section>
      <section id="terms">
        <h2 className="font-serif text-2xl font-bold text-stone-900">Terms</h2>
        <p className="mt-2">Book Worms is a student project for demonstration only. No real purchases are made.</p>
      </section>
    </div>
  );
}
