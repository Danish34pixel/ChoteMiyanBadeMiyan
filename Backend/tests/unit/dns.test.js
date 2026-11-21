import assert from 'node:assert/strict';
import dns from 'node:dns';
import test from 'node:test';
import { configureDns, mongoDnsServers } from '../../src/config/dns.js';

test('configureDns installs the configured DNS resolvers', () => {
  const originalServers = dns.getServers();

  try {
    configureDns();
    assert.deepEqual(dns.getServers(), mongoDnsServers);
  } finally {
    dns.setServers(originalServers);
  }
});
