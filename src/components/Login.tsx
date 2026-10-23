import { useState } from 'react';
import { BookOpen, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, FlaskConical, User as UserIcon, AtSign } from 'lucide-react';
import { useAuth } from '@/lib/authContext';

interface Props {
  onDemoMode: () => void;
}

export default function Login({ onDemoMode }: Props) {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = (): string | null => {
    if (mode === 'signup') {
      if (!firstName.trim()) return 'First name is required.';
      if (!lastName.trim()) return 'Last name is required.';
      if (!username.trim()) return 'Username is required.';
    }
    if (!email.trim()) return 'Email address is required.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address.';
    if (mode !== 'forgot') {
      if (!password) return 'Password is required.';
      if (password.length < 6) return 'Password must be at least 6 characters.';
      if (mode === 'signup' && password !== confirmPassword) return 'Passwords do not match.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const v = validate();
    if (v) { setError(v); return; }

    setBusy(true);
    try {
      if (mode === 'forgot') {
        const { error: err } = await resetPassword(email);
        if (err) setError(err);
        else setInfo('Password reset link sent. Check your email inbox.');
      } else if (mode === 'signup') {
        const { error: err } = await signUp(
          { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), username: username.trim() },
          password,
        );
        if (err) { setError(err); }
        else {
          setInfo('Account created. You can now sign in.');
          setFirstName(''); setLastName(''); setEmail(''); setUsername(''); setPassword(''); setConfirmPassword('');
          setMode('signin');
        }
      } else {
        const { error: err } = await signIn(email, password);
        if (err) setError(err);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
    setBusy(false);
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await signInWithGoogle();
    if (err) { setError(err); setBusy(false); }
  };

  const inputClass = 'w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-800 outline-none focus:border-navy-400 focus:ring-2 focus:ring-navy-100';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-navy-600 shadow-lg">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">AI Library Hold &amp; Renewal Agent</h1>
          <p className="mt-1 text-sm text-navy-200">Sign in to manage your library account</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-5 flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => { setMode('signin'); setError(null); setInfo(null); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); setInfo(null); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Sign Up
            </button>
          </div>

          {mode === 'forgot' && (
            <p className="mb-4 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-700">
              Enter your email and we'll send you a password reset link.
            </p>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {info && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm text-emerald-700">{info}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">First Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Harini"
                      className={inputClass}
                      autoComplete="given-name"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Last Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Jayaraman"
                      className={inputClass}
                      autoComplete="family-name"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                  autoComplete="email"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Username</label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="harini123"
                    className={inputClass}
                    autoComplete="username"
                  />
                </div>
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={inputClass}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); setInfo(null); }}
                  className="text-xs font-medium text-navy-600 hover:text-navy-800"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-700 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'forgot' ? 'Send reset link' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {mode !== 'forgot' && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <button
                onClick={handleGoogle}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          {mode === 'forgot' && (
            <button
              onClick={() => { setMode('signin'); setError(null); setInfo(null); }}
              className="mt-4 w-full text-center text-sm font-medium text-navy-600 hover:text-navy-800"
            >
              Back to sign in
            </button>
          )}

          <div className="mt-6 border-t border-gray-100 pt-5">
            <button
              onClick={onDemoMode}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-50 py-2.5 text-sm font-medium text-purple-700 transition hover:bg-purple-100"
            >
              <FlaskConical className="h-4 w-4" />
              Try Demo Mode (no account needed)
            </button>
            <p className="mt-2 text-center text-xs text-gray-400">
              Demo mode gives full access to renewals, holds, and test scenarios.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
