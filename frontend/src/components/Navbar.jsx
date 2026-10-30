import React from 'react';
import { Shield, ShieldAlert, User, LogOut, CheckCircle2, FileText } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function Navbar({ onOpenUpload }) {
  const { user, logout, quickSwitchRole } = useAuthStore();

  const handleRoleSwitch = async (e) => {
    const newRole = e.target.value;
    const ok = await quickSwitchRole(newRole);
    if (ok) {
      toast.success(`Switched role to ${newRole === 'admin' ? 'Compliance Admin' : 'Researcher'}`);
    } else {
      toast.error('Failed to switch role');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#090e1a]/80 border-b border-white/10 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-xl">
            §
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-white tracking-tight">RegTech Intelligence</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Gemini 2.5 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400">Automated Regulatory Ingestion & PII Redaction Engine</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {/* Quick Upload Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-md shadow-blue-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <FileText className="w-4 h-4" />
            <span>Upload Document</span>
          </button>

          {/* User & Role Switcher */}
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-200">{user?.username || 'Analyst'}</div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="capitalize">{user?.role || 'researcher'}</span>
              </div>
            </div>

            {/* Quick Demo Switcher */}
            <select
              value={user?.role || 'researcher'}
              onChange={handleRoleSwitch}
              className="bg-slate-900 border border-white/10 text-xs rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              title="Switch demo persona"
            >
              <option value="researcher">Role: Researcher</option>
              <option value="admin">Role: Admin</option>
            </select>

            {/* Logout */}
            <button
              onClick={() => {
                logout();
                toast.success('Logged out');
              }}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
