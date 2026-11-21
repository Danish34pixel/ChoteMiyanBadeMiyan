import assert from 'node:assert/strict';
import test from 'node:test';
import { getMongoIntegrationSkipReason } from '../helpers/mongodb.js';

test('MongoDB integration tests require a distinct non-production test database', () => {
  assert.match(
    getMongoIntegrationSkipReason({ NODE_ENV: 'test' }),
    /MONGODB_TEST_URI/,
  );
  assert.match(
    getMongoIntegrationSkipReason({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://db.example.com/shop',
      MONGODB_TEST_URI: 'mongodb://db.example.com/shop-test',
    }),
    /disabled for production/,
  );
  assert.match(
    getMongoIntegrationSkipReason({
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://db.example.com/shop-test',
      MONGODB_TEST_URI: 'mongodb://db.example.com/shop-test',
    }),
    /disabled for production database configuration/,
  );
  assert.equal(
    getMongoIntegrationSkipReason({
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://db.example.com/shop',
      MONGODB_TEST_URI: 'mongodb://db.example.com/shop-test',
    }),
    false,
  );
});
