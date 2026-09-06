process.env.DATA_ROOT = '.saas-dev-data';
import { getControlDriver } from '../ui/server/saas/db/control.js';
const db = await getControlDriver();
const g = await db.queryOne(
  "SELECT COUNT(*) as c FROM conversation_catalog WHERE tenant_id='default' AND user_id=1 AND legacy_project_id NOT LIKE 'workspaces-%'",
);
const w = await db.queryOne(
  "SELECT COUNT(*) as c FROM conversation_catalog WHERE tenant_id='default' AND user_id=1 AND legacy_project_id LIKE 'workspaces-%'",
);
console.log(JSON.stringify({ generalCatalog: g.c, workspaceCatalog: w.c }));
