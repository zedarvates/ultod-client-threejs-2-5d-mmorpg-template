import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(
  readFileSync(new URL('../net/compatibility-manifest.json', import.meta.url), 'utf8'),
) as {
  schema: string;
  proof: {
    level: string;
    zig_compatibility: boolean;
    canonical_server_repository: string | null;
    canonical_server_sha: string | null;
    zig_toolchain: string | null;
    protocol_revision: string | null;
  };
  authority: Record<string, boolean>;
  licensing_boundary: {
    public_template_license: string;
    contains_private_server_implementation: boolean;
    private_server_policy: string;
  };
};

test('compatibility manifest cannot claim Zig compatibility without a pinned server baseline', () => {
  expect(manifest.schema).toBe('uo.network-compatibility/v1');

  if (manifest.proof.zig_compatibility) {
    expect(['REAL_SERVER_E2E', 'ADVERSARIAL_E2E', 'RELEASE_PROVEN']).toContain(manifest.proof.level);
    expect(manifest.proof.canonical_server_repository).toBeTruthy();
    expect(manifest.proof.canonical_server_sha).toMatch(/^[0-9a-f]{40}$/);
    expect(manifest.proof.zig_toolchain).toBeTruthy();
    expect(manifest.proof.protocol_revision).toBeTruthy();
  } else {
    expect(manifest.proof.level).toBe('SYNTHETIC_FIXTURE_ONLY');
    expect(manifest.proof.canonical_server_repository).toBeNull();
    expect(manifest.proof.canonical_server_sha).toBeNull();
  }
});

test('public client manifest preserves server-authoritative invariants', () => {
  for (const allowed of Object.values(manifest.authority)) {
    expect(allowed).toBe(false);
  }
});

test('public manifest preserves the proprietary private-server boundary', () => {
  expect(manifest.licensing_boundary.public_template_license).toBe('MIT');
  expect(manifest.licensing_boundary.contains_private_server_implementation).toBe(false);
  expect(manifest.licensing_boundary.private_server_policy).toContain('proprietary-commercial');
});
