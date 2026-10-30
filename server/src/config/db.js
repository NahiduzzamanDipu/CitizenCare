import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected — the driver will keep retrying.');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS:
        Number(process.env.MONGO_TIMEOUT_MS) || 10000,
    });
  } catch (err) {
    throw new Error(
      `Could not reach MongoDB at ${uri.replace(/\/\/[^@]*@/, '//***@')}\n` +
        `Is mongod running? Original error: ${err.message}`
    );
  }

  console.log('MongoDB connected');
  return mongoose.connection;
}
