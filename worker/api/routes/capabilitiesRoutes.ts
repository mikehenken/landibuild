/**
 * Capabilities API Routes
 *
 * Exposes platform capabilities for feature discovery.
 */

import { Hono } from 'hono';
import { CapabilitiesController } from '../controllers/capabilities/controller';
import { adaptController } from '../honoAdapter';
import { AppEnv } from '../../types/appenv';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';

export function setupCapabilitiesRoutes(app: Hono<AppEnv>): void {
	const capabilitiesRouter = new Hono<AppEnv>();

	// GET /api/capabilities - Get platform capabilities (public)
	capabilitiesRouter.get(
		'/',
		setAuthLevel(AuthConfig.public),
		adaptController(CapabilitiesController, CapabilitiesController.getCapabilities),
	);

	// GET /api/capabilities/agent-wire — tool profile manifest for agents / orchestrators (public)
	capabilitiesRouter.get(
		'/agent-wire',
		setAuthLevel(AuthConfig.public),
		adaptController(CapabilitiesController, CapabilitiesController.getAgentWireManifest),
	);

	app.route('/api/capabilities', capabilitiesRouter);
}
