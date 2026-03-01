const express = require('express');
const WebSocket = require('ws');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');

const router = express.Router();

// ── Helper: Send a message to an employee container via WebSocket ──
function sendToContainer(containerDns, gatewayToken, message, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${containerDns}:18789`);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('Container response timed out'));
    }, timeoutMs);

    ws.on('open', () => {
      // Authenticate
      ws.send(JSON.stringify({ type: 'auth', token: gatewayToken }));
      // Send the actual message
      ws.send(JSON.stringify(message));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Skip auth acknowledgments, wait for actual response
        if (msg.type === 'auth-ok' || msg.type === 'authenticated') return;
        clearTimeout(timer);
        ws.close();
        resolve(msg);
      } catch {
        clearTimeout(timer);
        ws.close();
        resolve({ text: data.toString() });
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Container connection failed: ${err.message}`));
    });
  });
}

// ── Helper: Look up employee and validate ──
async function getEmployee(employeeId) {
  const { data: employee, error } = await supabaseAdmin
    .from('employees')
    .select('id, name, user_id, container_name, status, gateway_token, vapi_assistant_id')
    .eq('id', employeeId)
    .single();

  if (error || !employee) return null;
  return employee;
}

// ── POST /api/vapi/webhook/:employeeId ──
// VAPI sends events here when phone calls happen on a user's phone number.
// No auth middleware — VAPI sends raw webhooks. We validate by employeeId.
router.post('/webhook/:employeeId', async (req, res) => {
  const { employeeId } = req.params;
  const event = req.body;
  const eventType = event?.message?.type || event?.type || 'unknown';

  logger.info('VAPI webhook received', { employeeId, eventType });

  try {
    // Look up the employee
    const employee = await getEmployee(employeeId);
    if (!employee) {
      logger.warn('VAPI webhook: employee not found', { employeeId });
      return res.status(404).json({ error: 'Employee not found' });
    }

    if (employee.status !== 'running') {
      logger.warn('VAPI webhook: employee not running', { employeeId, status: employee.status });
      return res.status(503).json({ error: 'Agent is not currently running' });
    }

    switch (eventType) {
      // ── assistant-request: VAPI asks which assistant to use for this call ──
      case 'assistant-request': {
        logger.info('VAPI assistant-request', { employeeId, callId: event?.call?.id });

        // Return the assistant configuration dynamically
        // If the employee has a vapi_assistant_id, use it; otherwise return a default config
        if (employee.vapi_assistant_id) {
          return res.json({ assistantId: employee.vapi_assistant_id });
        }

        // Default: return an inline assistant config that describes this employee
        return res.json({
          assistant: {
            model: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `You are ${employee.name}, an AI assistant. Be helpful, professional, and concise. Handle the caller's request naturally.`
                }
              ]
            },
            voice: {
              provider: '11labs',
              voiceId: 'rachel'
            },
            firstMessage: `Hello! This is ${employee.name}. How can I help you today?`,
            endCallMessage: 'Thank you for calling. Goodbye!',
            transcriber: {
              provider: 'deepgram',
              model: 'nova-2',
              language: 'en'
            },
            serverUrl: `https://${process.env.DOMAIN || 'likelyclaw.com'}/api/vapi/webhook/${employeeId}`,
          }
        });
      }

      // ── function-call: VAPI wants us to execute a function during the call ──
      case 'function-call': {
        const functionCall = event.functionCall || event.message?.functionCall;
        if (!functionCall) {
          return res.json({ result: 'No function call data provided' });
        }

        const { name: fnName, parameters: fnParams } = functionCall;
        logger.info('VAPI function-call', { employeeId, function: fnName, params: fnParams });

        // Forward the function call to the container as a chat message
        // The agent will process it and return the result
        try {
          const containerResponse = await sendToContainer(employee.container_name, employee.gateway_token, {
            type: 'chat',
            channel: 'vapi',
            text: `Execute function: ${fnName}(${JSON.stringify(fnParams || {})})`,
            metadata: { source: 'vapi', functionCall: { name: fnName, parameters: fnParams } }
          });

          return res.json({ result: containerResponse.text || containerResponse.message || JSON.stringify(containerResponse) });
        } catch (err) {
          logger.error('VAPI function-call container error', { employeeId, error: err.message });
          return res.json({ result: `Function execution failed: ${err.message}` });
        }
      }

      // ── call-started: Log when a call begins ──
      case 'call-started':
      case 'status-update': {
        const callId = event?.call?.id || 'unknown';
        logger.info('VAPI call started', { employeeId, callId });

        await supabaseAdmin.from('activity_logs').insert({
          user_id: employee.user_id,
          employee_id: employeeId,
          action: 'vapi.call_started',
          details: { call_id: callId, phone: event?.call?.customer?.number }
        });

        return res.json({});
      }

      // ── call-ended / end-of-call-report: Log call summary ──
      case 'call-ended':
      case 'end-of-call-report': {
        const callId = event?.call?.id || 'unknown';
        const duration = event?.call?.duration || event?.durationSeconds;
        const summary = event?.summary || event?.transcript;

        logger.info('VAPI call ended', { employeeId, callId, duration });

        await supabaseAdmin.from('activity_logs').insert({
          user_id: employee.user_id,
          employee_id: employeeId,
          action: 'vapi.call_ended',
          details: {
            call_id: callId,
            duration,
            summary: typeof summary === 'string' ? summary.substring(0, 2000) : undefined,
          }
        });

        return res.json({});
      }

      // ── speech-update: Ignore or log ──
      case 'speech-update':
      case 'transcript': {
        // These fire frequently during a call — just acknowledge
        return res.json({});
      }

      // ── Default: acknowledge unknown events ──
      default: {
        logger.info('VAPI webhook: unhandled event type', { employeeId, eventType });
        return res.json({});
      }
    }
  } catch (err) {
    logger.error('VAPI webhook error', { employeeId, eventType, error: err.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/vapi/server-url/:employeeId ──
// Returns the Server URL that a user should configure in VAPI for their phone number.
// Requires auth so only the owner can see their URL.
const authMiddleware = require('../middleware/auth');
router.get('/server-url/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('id, user_id')
      .eq('id', req.params.employeeId)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const domain = process.env.DOMAIN || 'likelyclaw.com';
    const serverUrl = `https://${domain}/api/vapi/webhook/${employee.id}`;

    res.json({ serverUrl });
  } catch (err) {
    logger.error('Get VAPI server URL error', { error: err.message });
    res.status(500).json({ error: 'Failed to generate server URL' });
  }
});

module.exports = router;
