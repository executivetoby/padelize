import { connect } from 'mongoose';
import colors from 'colors';

let DB = '';

DB = process.env.DATABASE.replace('<password>', process.env.DATABASE_PASSWORD);
const connectDB = async () => {
  try {
    const conn = await connect(DB, {});

    createLogger.info(
      `Database connected on: ${conn.connection.host}`.bold.yellow
    );
  } catch (err) {
    createLogger.error(`Error: ${err.message} ❌❌❌`.bold.red);
    process.exit(1);
  }
};
export default connectDB;
