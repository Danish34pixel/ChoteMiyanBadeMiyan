export function getMongoIntegrationSkipReason(environment = process.env) {
  const uri = environment.MONGODB_TEST_URI;

  if (!uri) {
    return 'Set MONGODB_TEST_URI to run database integration tests';
  }

  if (environment.NODE_ENV === 'production' || uri === environment.MONGODB_URI) {
    return 'MongoDB integration tests are disabled for production database configuration';
  }

  let databaseName;

  try {
    databaseName = decodeURIComponent(new URL(uri).pathname.slice(1));
  } catch {
    return 'MONGODB_TEST_URI must target a dedicated test database';
  }

  if (!databaseName || !/test/i.test(databaseName)) {
    return 'MONGODB_TEST_URI must target a dedicated test database';
  }

  return false;
}
