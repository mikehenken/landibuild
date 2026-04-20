import { ModelRoutingController } from '../controllers/modelRouting/controller';
import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { adaptController } from '../honoAdapter';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';

export function setupModelRoutingRoutes(app: Hono<AppEnv>): void {
    const router = new Hono<AppEnv>();

    // These endpoints might be internal or authenticated depending on usage. Assuming admin/authenticated for now.
    router.post('/compile-bundle', setAuthLevel(AuthConfig.authenticated), adaptController(ModelRoutingController, ModelRoutingController.compileBundle));
    router.get('/revision', setAuthLevel(AuthConfig.authenticated), adaptController(ModelRoutingController, ModelRoutingController.getRevision));

    app.route('/api/model-routing', router);
}
