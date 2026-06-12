// sha256 hex of pasted text — freshness signal for cached imports.
// node:crypto is fine here: only imported by route handlers / node scripts.

import { createHash } from 'node:crypto';

export function sha256Hex(text = '') {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
