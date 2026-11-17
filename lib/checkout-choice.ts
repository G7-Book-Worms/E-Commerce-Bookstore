// "Continue as guest" at checkout is remembered for the browser tab (sessionStorage), so a reload
// doesn't ask again. It must never outlive a sign-in: it is forgotten whenever someone signs in or
// out, from any page, so a signed-out shopper is always asked again (sign in, create an account,
// or continue as a guest).
const KEY = 'bw:checkout:guest';

export function loadGuestChoice(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false; // storage blocked (private mode): just ask again
  }
}

export function saveGuestChoice() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage blocked: the choice lasts until the page is reloaded
  }
}

export function forgetGuestChoice() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing was saved
  }
}
