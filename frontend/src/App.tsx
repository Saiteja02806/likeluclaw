import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import PremiumGuard from '@/components/PremiumGuard';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Dashboard from '@/pages/Dashboard';
import CreateEmployee from '@/pages/CreateEmployee';
import EmployeeDetail from '@/pages/EmployeeDetail';
import ConnectWhatsApp from '@/pages/ConnectWhatsApp';
import ConnectTelegram from '@/pages/ConnectTelegram';
import ApiKeys from '@/pages/ApiKeys';
import Marketplace from '@/pages/Marketplace';
import Billing from '@/pages/Billing';
import Logs from '@/pages/Logs';
import Integrations from '@/pages/Integrations';
// import Chat from '@/pages/Chat'; // Disabled — focusing on Telegram bot
import ProfileSettings from '@/pages/ProfileSettings';
import OAuthCallback from '@/pages/OAuthCallback';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors closeButton />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />

            {/* Protected routes with sidebar layout */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Dashboard is always accessible (shows upgrade prompt for free users) */}
              <Route path="/dashboard" element={<Dashboard />} />
              {/* Billing is always accessible (so free users can upgrade) */}
              <Route path="/billing" element={<Billing />} />
              {/* Settings is always accessible */}
              <Route path="/settings" element={<ProfileSettings />} />

              {/* Premium-only routes */}
              <Route path="/employees/new" element={<PremiumGuard><CreateEmployee /></PremiumGuard>} />
              <Route path="/employees/:id" element={<PremiumGuard><EmployeeDetail /></PremiumGuard>} />
              <Route path="/connect/whatsapp/:id" element={<PremiumGuard><ConnectWhatsApp /></PremiumGuard>} />
              <Route path="/connect/telegram/:id" element={<PremiumGuard><ConnectTelegram /></PremiumGuard>} />
              <Route path="/settings/api-keys" element={<PremiumGuard><ApiKeys /></PremiumGuard>} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/logs" element={<PremiumGuard><Logs /></PremiumGuard>} />
              {/* <Route path="/chat" element={<PremiumGuard><Chat /></PremiumGuard>} /> */} {/* Disabled — focusing on Telegram bot */}
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
