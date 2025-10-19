'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { HeartPulse, Upload, ClipboardList, LogOut } from 'lucide-react';

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };
    getSession();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-blue-700 font-medium animate-pulse">
            Preparing your dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 to-indigo-100">
        <div className="text-center bg-white/70 backdrop-blur-xl border border-white/30 p-10 rounded-3xl shadow-2xl">
          <HeartPulse className="w-12 h-12 text-red-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-700 mb-6">
            Please log in to access the admin dashboard.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full font-medium shadow-lg hover:scale-105 transition-transform"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-200 via-blue-100 to-indigo-200 relative overflow-hidden">
      {/* Floating Background Orbs */}
      <div className="absolute top-10 left-10 w-40 h-40 bg-blue-300/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-60 h-60 bg-indigo-400/30 rounded-full blur-3xl animate-pulse"></div>

      {/* Dashboard Card */}
      <div className="relative z-10 bg-white/80 backdrop-blur-2xl border border-white/30 shadow-2xl rounded-3xl p-10 text-center w-[90%] max-w-md">
        <HeartPulse className="w-14 h-14 text-red-500 mx-auto mb-4 animate-pulse" />
        <h1 className="text-3xl font-semibold text-blue-700 mb-6">
          Admin Dashboard
        </h1>

        <div className="space-y-5">
          <button
            onClick={() => router.push('/upload')}
            className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-full shadow-md hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            <Upload className="w-5 h-5" />
            Upload PDF
          </button>

          <button
            onClick={() => router.push('/reviewer')}
            className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white py-3 rounded-full shadow-md hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            <ClipboardList className="w-5 h-5" />
            Review Questions
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-gray-400 to-gray-500 text-white py-3 rounded-full shadow-md hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            <LogOut className="w-5 h-5" />
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
