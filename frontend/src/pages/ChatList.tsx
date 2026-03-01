import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plug, Bot, ArrowRight, Loader2, WifiOff } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  role: string;
  status: string;
}

export default function ChatList() {
  const { data: empData, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.listEmployees().catch(() => ({ employees: [] })),
  });

  const employees: Employee[] = empData?.employees || [];
  const runningEmployees = employees.filter((e: Employee) => e.status === 'running');
  const otherEmployees = employees.filter((e: Employee) => e.status !== 'running');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!employees?.length) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Chat</h1>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="h-16 w-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
            <Plug className="h-8 w-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400 text-sm font-medium">No employees yet</p>
          <p className="text-zinc-600 text-xs mt-1">Create an employee first to manage integrations</p>
          <Link to="/employees/new" className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-xl transition-colors">
            Create Employee
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2.5">
          <Plug className="h-6 w-6 text-amber-400" />
          Integration Chat
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your connected integrations — Gmail, Sheets, Slack, Stripe &amp; more</p>
      </div>

      {runningEmployees.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Online</h2>
          <div className="grid gap-3">
            {runningEmployees.map((emp: Employee) => (
              <Link
                key={emp.id}
                to={`/chat/${emp.id}`}
                className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-amber-500/20 p-4 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{emp.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[11px] text-zinc-500">{emp.role || 'AI Employee'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-zinc-600 group-hover:text-amber-400 transition-colors">
                  <Plug className="h-4 w-4" />
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {otherEmployees.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Offline</h2>
          <div className="grid gap-3">
            {otherEmployees.map((emp: Employee) => (
              <div
                key={emp.id}
                className="flex items-center justify-between rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-4 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-zinc-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-400 text-sm">{emp.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <WifiOff className="h-3 w-3 text-zinc-600" />
                      <span className="text-[11px] text-zinc-600">{emp.status}</span>
                    </div>
                  </div>
                </div>
                <Link to={`/employees/${emp.id}`} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                  Start →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {runningEmployees.length === 0 && (
        <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-5 text-center">
          <p className="text-zinc-400 text-sm">No employees are running. Start an employee to manage integrations via chat.</p>
        </div>
      )}
    </div>
  );
}
