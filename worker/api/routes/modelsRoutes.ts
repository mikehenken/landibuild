import { ModelsController } from '../controllers/models/controller';
import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { adaptController } from '../honoAdapter';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';

export function setupModelsRoutes(app: Hono<AppEnv>): void {
    const router = new Hono<AppEnv>();

    // Admin level for updating global model catalog
    router.post('/', setAuthLevel(AuthConfig.authenticated), adaptController(ModelsController, ModelsController.upsertModel));

    app.route('/api/models', router);
}
