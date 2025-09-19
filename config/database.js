import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Handle connection caching for serverless
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // If already connected, return the existing connection
  if (cached.conn) {
    return cached.conn;
  }

  // If no connection promise, create one
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    // Use MongoDB Atlas URI if available, otherwise use local MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/postwoman';

    cached.promise = mongoose.connect(mongoURI, opts).then((mongoose) => {
      console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
      return mongoose;
    }).catch((error) => {
      console.error('❌ MongoDB connection failed:', error.message);
      
      // In serverless environment, don't exit process
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        throw error;
      } else {
        process.exit(1);
      }
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
};

export default connectDB;