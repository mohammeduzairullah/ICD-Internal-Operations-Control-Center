'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getCurrentProfile } from '../utils/supabase';
import { useToast } from '../components/ToastProvider';
import StatusBadge from '../components/StatusBadge';

export default function HomeGateway() {
  const router = useRouter();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('login'); // 'login', 'register', or 'track'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [trackingResult, setTrackingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState('');

  const redirectByRole = (role) => {
    router.push(role === 'admin' ? '/admin' : '/seller');
  };

  // If already signed in, skip straight to the right dashboard instead of
  // sitting on the gateway (or worse, silently signing the user out).
  useEffect(() => {
    getCurrentProfile().then((profile) => {
      if (profile) {
        redirectByRole(profile.role);
      } else {
        setCheckingSession(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (activeTab === 'register') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        showToast(error.message, 'error');
      } else if (data?.user) {
        // A `profiles` row with role='seller' is created automatically by the
        // on_auth_user_created trigger — every self-registration is a seller.
        showToast('Seller profile created — sign in to continue.', 'success');
        setActiveTab('login');
      }
      setLoading(false);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showToast(error.message, 'error');
        setLoading(false);
      } else if (data?.user) {
        const profile = await getCurrentProfile();
        if (!profile) {
          showToast('No profile found for this account. Contact an administrator.', 'error');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
        redirectByRole(profile.role);
      }
    }
  };

  const handleTrackLookup = async (e) => {
    e.preventDefault();
    if (!trackingId.trim()) return;
    setLoading(true);
    setTrackingResult(null);
    setMessage('');

    const { data, error } = await supabase.rpc('track_container', { p_id: trackingId.trim() });

    setLoading(false);
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result) {
      setMessage('❌ Cargo mismatch: Container reference ID does not exist in port database logs.');
    } else {
      setTrackingResult(result);
    }
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-gradient-to-tr from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-tr from-blue-50 via-white to-cyan-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* Structural Motion Ambient Lighting */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-cyan-300/20 blur-[100px] rounded-full animate-[pulse_6s_ease-in-out_infinite] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-300/20 blur-[120px] rounded-full animate-[pulse_8s_ease-in-out_infinite_1.5s] pointer-events-none"></div>

      {/* Control Module Card Structure */}
      <div className="max-w-md w-full bg-white/80 backdrop-blur-3xl border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-300/40 relative z-10 hover:border-cyan-300 hover:shadow-2xl hover:shadow-cyan-200/40 transition-all duration-500 overflow-hidden">

        {/* Shimmer Border Accent Top */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-blue-500"></div>

        {/* 3-Tab Operational Segmentation Selector */}
        <div className="grid grid-cols-3 border border-slate-200 bg-slate-100 p-1.5 rounded-2xl mb-8 font-mono text-[10px] font-bold tracking-wider">
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setMessage(''); setTrackingResult(null); }}
            className={`py-2.5 rounded-xl transition-all duration-300 ${activeTab === 'login' ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            SIGN IN
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setMessage(''); setTrackingResult(null); }}
            className={`py-2.5 rounded-xl transition-all duration-300 ${activeTab === 'register' ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            NEW SELLER
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('track'); setMessage(''); setTrackingResult(null); }}
            className={`py-2.5 rounded-xl transition-all duration-300 ${activeTab === 'track' ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            TRACK CARGO
          </button>
        </div>

        {/* Branding Status Header */}
        <div className="text-center mb-6" style={{ animation: 'fadeIn 0.3s ease-out' }} key={activeTab}>
          <h1 className="text-xl font-black tracking-[0.25em] text-slate-900 uppercase font-sans">
            {activeTab === 'login' && 'Terminal Portal'}
            {activeTab === 'register' && 'Exporter Onboarding'}
            {activeTab === 'track' && 'Public Tracking'}
          </h1>
          <p className="text-slate-500 text-[10px] tracking-widest uppercase font-mono mt-1.5 flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block animate-pulse"></span>
            {activeTab === 'login' && 'Identity Core Authorization'}
            {activeTab === 'register' && 'Deploy new logistics node'}
            {activeTab === 'track' && 'Direct manifest lookup'}
          </p>
        </div>

        {/* Dynamic Context Render forms */}
        {activeTab !== 'track' ? (
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                System Identifier Email
              </label>
              <input
                type="email"
                placeholder="name@terminal-network.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 transition-all font-mono placeholder:text-slate-400 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                Security Passkey
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 transition-all font-mono placeholder:text-slate-400 focus:ring-4 focus:ring-cyan-500/10 shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-blue-600 hover:opacity-95 hover:shadow-lg hover:shadow-cyan-500/25 text-white font-black py-3.5 rounded-xl transition-all font-mono text-xs uppercase tracking-widest mt-2 active:scale-[0.98] shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? 'Processing…' : activeTab === 'register' ? 'Register Account' : 'Authorize Secure Session'}
            </button>
          </form>
        ) : (
          /* Public tracking form: no auth required, only reveals limited fields via the track_container RPC */
          <form onSubmit={handleTrackLookup} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-mono">
                Container Reference Number
              </label>
              <input
                type="text"
                placeholder="e.g. TRKU990411"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-cyan-500 transition-all font-mono uppercase tracking-widest placeholder:text-slate-400 shadow-sm"
              />
            </div>

            {message && (
              <div className="text-[10px] font-mono text-center text-rose-600 p-3 bg-rose-50 rounded-xl border border-rose-200">
                {message}
              </div>
            )}

            {trackingResult && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl font-mono text-xs space-y-2.5 text-slate-700" style={{ animation: 'slideIn 0.25s ease-out' }}>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500">REF ID:</span>
                  <span className="font-bold text-slate-900 tracking-wider">{trackingResult.id}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5 items-center">
                  <span className="text-slate-500">PORT STATUS:</span>
                  <StatusBadge gateInTime={trackingResult.gate_in_time} gateOutTime={trackingResult.gate_out_time} status={trackingResult.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">GATE IN ENTRY:</span>
                  <span className="text-slate-600 text-[11px]">{new Date(trackingResult.gate_in_time).toLocaleString()}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-blue-600 hover:opacity-95 hover:shadow-lg hover:shadow-cyan-500/25 text-white font-black py-3.5 rounded-xl transition-all font-mono text-xs uppercase tracking-widest mt-1 active:scale-[0.98] shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? 'Searching…' : 'Locate Container Metrics'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
