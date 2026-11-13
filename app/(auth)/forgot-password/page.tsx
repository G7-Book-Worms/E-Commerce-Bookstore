import { ForgotPasswordForm } from './forgot-form';

export const metadata = { title: 'Forgot password | Book Worms' };

// Emails a one-time reset link (SCRUM-212/213). The answer is the same whether or not the
// email has an account, so the form can't be used to discover who shops here.
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
