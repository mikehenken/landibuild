import { DemandTransformersController } from '../controllers/demandTransformers/controller';
import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { adaptController } from '../honoAdapter';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';

export function setupDemandTransformersRoutes(app: Hono<AppEnv>): void {
    const router = new Hono<AppEnv>();

    // Admin level for updating demand transformers
    router.post('/', setAuthLevel(AuthConfig.authenticated), adaptController(DemandTransformersController, DemandTransformersController.upsertTransformer));

    app.route('/api/demand-transformers', router);
}
