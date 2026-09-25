require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Route the app's own DB pool at the isolated test database instead of the
// dev/demo one, so running `npm test` never touches seeded demo data.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
}
