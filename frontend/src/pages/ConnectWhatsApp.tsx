import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Construction } from 'lucide-react';

export default function ConnectWhatsApp() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/employees/${id}`} className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Connect WhatsApp</h1>
          <p className="text-xs text-zinc-500 mt-0.5">WhatsApp integration</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 max-w-lg mx-auto text-center">
        <div className="py-12 space-y-5">
          <div className="h-16 w-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto">
            <Construction className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Under Development</h2>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
              WhatsApp integration is currently being developed and will be available soon. In the meantime, please use <strong className="text-blue-400">Telegram</strong> to connect your AI employee.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/10 text-amber-400/80 border border-amber-500/20">
            <MessageSquare className="h-3 w-3" /> Coming Soon
          </div>
          <div className="pt-2">
            <Link to={`/employees/${id}`}
              className="inline-flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-white/10 btn-glow">
              <ArrowLeft className="h-4 w-4" /> Back to Employee
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
