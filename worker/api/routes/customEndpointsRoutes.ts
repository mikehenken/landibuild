import { CustomEndpointsController } from '../controllers/customEndpoints/controller';
import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { adaptController } from '../honoAdapter';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';

export function setupCustomEndpointsRoutes(app: Hono<AppEnv>): void {
    const router = new Hono<AppEnv>();

    // Admin level for updating global custom endpoints
    router.post('/', setAuthLevel(AuthConfig.authenticated), adaptController(CustomEndpointsController, CustomEndpointsController.upsertEndpoint));

    app.route('/api/custom-endpoints', router);
}
