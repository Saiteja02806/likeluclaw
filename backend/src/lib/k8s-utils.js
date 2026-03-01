/**
 * k8s-utils.js
 * Replaces dockerode + container-utils.js + docker-compose for Kubernetes.
 * Each premium user gets exactly 1 OpenClaw pod in the claw-agents namespace.
 *
 * Pod DNS (internal): agent-{userId}.claw-agents.svc.cluster.local:18789
 * Image: node:22-alpine (public Docker Hub) + npm install -g openclaw@latest
 */

const k8s = require('@kubernetes/client-node');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const AGENTS_NAMESPACE = 'claw-agents';
const OPENCLAW_IMAGE = 'node:22-alpine';   // public Docker Hub image, no GHCR needed
const MEM_LIMIT_MI = 2048;   // 2 GiB per agent pod
const NODE_HEAP_MB = 1536;   // --max-old-space-size for Node inside container

/* ── K8s client init ── */
const kc = new k8s.KubeConfig();
kc.loadFromDefault(); // uses ~/.kube/config or in-cluster service account
const appsV1 = kc.makeApiClient(k8s.AppsV1Api);
const coreV1  = kc.makeApiClient(k8s.CoreV1Api);

/* ── Helpers ── */
function agentName(userId) {
  // K8s label values must be alphanumeric + dash, max 63 chars
  return `agent-${userId.replace(/_/g, '-').slice(0, 50)}`;
}

function agentServiceDns(userId) {
  return `${agentName(userId)}.${AGENTS_NAMESPACE}.svc.cluster.local`;
}

/* ── Ensure namespace exists ── */
async function ensureNamespace() {
  try {
    await coreV1.readNamespace({ name: AGENTS_NAMESPACE });
  } catch (e) {
    if (e.response?.statusCode === 404) {
      await coreV1.createNamespace({
        body: {
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: { name: AGENTS_NAMESPACE }
        }
      });
    } else throw e;
  }
}

/* ── Create or replace a ConfigMap with openclaw.json + IDENTITY.md + composio-tool.js ── */
async function applyAgentConfigMap(userId, openclawJson, identityMd, composioToolJs) {
  const name = `agent-config-${agentName(userId).replace('agent-', '')}`;
  const body = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name: `agent-config-${userId.replace(/_/g, '-').slice(0, 50)}`, namespace: AGENTS_NAMESPACE },
    data: {
      'openclaw.json': typeof openclawJson === 'string' ? openclawJson : JSON.stringify(openclawJson, null, 2),
      'IDENTITY.md':   identityMd,
      'composio-tool.js': composioToolJs,
    }
  };

  try {
    await coreV1.replaceNamespacedConfigMap({
      name: body.metadata.name,
      namespace: AGENTS_NAMESPACE,
      body
    });
  } catch (e) {
    if (e.response?.statusCode === 404) {
      await coreV1.createNamespacedConfigMap({ namespace: AGENTS_NAMESPACE, body });
    } else throw e;
  }
}

/* ── Create or replace a Secret with the gateway token ── */
async function applyAgentSecret(userId, gatewayToken) {
  const secretName = `agent-secret-${userId.replace(/_/g, '-').slice(0, 50)}`;
  const body = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: secretName, namespace: AGENTS_NAMESPACE },
    type: 'Opaque',
    data: {
      'gateway-token': Buffer.from(gatewayToken).toString('base64'),
    }
  };

  try {
    await coreV1.replaceNamespacedSecret({ name: secretName, namespace: AGENTS_NAMESPACE, body });
  } catch (e) {
    if (e.response?.statusCode === 404) {
      await coreV1.createNamespacedSecret({ namespace: AGENTS_NAMESPACE, body });
    } else throw e;
  }
}

