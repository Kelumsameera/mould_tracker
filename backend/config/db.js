import mongoose from "mongoose";

export async function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing in .env");
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20
  });
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

// Atlas (replica set) supports transactions. withTransaction retries transient errors.
export async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
