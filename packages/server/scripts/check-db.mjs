// Fly runs this in a throwaway machine before a release touches the live one
// (`release_command` in fly.toml). If the database is unreachable the deploy stops
// and the current release keeps serving, instead of shipping into an outage.
import mongoose from 'mongoose';

const uri = process.env.MONGO_URI;
if (process.env.SKIP_DB_CHECK === '1') {
  console.warn('SKIP_DB_CHECK=1: deploying without checking the database');
  process.exit(0);
}
if (!uri) {
  console.error('MONGO_URI is not set. Set it with: fly secrets set MONGO_URI=...');
  process.exit(1);
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  await mongoose.connection.db.admin().ping();
  console.log('Database reachable');
  await mongoose.disconnect();
  process.exit(0);
} catch (error) {
  console.error(`Database unreachable, stopping this deploy: ${error.message}`);
  process.exit(1);
}
