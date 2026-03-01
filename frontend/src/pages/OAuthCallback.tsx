import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const skill = searchParams.get('skill');
  const employeeId = searchParams.get('employee_id');

  useEffect(() => {
    if (success === 'true') {
      setStatus('success');
      // Notify opener if available (may be null due to cross-origin navigation through Google)
      try {
        if (window.opener) {
          window.opener.postMessage(
            { type: 'oauth_success', skill, employee_id: employeeId },
            window.location.origin
          );
        }
      } catch { /* cross-origin, ignore */ }
      // Always try to close popup after brief delay — works whether opener exists or not
      setTimeout(() => {
        try { window.close(); } catch { /* ignore */ }
      }, 1800);
    } else if (error) {
      setStatus('error');
      // Notify opener of error
      try {
        if (window.opener) {
          window.opener.postMessage(
            { type: 'oauth_error', error },
            window.location.origin
          );
        }
      } catch { /* cross-origin, ignore */ }
      // Also try closing on error after a longer delay
      setTimeout(() => {
        try { window.close(); } catch { /* ignore */ }
      }, 3000);
    } else {
      setStatus('loading');
    }
  }, [success, error, skill, employeeId]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Connecting your account...</h2>
            <p className="text-zinc-500 text-sm">Please wait while we complete the setup.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="h-16 w-16 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Account Connected!</h2>
            <p className="text-zinc-500 text-sm mb-2">
              Your Google account has been linked to the {skill ? skill.charAt(0).toUpperCase() + skill.slice(1) : ''} skill.
              Your AI employee can now access this service.
            </p>
            <p className="text-zinc-600 text-xs mb-6">This window will close automatically. If not, you can close it manually.</p>
            <div className="flex flex-col gap-3">
              {employeeId && (
                <Link
                  to={`/employees/${employeeId}`}
                  className="inline-flex items-center justify-center px-6 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl text-sm font-medium transition-all shadow-md shadow-white/10"
                >
                  View Employee
                </Link>
              )}
              <Link
                to="/marketplace"
                className="inline-flex items-center justify-center px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-all"
              >
                Back to Marketplace
              </Link>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="h-16 w-16 rounded-full bg-red-400/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Connection Failed</h2>
            <p className="text-zinc-500 text-sm mb-2">
              {error === 'access_denied' && 'You denied access to your Google account.'}
              {error === 'invalid_state' && 'The request expired. Please try again.'}
              {error === 'token_exchange_failed' && 'Failed to connect with Google. Please try again.'}
              {error === 'server_error' && 'An unexpected error occurred. Please try again.'}
              {!['access_denied', 'invalid_state', 'token_exchange_failed', 'server_error'].includes(error || '') && `Error: ${error}`}
            </p>
            <Link
              to="/marketplace"
              className="inline-flex items-center justify-center px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-all mt-4"
            >
              Back to Marketplace
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
