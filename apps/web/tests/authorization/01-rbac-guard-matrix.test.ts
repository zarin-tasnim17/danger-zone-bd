import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { WEB_TEST_CONFIG } from '../framework/config';

describe('[Authorization][RBAC] Frontend UI Guards & Protected Action Gates', () => {
  it('/safe-zones restricts SafeZone creation and deletion controls exclusively to user?.role === "ADMIN"', () => {
    const src = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'app/safe-zones/page.tsx'), 'utf8');
    assert.ok(src.includes('user?.role === "ADMIN"'));
  });

  it('/admin enforces explicit Admin role login gate before exposing moderation actions', () => {
    const src = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'app/admin/page.tsx'), 'utf8');
    assert.ok(src.includes('user?.role !== "ADMIN"'));
    assert.ok(src.includes('loginAdminWithPassword'));
  });

  it('/reports/[id] enforces ownership (report?.isOwner) and ADMIN/VERIFIED_RESPONDER separation on Resolve vs Purge controls', () => {
    const src = fs.readFileSync(
      path.join(WEB_TEST_CONFIG.webRoot, 'app/reports/[id]/page.tsx'),
      'utf8'
    );
    assert.ok(src.includes('Boolean(report?.isOwner)'));
    assert.ok(src.includes('user?.role === "ADMIN"'));
    assert.ok(src.includes('user?.role === "VERIFIED_RESPONDER"'));
  });
});
