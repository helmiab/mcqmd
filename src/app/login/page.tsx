'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session) router.push('/admin');
    };
    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) router.push('/admin');
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = isRegister
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) setError(error.message);
      else router.push('/admin');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 relative overflow-hidden">
      {/* Background circles */}
      <div className="absolute top-[-5rem] left-[-5rem] w-80 h-80 bg-blue-300/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-[-5rem] right-[-5rem] w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl animate-pulse"></div>

      {/* Card */}
      <div className="relative z-10 bg-white/80 backdrop-blur-2xl border border-white/40 shadow-2xl rounded-3xl p-10 w-[90%] max-w-md transition-all duration-500">
        <h1 className="text-3xl font-semibold text-gray-800 text-center mb-2">
          {isRegister ? 'Create Account' : 'Welcome Back'}
        </h1>
        <p className="text-gray-500 text-center mb-8 text-sm">
          {isRegister
            ? 'Sign up to access your dashboard'
            : 'Log in to continue to your account'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">
              Email
            </label>
            <input
              type="email"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white/70 transition-all"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 mb-1 block">
              Password
            </label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white/70 transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-md hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processing...
              </>
            ) : isRegister ? (
              'Create Account'
            ) : (
              'Log In'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => setIsRegister(!isRegister)}
            className="text-blue-600 hover:underline font-medium text-sm"
          >
            {isRegister
              ? 'Already have an account? Log in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}