/* ── Build Deployment manifest ── */
function buildDeployment(userId) {
  const name = agentName(userId);
  const safeUserId = userId.replace(/_/g, '-').slice(0, 50);
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name, namespace: AGENTS_NAMESPACE, labels: { app: 'openclaw-agent', 'user-id': safeUserId } },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: 'openclaw-agent', 'user-id': safeUserId } },
      template: {
        metadata: { labels: { app: 'openclaw-agent', 'user-id': safeUserId } },
        spec: {
          initContainers: [{
            name: 'install-openclaw',
            image: OPENCLAW_IMAGE,
            command: ['sh', '-c', 'npm install -g openclaw@latest && cp -r /usr/local/lib/node_modules /opt/node_modules && cp /usr/local/bin/openclaw /opt/openclaw-bin'],
            volumeMounts: [{ name: 'openclaw-install', mountPath: '/opt' }]
          }],
          containers: [{
            name: 'openclaw',
            image: OPENCLAW_IMAGE,
            command: ['sh', '-c', 'cp -r /opt/node_modules /usr/local/lib/node_modules && cp /opt/openclaw-bin /usr/local/bin/openclaw && chmod +x /usr/local/bin/openclaw && openclaw gateway start --foreground --port 18789'],
            ports: [{ containerPort: 18789 }],
            env: [
              {
                name: 'OPENCLAW_GATEWAY_TOKEN',
                valueFrom: { secretKeyRef: { name: `agent-secret-${safeUserId}`, key: 'gateway-token' } }
              },
              { name: 'NODE_OPTIONS', value: `--max-old-space-size=${NODE_HEAP_MB}` }
            ],
            volumeMounts: [
              { name: 'openclaw-install', mountPath: '/opt' },
              { name: 'config', mountPath: '/home/node/.openclaw/openclaw.json', subPath: 'openclaw.json' },
              { name: 'config', mountPath: '/home/node/.openclaw/workspace/IDENTITY.md', subPath: 'IDENTITY.md' },
              { name: 'config', mountPath: '/home/node/.openclaw/workspace/mcp-bridge-tools/composio-tool.js', subPath: 'composio-tool.js' },
            ],
            resources: {
              requests: { memory: '512Mi', cpu: '100m' },
              limits:   { memory: `${MEM_LIMIT_MI}Mi`, cpu: '1000m' }
            },
            livenessProbe: {
              httpGet: { path: '/health', port: 18789 },
              initialDelaySeconds: 60, periodSeconds: 30, failureThreshold: 3
            },
            readinessProbe: {
              httpGet: { path: '/health', port: 18789 },
              initialDelaySeconds: 40, periodSeconds: 10, failureThreshold: 9
            }
          }],
          volumes: [
            { name: 'openclaw-install', emptyDir: {} },
            { name: 'config', configMap: { name: `agent-config-${safeUserId}` } }
          ]
        }
      }
    }
  };
}

/* ── Build Service manifest ── */
function buildService(userId) {
  const name = agentName(userId);
  const safeUserId = userId.replace(/_/g, '-').slice(0, 50);
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name, namespace: AGENTS_NAMESPACE, labels: { 'user-id': safeUserId } },
    spec: {
      selector: { app: 'openclaw-agent', 'user-id': safeUserId },
      ports: [{ protocol: 'TCP', port: 18789, targetPort: 18789 }],
      type: 'ClusterIP'
    }
  };
}

/* ── Apply Deployment (create or update) ── */
async function applyDeployment(userId) {
  const name = agentName(userId);
  const body = buildDeployment(userId);
  try {
    await appsV1.replaceNamespacedDeployment({ name, namespace: AGENTS_NAMESPACE, body });
  } catch (e) {
    if (e.response?.statusCode === 404) {
      await appsV1.createNamespacedDeployment({ namespace: AGENTS_NAMESPACE, body });
    } else throw e;
  }
}

/* ── Apply Service (create or update) ── */
async function applyService(userId) {
  const name = agentName(userId);
  const body = buildService(userId);
  try {
    await coreV1.replaceNamespacedService({ name, namespace: AGENTS_NAMESPACE, body });
  } catch (e) {
    if (e.response?.statusCode === 404) {
      await coreV1.createNamespacedService({ namespace: AGENTS_NAMESPACE, body });
    } else throw e;
  }
}

