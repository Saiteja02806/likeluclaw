import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ScrollText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface LogEntry {
  id: string;
  employee_id: string;
  employee_name?: string;
  action: string;
  success: boolean;
  details: string;
  created_at: string;
}

interface Employee {
  id: string;
  name: string;
}

const PAGE_SIZE = 20;

const actionColors: Record<string, string> = {
  'employee.created': 'text-emerald-400',
  'employee.deleted': 'text-red-400',
  'skill.installed': 'text-blue-400',
  'skill.uninstalled': 'text-zinc-400',
  'whatsapp.connected': 'text-green-400',
  'telegram.connected': 'text-blue-400',
  'settings.updated': 'text-amber-400',
};

export default function Logs() {
  const [searchParams] = useSearchParams();
  const initialEmp = searchParams.get('employee') || '';

  const [employeeFilter, setEmployeeFilter] = useState(initialEmp);
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);

  const { data: empData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.listEmployees().catch(() => ({ employees: [] })),
  });

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['logs', employeeFilter, page],
    queryFn: () => api.getLogs(employeeFilter || undefined, PAGE_SIZE, page * PAGE_SIZE),
  });

  const employees: Employee[] = empData?.employees || [];
  const allLogs: LogEntry[] = logsData?.logs || logsData || [];

  // Client-side action filter
  const logs = actionFilter
    ? allLogs.filter((l) => l.action.toLowerCase().includes(actionFilter.toLowerCase()))
    : allLogs;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500 mb-1">Monitoring</p>
        <h1 className="text-3xl font-bold text-white tracking-tight">Activity Logs</h1>
        <p className="text-zinc-500 text-[15px] mt-2">Track all actions across your AI employees</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={employeeFilter} onChange={(e) => { setEmployeeFilter(e.target.value); setPage(0); }}
          className="px-4 py-3 border border-zinc-700/80 rounded-xl text-sm bg-zinc-800/80 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all">
          <option value="">All employees</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <input type="text" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action..."
          className="px-4 py-3 border border-zinc-700/80 rounded-xl text-sm bg-zinc-800/80 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all" />
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/80 border-dashed bg-zinc-900/30 p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-zinc-800/80 flex items-center justify-center mx-auto mb-4">
            <ScrollText className="h-7 w-7 text-zinc-500" />
          </div>
          <p className="text-zinc-400 text-sm font-medium mb-1">No activity yet</p>
          <p className="text-zinc-600 text-xs">Activity will appear here once your employees start working</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/80 border-b border-zinc-800">
                <tr>
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wider">Employee</th>
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 text-zinc-400">
                      {log.employee_name || employees.find((e) => e.id === log.employee_id)?.name || '—'}
                    </td>
                    <td className={`px-4 py-3 font-medium ${actionColors[log.action] || 'text-zinc-200'}`}>{log.action}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                        log.success !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${log.success !== false ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {log.success !== false ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Page {page + 1}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                className="flex items-center gap-1 px-3 py-2 border border-zinc-700/80 rounded-xl text-sm text-zinc-300 disabled:opacity-30 hover:bg-zinc-800/80 transition-all duration-200 cursor-pointer active:scale-[0.97]">
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button onClick={() => setPage(page + 1)} disabled={allLogs.length < PAGE_SIZE}
                className="flex items-center gap-1 px-3 py-2 border border-zinc-700/80 rounded-xl text-sm text-zinc-300 disabled:opacity-30 hover:bg-zinc-800/80 transition-all duration-200 cursor-pointer active:scale-[0.97]">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
