const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const router = express.Router();
const PLATFORM_DIR = process.env.OPENCLAW_PLATFORM_DIR || '/opt/claw-platform';

// GET /api/preview/:employeeId/*
// Serves static files from the employee's container workspace/projects/ directory
// No auth required — preview links are shareable (files are user-generated public content)
router.get('/:employeeId/*', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const filePath = req.params[0] || 'index.html';

    // Validate employeeId format (UUID)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    // Look up employee to get user_id for directory path
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('id, user_id, name, status')
      .eq('id', employeeId)
      .single();

    if (!employee) {
      return res.status(404).send('Not found');
    }

    // Build the workspace path
    const userDir = path.join(
      PLATFORM_DIR, 'users',
      employee.user_id.slice(0, 8) + '-' + employee.id.slice(0, 8)
    );
    const workspaceDir = path.join(userDir, 'config', 'workspace', 'projects');

    // Resolve the full file path and prevent directory traversal
    const resolvedPath = path.resolve(workspaceDir, filePath);
    if (!resolvedPath.startsWith(path.resolve(workspaceDir))) {
      return res.status(403).send('Forbidden');
    }

    // If path points to a directory, try index.html
    let targetPath = resolvedPath;
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
      targetPath = path.join(targetPath, 'index.html');
    }

    if (!fs.existsSync(targetPath)) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Preview Not Found</title>
        <style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#fff}
        .c{text-align:center}.t{color:#fca311;font-size:48px;margin-bottom:16px}.s{color:#888;font-size:14px}</style></head>
        <body><div class="c"><div class="t">404</div><h2>Preview Not Found</h2><p class="s">This project doesn't exist yet or the file was not found.</p></div></body></html>
      `);
    }

    // Determine content type
    const ext = path.extname(targetPath).toLowerCase();
    const contentType = mime.lookup(ext) || 'application/octet-stream';

    // Set headers for user-generated content previews
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Override Helmet CSP — preview content needs inline scripts/styles and CDN resources
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
    // Don't cache previews — content changes frequently
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Stream the file
    const fileStream = fs.createReadStream(targetPath);
    fileStream.pipe(res);
    fileStream.on('error', (err) => {
      logger.error('Preview file stream error', { error: err.message, path: filePath });
      if (!res.headersSent) {
        res.status(500).send('Error reading file');
      }
    });
  } catch (err) {
    logger.error('Preview error', { error: err.message, employeeId: req.params.employeeId });
    res.status(500).send('Internal server error');
  }
});

// GET /api/preview/:employeeId — list projects
router.get('/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('id, user_id, name')
      .eq('id', employeeId)
      .single();

    if (!employee) {
      return res.status(404).send('Not found');
    }

    const userDir = path.join(
      PLATFORM_DIR, 'users',
      employee.user_id.slice(0, 8) + '-' + employee.id.slice(0, 8)
    );
    const projectsDir = path.join(userDir, 'config', 'workspace', 'projects');

    let projects = [];
    if (fs.existsSync(projectsDir)) {
      projects = fs.readdirSync(projectsDir)
        .filter(f => fs.statSync(path.join(projectsDir, f)).isDirectory());
    }

    const baseUrl = `https://${process.env.DOMAIN || 'likelyclaw.com'}/api/preview/${employeeId}`;

    res.send(`
      <!DOCTYPE html>
      <html><head><title>Projects by ${employee.name}</title>
      <style>
        body{font-family:system-ui;margin:0;background:#0a0a0a;color:#fff;padding:40px}
        h1{color:#fca311;font-size:24px;margin-bottom:8px}
        .sub{color:#888;font-size:14px;margin-bottom:32px}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
        .card{background:#141414;border:1px solid #222;border-radius:12px;padding:20px;transition:border-color .2s}
        .card:hover{border-color:#fca311}
        .card a{color:#fff;text-decoration:none;font-weight:600;font-size:15px}
        .card p{color:#666;font-size:12px;margin-top:8px}
        .empty{color:#666;text-align:center;padding:60px}
      </style></head>
      <body>
        <h1>Projects by ${employee.name}</h1>
        <p class="sub">Preview links for AI-generated projects</p>
        ${projects.length === 0
          ? '<div class="empty">No projects yet. Ask your AI employee to create one!</div>'
          : `<div class="grid">${projects.map(p => `
              <div class="card">
                <a href="${baseUrl}/${p}/">${p}</a>
                <p>Click to preview</p>
              </div>`).join('')}</div>`
        }
      </body></html>
    `);
  } catch (err) {
    logger.error('Preview list error', { error: err.message });
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
