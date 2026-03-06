// ================================================================
// DATA SYNC API ROUTES
// ================================================================
// API endpoints for facility data synchronization

import express from 'express';
import DataSyncService from '../services/dataSync.js';
import FacilityService from '../services/facilityManagement.js';
import AccessControlService from '../services/accessControl.js';

const router = express.Router();

/**
 * POST /api/sync/data
 * Facility pushes data to central database
 * Requires: X-Facility-ID and X-Facility-API-Key headers
 */
router.post('/data', async (req, res) => {
  try {
    const facilityId = req.headers['x-facility-id'];
    const apiKey = req.headers['x-facility-api-key'];

    if (!facilityId || !apiKey) {
      return res.status(400).json({
        error: 'Missing X-Facility-ID or X-Facility-API-Key headers'
      });
    }

    // Verify API key
    const isValid = await FacilityService.verifyFacilityAPIKey(facilityId, apiKey);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid facility ID or API key' });
    }

    // Process sync
    const result = await DataSyncService.syncPatientData(
      facilityId,
      apiKey,
      req.body
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error syncing data:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/sync/history/:facilityId
 * Get sync history for facility
 */
router.get('/history/:facilityId', async (req, res) => {
  try {
    const userId = req.user.id;

    // Check facility access
    const hasAccess = await AccessControlService.canAccessFacility(userId, req.params.facilityId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this facility' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const syncHistory = await DataSyncService.getSyncHistory(req.params.facilityId, limit);

    res.json({
      success: true,
      count: syncHistory.length,
      data: syncHistory
    });
  } catch (error) {
    console.error('Error fetching sync history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sync/status/:facilityId
 * Get latest sync status for facility
 */
router.get('/status/:facilityId', async (req, res) => {
  try {
    const userId = req.user.id;

    // Check facility access
    const hasAccess = await AccessControlService.canAccessFacility(userId, req.params.facilityId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this facility' });
    }

    const status = await DataSyncService.getLatestSyncStatus(req.params.facilityId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sync/stats/:facilityId
 * Get sync statistics for facility
 */
router.get('/stats/:facilityId', async (req, res) => {
  try {
    const userId = req.user.id;

    // Check facility access
    const hasAccess = await AccessControlService.canAccessFacility(userId, req.params.facilityId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this facility' });
    }

    const days = parseInt(req.query.days) || 30;
    const stats = await DataSyncService.getSyncStatistics(req.params.facilityId, days);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching sync statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
