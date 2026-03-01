import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : 'http://localhost:3000';

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

export const api = {
  // Auth
  getProfile: () => apiCall('/api/auth/me'),
  updateProfile: (data: { full_name: string }) =>
    apiCall('/api/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Employees
  listEmployees: () => apiCall('/api/employees'),
  getEmployee: (id: string) => apiCall(`/api/employees/${id}`),
  createEmployee: (data: { name: string; role?: string; system_prompt?: string; trigger_prefix?: string; personality_preset?: string; soul_md_custom?: string }) =>
    apiCall('/api/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: { name?: string; role?: string; system_prompt?: string; trigger_prefix?: string; active?: boolean; personality_preset?: string; soul_md_custom?: string }) =>
    apiCall(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmployee: (id: string) =>
    apiCall(`/api/employees/${id}`, { method: 'DELETE' }),
  getEmployeeStatus: (id: string) =>
    apiCall(`/api/employees/${id}/status`),

  // Channels
  connectWhatsApp: (empId: string) =>
    apiCall(`/api/connect/whatsapp/${empId}`, { method: 'POST' }),
  connectTelegram: (empId: string, token: string) =>
    apiCall(`/api/connect/telegram/${empId}`, { method: 'POST', body: JSON.stringify({ token }) }),
  disconnectWhatsApp: (empId: string) =>
    apiCall(`/api/connect/whatsapp/${empId}/disconnect`, { method: 'POST' }),
  disconnectTelegram: (empId: string) =>
    apiCall(`/api/connect/telegram/${empId}/disconnect`, { method: 'POST' }),

  // Settings
  saveApiKey: (api_key: string, provider: string, tier: string) =>
    apiCall('/api/settings/api-key', { method: 'PUT', body: JSON.stringify({ api_key, provider, tier }) }),
  removeApiKey: () =>
    apiCall('/api/settings/api-key', { method: 'DELETE' }),
  toggleLongContext: (enabled: boolean) =>
    apiCall('/api/settings/long-context', { method: 'PUT', body: JSON.stringify({ enabled }) }),

  // Marketplace
  listSkills: () => apiCall('/api/marketplace/skills'),
  installSkill: (employee_id: string, skill_id: string) =>
    apiCall('/api/marketplace/install', { method: 'POST', body: JSON.stringify({ employee_id, skill_id }) }),
  uninstallSkill: (employee_id: string, skill_id: string) =>
    apiCall('/api/marketplace/uninstall', { method: 'POST', body: JSON.stringify({ employee_id, skill_id }) }),

  // Installed skills for an employee
  getInstalledSkills: (employeeId: string) =>
    apiCall(`/api/marketplace/installed/${employeeId}`),

  // Configure Brave API key for web-browser skill
  configureBrave: (employee_id: string, api_key: string) =>
    apiCall('/api/marketplace/configure-brave', { method: 'POST', body: JSON.stringify({ employee_id, api_key }) }),

  // Configure Twitter Bearer Token
  configureTwitter: (employee_id: string, bearer_token: string) =>
    apiCall('/api/marketplace/configure-twitter', { method: 'POST', body: JSON.stringify({ employee_id, bearer_token }) }),

  // Configure Spotify Client ID + Secret
  configureSpotify: (employee_id: string, client_id: string, client_secret: string) =>
    apiCall('/api/marketplace/configure-spotify', { method: 'POST', body: JSON.stringify({ employee_id, client_id, client_secret }) }),

  // Configure MCP Server (add/update) — Disabled: backend routes commented out in marketplace.js
  // configureMcp: (employee_id: string, server_name: string, server_url: string, auth_token?: string) =>
  //   apiCall('/api/marketplace/configure-mcp', { method: 'POST', body: JSON.stringify({ employee_id, server_name, server_url, auth_token }) }),

  // List configured MCP servers — Disabled: backend routes commented out in marketplace.js
  // getMcpServers: (employee_id: string) =>
  //   apiCall(`/api/marketplace/mcp-servers/${employee_id}`),

  // Remove an MCP server — Disabled: backend routes commented out in marketplace.js
  // removeMcpServer: (employee_id: string, server_name: string) =>
  //   apiCall('/api/marketplace/mcp-server', { method: 'DELETE', body: JSON.stringify({ employee_id, server_name }) }),

  // OAuth — Disabled: using Composio for Gmail/Calendar instead of direct Google OAuth
  // startGoogleOAuth: (employeeId: string, skillSlug: string) =>
  //   apiCall(`/api/oauth/google/start?employee_id=${employeeId}&skill_slug=${skillSlug}`),
  // getOAuthStatus: (provider: string) =>
  //   apiCall(`/api/oauth/status?provider=${provider}`),

  // Billing
  subscribe: (plan: string) =>
    apiCall('/api/billing/subscribe', { method: 'POST', body: JSON.stringify({ plan }) }),
  verifyPayment: (data: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string; plan?: string }) =>
    apiCall('/api/billing/verify', { method: 'POST', body: JSON.stringify(data) }),
  getSubscription: () => apiCall('/api/billing/subscription'),
  cancelSubscription: () =>
    apiCall('/api/billing/cancel', { method: 'POST' }),
  getServerCapacity: () => apiCall('/api/billing/capacity'),

  // Integrations (Composio)
  getIntegrationApps: () => apiCall('/api/integrations/apps'),
  connectIntegration: (toolkit_slug: string, employee_id: string) =>
    apiCall('/api/integrations/connect', { method: 'POST', body: JSON.stringify({ toolkit_slug, employee_id }) }),
  getIntegrationConnections: () => apiCall('/api/integrations/connections'),
  disconnectIntegration: (connectionId: string) =>
    apiCall(`/api/integrations/disconnect/${connectionId}`, { method: 'DELETE' }),
  confirmConnection: (toolkit_slug: string) =>
    apiCall('/api/integrations/confirm-connection', { method: 'POST', body: JSON.stringify({ toolkit_slug }) }),
  getIntegrationTools: (toolkit: string) =>
    apiCall(`/api/integrations/tools/${toolkit}`),
  submitReport: (data: { category?: string; subject: string; description: string; page?: string; metadata?: Record<string, unknown> }) =>
    apiCall('/api/integrations/report', { method: 'POST', body: JSON.stringify(data) }),

  // VAPI
  getVapiServerUrl: (employeeId: string) =>
    apiCall(`/api/vapi/server-url/${employeeId}`),

  // Chat
  getChatStatus: () => apiCall('/api/chat/status'),
  // getChatHistory: (limit?: number, before?: string) => {
  //   const params = new URLSearchParams();
  //   if (limit) params.set('limit', String(limit));
  //   if (before) params.set('before', before);
  //   const qs = params.toString() ? `?${params.toString()}` : '';
  //   return apiCall(`/api/chat/history${qs}`);
  // },
  // sendChatMessage: (message: string) =>
  //   apiCall('/api/chat/message', {
  //     method: 'POST',
  //     body: JSON.stringify({ message }),
  //   }),
  // getChatStreamUrl: (chatId: string) =>
  //   `${API_URL}/api/chat/stream/${chatId}`,
  // clearChatHistory: () =>
  //   apiCall('/api/chat/history', { method: 'DELETE' }),

  // Logs
  getLogs: (employeeId?: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (offset) params.set('offset', String(offset));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiCall(employeeId ? `/api/logs/${employeeId}${qs}` : `/api/logs${qs}`);
  },
};