/* ── Wait for pod to become Ready ── */
async function waitForReady(userId, timeoutMs = 180000) {
  const name = agentName(userId);
  const safeUserId = userId.replace(/_/g, '-').slice(0, 50);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await coreV1.listNamespacedPod({
        namespace: AGENTS_NAMESPACE,
        labelSelector: `app=openclaw-agent,user-id=${safeUserId}`
      });
      const pods = res.items || [];
      if (pods.length > 0) {
        const pod = pods[0];
        const ready = pod.status?.conditions?.find(c => c.type === 'Ready' && c.status === 'True');
        if (ready) return true;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error(`Agent pod for user ${userId} did not become Ready within ${timeoutMs / 1000}s`);
}

/* ── Get pod status ── */
async function getAgentStatus(userId) {
  const safeUserId = userId.replace(/_/g, '-').slice(0, 50);
  try {
    const res = await coreV1.listNamespacedPod({
      namespace: AGENTS_NAMESPACE,
      labelSelector: `app=openclaw-agent,user-id=${safeUserId}`
    });
    const pods = res.items || [];
    if (pods.length === 0) return 'stopped';
    const pod = pods[0];
    const phase = pod.status?.phase;
    const ready = pod.status?.conditions?.find(c => c.type === 'Ready' && c.status === 'True');
    if (ready) return 'running';
    if (phase === 'Pending') return 'provisioning';
    if (phase === 'Running') return 'provisioning'; // running but not ready yet
    if (phase === 'Failed')  return 'error';
    return 'stopped';
  } catch (_) {
    return 'stopped';
  }
}

/* ── Restart pod by deleting it (Deployment auto-recreates) ── */
async function restartAgentPod(userId) {
  const safeUserId = userId.replace(/_/g, '-').slice(0, 50);
  const res = await coreV1.listNamespacedPod({
    namespace: AGENTS_NAMESPACE,
    labelSelector: `app=openclaw-agent,user-id=${safeUserId}`
  });
  const pods = res.items || [];
  for (const pod of pods) {
    await coreV1.deleteNamespacedPod({
      name: pod.metadata.name,
      namespace: AGENTS_NAMESPACE
    });
  }
}

/* ── Delete all resources for a user ── */
async function deleteAgent(userId) {
  const name = agentName(userId);
  const safeUserId = userId.replace(/_/g, '-').slice(0, 50);
  const errs = [];

  const del = async (fn) => { try { await fn(); } catch (e) { if (e.response?.statusCode !== 404) errs.push(e.message); } };

  await del(() => appsV1.deleteNamespacedDeployment({ name, namespace: AGENTS_NAMESPACE }));
  await del(() => coreV1.deleteNamespacedService({ name, namespace: AGENTS_NAMESPACE }));
  await del(() => coreV1.deleteNamespacedConfigMap({ name: `agent-config-${safeUserId}`, namespace: AGENTS_NAMESPACE }));
  await del(() => coreV1.deleteNamespacedSecret({ name: `agent-secret-${safeUserId}`, namespace: AGENTS_NAMESPACE }));

  if (errs.length > 0) throw new Error(`Partial delete errors: ${errs.join('; ')}`);
}

/* ── Full provision: ConfigMap + Secret + Deployment + Service ── */
async function provisionAgent({ userId, openclawJson, identityMd, composioToolJs, gatewayToken }) {
  await ensureNamespace();
  await applyAgentConfigMap(userId, openclawJson, identityMd, composioToolJs);
  await applyAgentSecret(userId, gatewayToken);
  await applyDeployment(userId);
  await applyService(userId);
  await waitForReady(userId);
  return {
    serviceDns: agentServiceDns(userId),
    port: 18789,
  };
}

/* ── Update config only and restart pod ── */
async function updateAgentConfig({ userId, openclawJson, identityMd, composioToolJs }) {
  await applyAgentConfigMap(userId, openclawJson, identityMd, composioToolJs);
  await restartAgentPod(userId);
}

/* ── Patch a subset of openclaw.json in the ConfigMap and restart ── */
async function patchAgentConfig(userId, patchFn) {
  const safeUserId = userId.replace(/_/g, '-').slice(0, 50);
  const cmName = `agent-config-${safeUserId}`;

  const cm = await coreV1.readNamespacedConfigMap({ name: cmName, namespace: AGENTS_NAMESPACE });
  const current = cm.data || {};

  let openclawJson = {};
  try { openclawJson = JSON.parse(current['openclaw.json'] || '{}'); } catch (_) {}

  const patched = patchFn(openclawJson);

  const body = {
    ...cm,
    data: {
      ...current,
      'openclaw.json': JSON.stringify(patched, null, 2),
    }
  };

  await coreV1.replaceNamespacedConfigMap({ name: cmName, namespace: AGENTS_NAMESPACE, body });
  await restartAgentPod(userId);
}

module.exports = {
  provisionAgent,
  deleteAgent,
  getAgentStatus,
  restartAgentPod,
  updateAgentConfig,
  patchAgentConfig,
  agentServiceDns,
  ensureNamespace,
};
