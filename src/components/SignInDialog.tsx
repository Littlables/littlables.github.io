import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface SignInDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'choose' | 'email' | 'code';

export function SignInDialog({ isOpen, onClose }: SignInDialogProps) {
  const { signInWithGoogle, signInWithEmail, verifyEmailOtp } = useAuth();
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setStep('choose');
    setEmail('');
    setCode('');
    setError('');
    setSending(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await signInWithGoogle();
      // OAuth redirects away; no need to close
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError('');
    setSending(true);
    try {
      await signInWithEmail(email.trim());
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError('');
    setSending(true);
    try {
      await verifyEmailOtp(email.trim(), code.trim());
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code, try again');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog sign-in-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="dialog-close" onClick={handleClose} aria-label="Close">
          ×
        </button>

        <h2 className="dialog-title">Sign in to Littlables</h2>
        <p className="dialog-subtitle">Create custom playrooms with content based around your favorite special interests.</p>

        {error && <div className="dialog-error">{error}</div>}

        {step === 'choose' && (
          <div className="sign-in-options">
            <button
              type="button"
              className="sign-in-button google-button"
              onClick={handleGoogle}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45c-.28 1.48-1.12 2.73-2.38 3.58v2.97h3.86c2.26-2.09 3.57-5.16 3.57-8.74z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-2.97c-1.07.72-2.44 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.29v3.07C3.26 21.3 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.25 14.3c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3V6.63H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.37l3.96-3.07z"/>
                <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.63l3.96 3.07c.95-2.85 3.61-4.95 6.75-4.95z"/>
              </svg>
              Continue with Google
            </button>

            <div className="sign-in-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="sign-in-button email-button"
              onClick={() => setStep('email')}
            >
              Continue with Email
            </button>
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleSendCode} className="sign-in-form">
            <label htmlFor="signin-email">Email address</label>
            <input
              id="signin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <button type="submit" className="sign-in-button primary-button" disabled={sending}>
              {sending ? 'Sending…' : 'Send me a code'}
            </button>
            <button type="button" className="link-button" onClick={() => setStep('choose')}>
              ← Back
            </button>
            <p className="sign-in-hint">We'll email you a code — no password needed.</p>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="sign-in-form">
            <label htmlFor="signin-code">Enter the code sent to {email}</label>
            <input
              id="signin-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoComplete="one-time-code"
              required
            />
            <button type="submit" className="sign-in-button primary-button" disabled={sending || code.length < 6}>
              {sending ? 'Verifying…' : 'Sign in'}
            </button>
            <button type="button" className="link-button" onClick={() => setStep('email')}>
              ← Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
