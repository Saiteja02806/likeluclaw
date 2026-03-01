const WebSocket = require('ws');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');
const url = require('url');

function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ noServer: true });

  // Upgrade HTTP requests to WebSocket only for /ws/* paths
  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    if (pathname && pathname.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (clientWs, req) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Extract token from query params
    const token = parsedUrl.query.token;

    if (!token) {
      clientWs.send(JSON.stringify({ type: 'error', message: 'Authentication required. Pass ?token=<jwt>' }));
      clientWs.close(4001, 'Unauthorized');
      return;
    }

    // Verify the user's JWT via singleton admin client (no per-connection client needed)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      clientWs.send(JSON.stringify({ type: 'error', message: 'Invalid or expired token' }));
      clientWs.close(4001, 'Unauthorized');
      return;
    }

    // Route based on path: /ws/whatsapp/:employeeId
    const match = pathname.match(/^\/ws\/whatsapp\/([a-f0-9-]+)$/);
    if (match) {
      const employeeId = match[1];
      await handleWhatsAppPairing(clientWs, user, employeeId);
      return;
    }

    // Route: /ws/chat/:employeeId — web chat with AI employee
    const chatMatch = pathname.match(/^\/ws\/chat\/([a-f0-9-]+)$/);
    if (chatMatch) {
      const employeeId = chatMatch[1];
      await handleWebChat(clientWs, user, employeeId);
      return;
    }

    // Route: /ws/status/:employeeId — live status updates
    const statusMatch = pathname.match(/^\/ws\/status\/([a-f0-9-]+)$/);
    if (statusMatch) {
      const employeeId = statusMatch[1];
      await handleStatusStream(clientWs, user, employeeId);
      return;
    }

    clientWs.send(JSON.stringify({ type: 'error', message: 'Unknown WebSocket route' }));
    clientWs.close(4004, 'Not Found');
  });

  logger.info('WebSocket server initialized');
  return wss;
}

async function handleWhatsAppPairing(clientWs, user, employeeId) {
  // Verify employee belongs to user and get port
  const { data: employee, error } = await supabaseAdmin
    .from('employees')
    .select('id, container_name, status, gateway_token, whatsapp_connected')
    .eq('id', employeeId)
    .eq('user_id', user.id)
    .single();

  if (error || !employee) {
    clientWs.send(JSON.stringify({ type: 'error', message: 'Employee not found' }));
    clientWs.close(4004, 'Not Found');
    return;
  }

  if (employee.status !== 'running') {
    clientWs.send(JSON.stringify({ type: 'error', message: `Employee is not running (${employee.status})` }));
    clientWs.close(4000, 'Employee not running');
    return;
  }

  clientWs.send(JSON.stringify({ type: 'info', message: 'Connecting to container for QR code...' }));

  // Connect to OpenClaw container's WebSocket
  let containerWs;
  try {
    containerWs = new WebSocket(`ws://${employee.container_name}:18789`);
  } catch (err) {
    clientWs.send(JSON.stringify({ type: 'error', message: 'Failed to connect to container' }));
    clientWs.close(4502, 'Container unreachable');
    return;
  }

  containerWs.on('open', () => {
    logger.info('Connected to container WS', { employeeId, dns: employee.container_name });

    // Authenticate with the container gateway
    containerWs.send(JSON.stringify({
      type: 'auth',
      token: employee.gateway_token
    }));

    // Request WhatsApp QR code
    containerWs.send(JSON.stringify({
      type: 'channel-action',
      channel: 'whatsapp',
      action: 'login'
    }));
  });

  // Relay messages from container → frontend
  containerWs.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'qr') {
        // Relay QR code to frontend
        clientWs.send(JSON.stringify({
          type: 'qr',
          qrData: msg.qrData || msg.data,
          timestamp: Date.now()
        }));
      } else if (msg.type === 'connected' || msg.type === 'whatsapp-connected') {
        // WhatsApp successfully paired
        await supabaseAdmin
          .from('employees')
          .update({ whatsapp_connected: true })
          .eq('id', employeeId);

        await supabaseAdmin.from('activity_logs').insert({
          user_id: user.id,
          employee_id: employeeId,
          action: 'whatsapp.connected'
        });

        clientWs.send(JSON.stringify({
          type: 'connected',
          message: 'WhatsApp connected successfully!'
        }));

        logger.info('WhatsApp connected', { employeeId });
      } else if (msg.type === 'error') {
        clientWs.send(JSON.stringify({
          type: 'error',
          message: msg.message || 'Container error'
        }));
      } else {
        // Forward any other messages
        clientWs.send(JSON.stringify(msg));
      }
    } catch {
      // Forward raw data if not JSON
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data.toString());
      }
    }
  });

  containerWs.on('error', (err) => {
    logger.error('Container WS error', { employeeId, error: err.message });
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'error', message: 'Container connection error' }));
    }
  });

  containerWs.on('close', () => {
    logger.info('Container WS closed', { employeeId });
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'info', message: 'Container connection closed' }));
    }
  });

  // Relay messages from frontend → container
  clientWs.on('message', (data) => {
    if (containerWs.readyState === WebSocket.OPEN) {
      containerWs.send(data.toString());
    }
  });

  // Cleanup on frontend disconnect
  clientWs.on('close', () => {
    if (containerWs.readyState === WebSocket.OPEN) {
      containerWs.close();
    }
  });
}

async function handleStatusStream(clientWs, user, employeeId) {
  // Verify employee belongs to user
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('id, status, whatsapp_connected, telegram_connected')
    .eq('id', employeeId)
    .eq('user_id', user.id)
    .single();

  if (!employee) {
    clientWs.send(JSON.stringify({ type: 'error', message: 'Employee not found' }));
    clientWs.close(4004, 'Not Found');
    return;
  }

  // Send initial status
  clientWs.send(JSON.stringify({ type: 'status', ...employee }));

  // Poll for status changes every 5 seconds
  const interval = setInterval(async () => {
    if (clientWs.readyState !== WebSocket.OPEN) {
      clearInterval(interval);
      return;
    }

    const { data: updated } = await supabaseAdmin
      .from('employees')
      .select('id, status, whatsapp_connected, telegram_connected')
      .eq('id', employeeId)
      .single();

    if (updated) {
      clientWs.send(JSON.stringify({ type: 'status', ...updated }));
    }
  }, 5000);

  clientWs.on('close', () => clearInterval(interval));
}

async function handleWebChat(clientWs, _user, _employeeId) {
  // Chat is now handled via REST API (POST /api/chat/:employeeId/message)
  // This WS endpoint is deprecated — inform any legacy clients
  clientWs.send(JSON.stringify({
    type: 'error',
    message: 'WebSocket chat is deprecated. Use the REST API at POST /api/chat/:employeeId/message instead.'
  }));
  clientWs.close(4010, 'Deprecated');
}

module.exports = { setupWebSocketServer };
