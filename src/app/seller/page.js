'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { calculateContainerStatus } from '../../utils/tracker';
import { supabase, getCurrentProfile } from '../../utils/supabase';
import { useToast } from '../../components/ToastProvider';
import StatusBadge from '../../components/StatusBadge';
import TableSkeleton from '../../components/TableSkeleton';
import EmptyState from '../../components/EmptyState';

export default function SellerDashboard() {
  const router = useRouter();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [containerId, setContainerId] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [myContainers, setMyContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('urgency');

  useEffect(() => {
    getCurrentProfile().then((p) => {
      if (!p || p.role !== 'seller') {
        router.push('/');
        return;
      }
      setProfile(p);
      setCheckingSession(false);
      fetchMyContainers();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchMyContainers = async () => {
    setLoading(true);
    // RLS already scopes this to the signed-in seller's own rows.
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .order('gate_in_time', { ascending: false });

    if (error) {
      showToast(`Failed to load your containers: ${error.message}`, 'error');
    } else if (data) {
      setMyContainers(data);
    }
    setLoading(false);
  };

  const handleDispatchContainer = async (e) => {
    e.preventDefault();
    if (!containerId.trim() || !ownerEmail.trim()) return;

    setActionLoading(true);
    const cleanId = containerId.trim().toUpperCase();

    const { error } = await supabase
      .from('containers')
      .insert([{
        id: cleanId,
        status: 'IN_ICD',
        gate_in_time: new Date().toISOString(),
        owner_email: ownerEmail.trim(),
        seller_id: profile.id,
      }]);

    setActionLoading(false);

    if (error) {
      showToast(`Dispatch failed: ${error.message}`, 'error');
    } else {
      showToast(`Manifest ${cleanId} locked to terminal grid.`, 'success');
      setContainerId('');
      setOwnerEmail('');
      fetchMyContainers();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const visibleContainers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = myContainers.filter((c) =>
      !q || c.id.toLowerCase().includes(q) || c.status.toLowerCase().includes(q) || c.owner_email.toLowerCase().includes(q)
    );

    const withMetrics = list.map((c) => ({ c, m: calculateContainerStatus(c.gate_in_time, c.gate_out_time) }));

    withMetrics.sort((a, b) => {
      if (sortBy === 'urgency') {
        // Active + breached first, then active by soonest-to-breach, gated-out last.
        const aActive = a.c.status === 'IN_ICD';
        const bActive = b.c.status === 'IN_ICD';
        if (aActive !== bActive) return aActive ? -1 : 1;
        return a.m.hoursRemaining - b.m.hoursRemaining;
      }
      if (sortBy === 'newest') return new Date(b.c.gate_in_time) - new Date(a.c.gate_in_time);
      if (sortBy === 'id') return a.c.id.localeCompare(b.c.id);
      return 0;
    });

    return withMetrics.map((x) => x.c);
  }, [myContainers, search, sortBy]);

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans selection:bg-cyan-500 selection:text-slate-950">
      <div className="max-w-6xl mx-auto space-y-8">

        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Exporter Dispatch Dashboard
            </h1>
            <p className="text-sm text-slate-400 font-mono mt-1">
              NODE ACTIVE // SECURE PROFILE: <span className="text-cyan-400">{profile.email}</span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="self-start md:self-auto px-5 py-2.5 bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-900/60 rounded-xl text-xs font-bold font-mono tracking-widest transition-all duration-300"
          >
            LOGOUT SESSION
          </button>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
            <span className="text-xs font-bold font-mono text-slate-500 uppercase tracking-widest">Active Manifests Registered</span>
            <span className="text-5xl font-black text-white font-mono mt-4">{myContainers.length}</span>
          </div>
          <div className="bg-gradient-to-br from-slate-900/60 to-cyan-950/20 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full group-hover:bg-cyan-500/10 transition-all duration-500"></div>
            <span className="text-xs font-bold font-mono text-slate-500 uppercase tracking-widest">Currently In ICD</span>
            <span className="text-5xl font-black text-cyan-400 font-mono mt-4">
              {myContainers.filter((c) => c.status === 'IN_ICD').length}
            </span>
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-sm font-bold font-mono text-slate-400 uppercase tracking-wider mb-4">Initialize Outbound Cargo Pre-Alert</h2>
          <form onSubmit={handleDispatchContainer} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="CONTAINER ID e.g. TRKU990411"
              value={containerId}
              onChange={(e) => setContainerId(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3.5 text-sm font-mono text-white placeholder:text-slate-700 outline-none transition-all uppercase tracking-widest focus:ring-4 focus:ring-cyan-500/5"
              required
            />
            <input
              type="email"
              placeholder="Consignee email (for alerts)"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3.5 text-sm font-mono text-white placeholder:text-slate-700 outline-none transition-all focus:ring-4 focus:ring-cyan-500/5"
              required
            />
            <button
              type="submit"
              disabled={actionLoading}
              className="px-6 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black font-mono text-xs uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {actionLoading ? 'Encrypting…' : 'Dispatch Container'}
            </button>
          </form>
        </section>

        <section className="bg-slate-900/20 border border-slate-800/60 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <h2 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
              Historical Node Ledger ({visibleContainers.length} of {myContainers.length})
            </h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Search ID, status, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-slate-700 outline-none transition-all w-full sm:w-56"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs font-mono text-white rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:border-cyan-400"
              >
                <option value="urgency">Sort: Most Urgent</option>
                <option value="newest">Sort: Newest First</option>
                <option value="id">Sort: Container ID</option>
              </select>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : myContainers.length === 0 ? (
            <EmptyState title="No cargo containers linked to this account" message="Dispatch your first container above." />
          ) : visibleContainers.length === 0 ? (
            <EmptyState title="No matches" message="Try a different search term." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 bg-slate-950/50">
                    <th className="px-6 py-3.5 font-bold tracking-wider">CONTAINER REFERENCE</th>
                    <th className="px-6 py-3.5 font-bold tracking-wider">CONSIGNEE EMAIL</th>
                    <th className="px-6 py-3.5 font-bold tracking-wider">GATE ENTRY TIME</th>
                    <th className="px-6 py-3.5 font-bold tracking-wider text-right">COUNTDOWN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 bg-slate-900/10">
                  {visibleContainers.map((container) => (
                    <tr key={container.id} className="hover:bg-slate-900/40 transition-colors group">
                      <td className="px-6 py-4 font-bold text-white tracking-widest group-hover:text-cyan-400 transition-colors">
                        {container.id}
                      </td>
                      <td className="px-6 py-4 text-slate-400">{container.owner_email}</td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(container.gate_in_time).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <StatusBadge gateInTime={container.gate_in_time} gateOutTime={container.gate_out_time} status={container.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
