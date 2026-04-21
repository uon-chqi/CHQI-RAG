/**
 * @openapi
 * tags:
 *   - name: Health
 *     description: System and service health endpoints
 *   - name: Auth
 *     description: Authentication and current user endpoints
 *   - name: Patients
 *     description: Patient discovery and lookup endpoints
 */

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Application health check
 *     description: Lightweight API process check.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is reachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */

/**
 * @openapi
 * /api/system/health:
 *   get:
 *     summary: Deep system health check
 *     description: Returns upstream service health and overall state.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Health check completed
 *       500:
 *         description: Health check failed
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login and get JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               username:
 *                 type: string
 *                 example: superadmin
 *               password:
 *                 type: string
 *                 example: CHQIAdmin@2026
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Missing credentials
 *       401:
 *         description: Invalid credentials
 */

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Unauthorized
 */

/**
 * @openapi
 * /api/patients/search/ccc/{cccNumber}:
 *   get:
 *     summary: Find patient by CCC number
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cccNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: CCC number to search
 *     responses:
 *       200:
 *         description: Patient found
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Patient not found
 */

export default {};
