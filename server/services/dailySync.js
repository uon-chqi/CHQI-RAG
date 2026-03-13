import cron from 'node-cron';
import { pool } from '../config/database.js';
import crypto from 'crypto';

/**
 * Daily sync job — runs every day at 9 PM East Africa Time (EAT = UTC+3 → 18:00 UTC).
 * For each facility it:
 *   1. Counts active patient records
 *   2. Generates a data hash to detect changes since last sync
 *   3. Handles patient deduplication (CCC number conflicts resolved via upsert)
 *   4. Logs the result to data_sync_log
 */

async function runDailySync() {
  console.log('[DailySync] Starting daily facility data sync at', new Date().toISOString());
  const client = await pool.connect();

  try {
    // Get all registered facilities
    const { rows: facilities } = await client.query(
      `SELECT id, name, code FROM facilities WHERE operational_status != 'closed' OR operational_status IS NULL`
    );

    console.log(`[DailySync] Found ${facilities.length} facilities to sync`);

    for (const facility of facilities) {
      try {
        // Count patients for this facility
        const { rows: countRows } = await client.query(
          `SELECT COUNT(*) AS total FROM patients WHERE facility_id = $1`,
          [facility.id]
        );
        const totalPatients = parseInt(countRows[0].total);

        // Generate a hash of patient data to detect changes
        const { rows: hashRows } = await client.query(
          `SELECT md5(string_agg(
            COALESCE(id::text, '') || COALESCE(first_name, '') || COALESCE(last_name, '') ||
            COALESCE(phone, '') || COALESCE(ccc_number, '') || COALESCE(risk_level, '') ||
            COALESCE(updated_at::text, created_at::text, ''),
            '|' ORDER BY id
          )) AS data_hash FROM patients WHERE facility_id = $1`,
          [facility.id]
        );
        const dataHash = hashRows[0].data_hash || 'empty';

        // Check last sync for this facility to see if anything changed
        const { rows: lastSync } = await client.query(
          `SELECT data_hash, records_synced FROM data_sync_log
           WHERE facility_id = $1 ORDER BY synced_at DESC LIMIT 1`,
          [facility.id]
        );

        const changed = !lastSync.length || lastSync[0].data_hash !== dataHash;

        // Deduplicate patients: if multiple records share same ccc_number within a facility,
        // keep the most recently updated one
        let deduped = 0;
        if (totalPatients > 0) {
          const { rowCount } = await client.query(
            `DELETE FROM patients p1
             USING patients p2
             WHERE p1.facility_id = $1
               AND p2.facility_id = $1
               AND p1.ccc_number IS NOT NULL
               AND p1.ccc_number = p2.ccc_number
               AND p1.id != p2.id
               AND COALESCE(p1.updated_at, p1.created_at) < COALESCE(p2.updated_at, p2.created_at)`,
            [facility.id]
          );
          deduped = rowCount || 0;
        }

        // Log the sync
        await client.query(
          `INSERT INTO data_sync_log (facility_id, sync_type, status, records_synced, records_failed, data_hash, details)
           VALUES ($1, 'daily_auto', $2, $3, $4, $5, $6)`,
          [
            facility.id,
            'completed',
            totalPatients,
            deduped,
            dataHash,
            JSON.stringify({
              facility_name: facility.name,
              changed,
              duplicates_removed: deduped,
              timestamp: new Date().toISOString()
            })
          ]
        );

        console.log(`[DailySync] ✅ ${facility.name}: ${totalPatients} patients, ${deduped} duplicates removed, changed=${changed}`);
      } catch (err) {
        console.error(`[DailySync] ❌ Error syncing facility ${facility.name}:`, err.message);
        // Log the failure
        await client.query(
          `INSERT INTO data_sync_log (facility_id, sync_type, status, records_synced, records_failed, details)
           VALUES ($1, 'daily_auto', 'failed', 0, 0, $2)`,
          [facility.id, JSON.stringify({ error: err.message, timestamp: new Date().toISOString() })]
        ).catch(() => {});
      }
    }

    console.log('[DailySync] ✅ Daily sync completed at', new Date().toISOString());
  } catch (err) {
    console.error('[DailySync] ❌ Fatal error during daily sync:', err.message);
  } finally {
    client.release();
  }
}

/**
 * Initialize the cron job.
 * Schedule: "0 18 * * *" = 18:00 UTC = 9:00 PM EAT (UTC+3)
 */
export function initDailySync() {
  // Run daily at 9 PM EAT (6 PM UTC)
  cron.schedule('0 18 * * *', () => {
    runDailySync().catch(err => console.error('[DailySync] Unhandled error:', err));
  });
  console.log('📅 Daily sync cron job scheduled for 9:00 PM EAT (18:00 UTC)');
}

// Export for manual trigger (e.g. from admin route)
export { runDailySync };
