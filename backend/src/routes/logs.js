const express = require('express');
const authMiddleware = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// GET /api/logs/:employeeId — Get activity logs for an employee
router.get('/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // Verify employee belongs to user
    const { data: employee } = await req.supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.employeeId)
      .eq('user_id', req.user.id)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { data, error, count } = await req.supabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .eq('employee_id', req.params.employeeId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ logs: data, total: count });
  } catch (err) {
    logger.error('Get logs error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/logs — Get all activity logs for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const { data, error, count } = await req.supabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ logs: data, total: count });
  } catch (err) {
    logger.error('Get all logs error', { error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
