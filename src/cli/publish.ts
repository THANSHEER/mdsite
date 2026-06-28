// CLI wrapper around core/deploy.ts's publishSite.

import { publishSite, type PublishOptions } from '../core/deploy.js';

export async function publish(opts: PublishOptions = {}): Promise<void> {
  const started = Date.now();
  const result = await publishSite(opts);
  console.log(`✓ Published to ${result.target} (${Date.now() - started}ms)`);
}
