'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { calculateContainerStatus } from '../../utils/tracker';
import { supabase, getCurrentProfile } from '../../utils/supabase';
import { useToast } from '../../components/ToastProvider';
import StatusBadge from '../../components/StatusBadge';
import TableSkeleton from '../../components/TableSkeleton';
import EmptyState from '../../components/EmptyState';
import ConfirmModal from '../../components/ConfirmModal';

const STATUS_OPTIONS = [
  { value: 'IN_ICD', label: '🏢 In ICD' },
  { value: 'GATE_OUT', label: '🚛 Gated Out' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const { showToast } = useToast();
  const [containers, setContainers] = useState([]);
  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [newContainerId, setNewContainerId] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchContainers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .order('gate_in_time', { ascending: false });

    if (error) {
      showToast(`Failed to load containers: ${error.message}`, 'error');
    } else if (data) {
      setContainers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    setMounted(true);

    getCurrentProfile().then((p) => {
      if (!p || p.role !== 'admin') {
        router.push('/');
        return;
      }
      setProfile(p);
      setCheckingSession(false);
      fetchContainers();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setProfile(null);
        setContainers([]);
        setAlerts([]);
        setSelectedIds([]);
      }
    });

    const timer = setInterval(() => setTime(new Date()), 1000);

    return () => {
      clearInterval(timer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Monitor background containers for active SLA breaches
  useEffect(() => {
    if (!profile || containers.length === 0) return;

    containers.forEach(container => {
      if (container.status === 'IN_ICD') {
        const metrics = calculateContainerStatus(container.gate_in_time, container.gate_out_time);

        if (metrics.isBreached) {
          setAlerts(prev => {
            if (prev.some(a => a.id === container.id)) return prev;
            return [{
              id: container.id,
              msg: `🚨 SLA BREACH: Container ${container.id} has exceeded the 72h limit window!`,
              time: new Date().toLocaleTimeString()
            }, ...prev];
          });
        }
      }
    });
  }, [containers, time, profile]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showToast(error.message, 'error');
      setAuthLoading(false);
      return;
    }

    if (data?.user) {
      const p = await getCurrentProfile();
      if (p?.role !== 'admin') {
        showToast('This account does not have admin access.', 'error');
        await supabase.auth.signOut();
        setAuthLoading(false);
        return;
      }
      setProfile(p);
      setPassword('');
      fetchContainers();
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleAddContainer = async (e) => {
    e.preventDefault();
    if (!newContainerId.trim() || !newOwnerEmail.trim()) return;

    setAddLoading(true);
    const cleanId = newContainerId.trim().toUpperCase();

    const { error } = await supabase
      .from('containers')
      .insert([{
        id: cleanId,
        status: 'IN_ICD',
        gate_in_time: new Date().toISOString(),
        owner_email: newOwnerEmail.trim(),
        seller_id: profile.id,
      }]);

    setAddLoading(false);

    if (error) {
      showToast(`Failed to add container: ${error.message}`, 'error');
    } else {
      showToast(`Container ${cleanId} deployed to yard.`, 'success');
      setNewContainerId('');
      setNewOwnerEmail('');
      fetchContainers();
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === containers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(containers.map(c => c.id));
    }
  };

  const handleBatchStatusChange = async (updatedStatus) => {
    if (selectedIds.length === 0) return;

    const updates = { status: updatedStatus };
    updates.gate_out_time = updatedStatus === 'GATE_OUT' ? new Date().toISOString() : null;

    const { error } = await supabase
      .from('containers')
      .update(updates)
      .in('id', selectedIds);

    if (error) {
      showToast(`Batch status update failed: ${error.message}`, 'error');
    } else {
      showToast(`${selectedIds.length} container(s) updated.`, 'success');
      setContainers(prev => prev.map(c =>
        selectedIds.includes(c.id) ? { ...c, ...updates } : c
      ));
      if (updatedStatus === 'GATE_OUT') {
        setAlerts(prev => prev.filter(a => !selectedIds.includes(a.id)));
      }
      setSelectedIds([]);
      fetchContainers();
    }
  };

  const handleBatchDelete = async () => {
    const { error } = await supabase
      .from('containers')
      .delete()
      .in('id', selectedIds);

    setConfirmDelete(false);

    if (error) {
      showToast(`Batch delete failed: ${error.message}`, 'error');
      return;
    }

    showToast(`${selectedIds.length} container(s) purged.`, 'success');
    setContainers(prev => prev.filter(c => !selectedIds.includes(c.id)));
    setAlerts(prev => prev.filter(a => !selectedIds.includes(a.id)));
    setSelectedIds([]);
  };

  const yardCapacityLimit = 50;
  const activeInYard = containers.filter(c => c.status === 'IN_ICD').length;

  let totalActiveBreaches = 0;
  let totalAccumulatedDemurrage = 0;

  containers.forEach(container => {
    const metrics = calculateContainerStatus(container.gate_in_time, container.gate_out_time);
    if (container.status === 'IN_ICD') {
      if (metrics.isBreached) totalActiveBreaches += 1;
      totalAccumulatedDemurrage += metrics.demurrageFee;
    }
  });

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-gradient-to-tr from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-gradient-to-tr from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-cyan-500/10 blur-[100px] rounded-full animate-pulse pointer-events-none"></div>
        <div className="max-w-md w-full bg-slate-900/70 backdrop-blur-3xl border border-slate-700/60 rounded-3xl p-8 shadow-[0_0_50px_rgba(6,182,212,0.1)] relative">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-t-3xl"></div>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 font-mono text-xl font-bold mb-3 shadow-inner">
              Ω
            </div>
            <h1 className="text-xl font-black tracking-[0.25em] text-white uppercase">Project Titan</h1>
            <p className="text-slate-400 text-[10px] tracking-widest uppercase font-mono mt-1.5 flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block animate-pulse"></span>
              Identity Core Authorization
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Clerk Email Address</label>
              <input
                type="email"
                placeholder="clerk@terminal.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400 font-mono transition-all focus:ring-4 focus:ring-cyan-500/5 shadow-inner placeholder:text-slate-700"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-mono">Security Access Key</label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400 font-mono transition-all focus:ring-4 focus:ring-cyan-500/5 shadow-inner placeholder:text-slate-700"
              />
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-blue-600 hover:opacity-95 text-slate-950 font-black py-3.5 rounded-xl transition-all font-mono text-xs uppercase tracking-widest mt-2 active:scale-[0.98] shadow-lg shadow-cyan-500/10 disabled:opacity-50"
            >
              {authLoading ? 'Verifying Credentials...' : 'Authorize Secure Session'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-tr from-slate-950 via-slate-900 to-blue-950 text-slate-100 p-8 font-sans relative overflow-hidden selection:bg-cyan-500/30">

      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none animate-[pulse_8s_ease-in-out_infinite]"></div>
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none animate-[pulse_6s_ease-in-out_infinite_2s]"></div>

      <ConfirmModal
        open={confirmDelete}
        title="Confirm Batch Purge"
        message={`This permanently deletes ${selectedIds.length} container record(s) from the port database. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        danger
        onConfirm={handleBatchDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <div className="max-w-7xl mx-auto relative z-10 space-y-6">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800/80 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">Project Titan</h1>
            <p className="text-xs font-mono text-cyan-400 uppercase tracking-widest mt-1">ICD Internal Operations Control Center</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-4 shadow-md">
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {profile.email}
              </span>
              <button onClick={handleLogout} className="bg-rose-950/40 hover:bg-rose-900 text-rose-200 text-[10px] uppercase font-mono tracking-wider px-3 py-1.5 rounded-lg border border-rose-800/60 transition-all">
                Log Out Session
              </button>
            </div>

            <div className="bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800 min-w-[140px] text-center shadow-md">
              <span className="text-[9px] text-slate-500 block uppercase tracking-widest font-mono font-bold">Live System Time</span>
              <span className="text-base font-mono text-cyan-400 font-bold">
                {mounted ? time.toLocaleTimeString() : '--:--:--'}
              </span>
            </div>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alertItem) => (
              <div key={alertItem.id} className="bg-rose-950/20 border border-rose-800/60 backdrop-blur-md rounded-xl p-3.5 flex justify-between items-center shadow-lg animate-pulse">
                <span className="text-xs font-mono text-rose-400 flex items-center gap-2">
                  {alertItem.msg}
                </span>
                <span className="text-[10px] font-mono text-rose-500 bg-slate-950 px-2 py-1 rounded border border-rose-900/40">
                  Logged at {alertItem.time}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-slate-800/80 p-6 rounded-2xl shadow-xl hover:border-slate-700/60 transition-all duration-300">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 font-mono">Manifest Inbound Cargo Row</h2>
          <form onSubmit={handleAddContainer} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1.5">Container Serial ID</label>
              <input
                type="text"
                placeholder="e.g. MSCU100088"
                value={newContainerId}
                onChange={(e) => setNewContainerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm uppercase text-white focus:outline-none focus:border-cyan-400 font-mono focus:ring-4 focus:ring-cyan-500/5 transition-all shadow-inner placeholder:text-slate-800"
                required
              />
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="block text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1.5">Consignee Notification Email</label>
              <input
                type="email"
                placeholder="owner@company.com"
                value={newOwnerEmail}
                onChange={(e) => setNewOwnerEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 font-mono focus:ring-4 focus:ring-cyan-500/5 transition-all shadow-inner placeholder:text-slate-800"
                required
              />
            </div>
            <button type="submit" disabled={addLoading} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-95 text-white text-xs font-mono font-bold uppercase tracking-widest h-[42px] px-6 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-cyan-500/5 disabled:opacity-50">
              {addLoading ? 'Deploying…' : 'Deploy to Yard'}
            </button>
          </form>
        </div>

        {selectedIds.length > 0 && (
          <div className="bg-slate-950/90 border border-cyan-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-[0_0_30px_rgba(6,182,212,0.1)] transition-all" style={{ animation: 'slideIn 0.2s ease-out' }}>
            <div className="flex items-center gap-3">
              <span className="bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-mono font-bold text-[10px] px-2.5 py-1 rounded-md tracking-wider">
                {selectedIds.length} SELECTED
              </span>
              <span className="text-xs font-mono text-slate-300">Bulk configuration controls active</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Set Group Status:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) handleBatchStatusChange(e.target.value);
                  e.target.value = "";
                }}
                defaultValue=""
                className="bg-slate-900 border border-slate-800 text-xs font-mono text-white rounded-lg px-3 py-1.5 cursor-pointer focus:outline-none focus:border-cyan-400"
              >
                <option value="" disabled hidden>-- Choose Action --</option>
                {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <div className="h-4 w-[1px] bg-slate-800 mx-1"></div>
              <button
                onClick={() => setConfirmDelete(true)}
                className="bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800 font-mono text-[10px] uppercase tracking-wider px-4 py-1.5 rounded-lg transition-all"
              >
                Delete Selected
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl shadow-md">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block font-bold mb-1.5">Yard Volumetric Load</span>
            <div className="flex justify-between items-baseline">
              <span className="text-3xl font-mono font-black text-white">{activeInYard} <span className="text-xs text-slate-500 font-sans font-normal uppercase tracking-wider">Containers</span></span>
              <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-900/60">
                {Math.round((activeInYard / yardCapacityLimit) * 100)}% Cap.
              </span>
            </div>
            <div className="w-full bg-slate-950 h-1.5 rounded-full mt-4 overflow-hidden border border-slate-900">
              <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500" style={{ width: `${(activeInYard / yardCapacityLimit) * 100}%` }}></div>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl shadow-md">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block font-bold mb-1.5">Critical SLA Breaches</span>
            <span className={`text-3xl font-mono font-black block transition-colors duration-500 ${totalActiveBreaches > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
              {totalActiveBreaches} <span className="text-xs font-sans font-normal text-slate-500 uppercase tracking-wider">Active</span>
            </span>
            <p className="text-[10px] text-slate-500 mt-2.5 font-sans leading-relaxed">Containers exceeding maximum free terminal stay limit window.</p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl shadow-md">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block font-bold mb-1.5">Total Outstanding Penalties</span>
            <span className={`text-3xl font-mono font-black block transition-colors duration-500 ${totalAccumulatedDemurrage > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              ${totalAccumulatedDemurrage}.00
            </span>
            <p className="text-[10px] text-slate-500 mt-2.5 font-sans leading-relaxed">Accumulated pool of active demurrage penalty assets generation.</p>
          </div>
        </div>

        <div className="bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[10px] font-mono font-bold uppercase tracking-[0.15em]">
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={containers.length > 0 && selectedIds.length === containers.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-cyan-600 focus:ring-0 cursor-pointer accent-cyan-500"
                    />
                  </th>
                  <th className="p-4">Container ID</th>
                  <th className="p-4">Consignee Email</th>
                  <th className="p-4">Status Toggle</th>
                  <th className="p-4">Time / Countdown</th>
                  <th className="p-4">Live Demurrage Fee</th>
                </tr>
              </thead>
              {loading ? (
                <tbody><tr><td colSpan={6}><TableSkeleton rows={6} cols={6} /></td></tr></tbody>
              ) : containers.length === 0 ? (
                <tbody><tr><td colSpan={6}><EmptyState title="No containers in the yard" message="Deploy one above to get started." /></td></tr></tbody>
              ) : (
                <tbody className="divide-y divide-slate-800/60 text-xs font-mono text-slate-300">
                  {containers.map((container) => {
                    const metrics = calculateContainerStatus(container.gate_in_time, container.gate_out_time);
                    const isChecked = selectedIds.includes(container.id);

                    return (
                      <tr key={container.id} className={`transition-all duration-150 ${isChecked ? 'bg-cyan-950/10 hover:bg-cyan-950/20' : 'hover:bg-slate-950/30'}`}>
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleSelectRow(container.id)}
                            className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-cyan-600 focus:ring-0 cursor-pointer accent-cyan-500"
                          />
                        </td>
                        <td className="p-4 font-black text-white tracking-wider text-sm">{container.id}</td>
                        <td className="p-4 text-slate-400">{container.owner_email}</td>
                        <td className="p-4">
                          <select
                            value={container.status}
                            onChange={async (e) => {
                              const updatedStatus = e.target.value;
                              const updates = {
                                status: updatedStatus,
                                gate_out_time: updatedStatus === 'GATE_OUT' ? new Date().toISOString() : null,
                              };

                              setContainers(prev => prev.map(c =>
                                c.id === container.id ? { ...c, ...updates } : c
                              ));

                              const { error } = await supabase.from('containers').update(updates).eq('id', container.id);
                              if (error) showToast(`Update failed: ${error.message}`, 'error');
                            }}
                            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono cursor-pointer focus:outline-none focus:border-cyan-400"
                          >
                            {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </td>
                        <td className="p-4">
                          <div className="text-slate-300 mb-1">Spent: <span className="font-bold text-white">{metrics.hoursElapsed}h</span></div>
                          <StatusBadge gateInTime={container.gate_in_time} gateOutTime={container.gate_out_time} status={container.status} />
                        </td>
                        <td className="p-4 font-bold text-sm">
                          {metrics.demurrageFee > 0 && container.status === 'IN_ICD' ? (
                            <span className="text-rose-400">${metrics.demurrageFee}.00</span>
                          ) : (
                            <span className="text-slate-600">$0.00</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
