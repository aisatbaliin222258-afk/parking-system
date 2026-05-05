const mongoose = require('mongoose');

// Improved connect with retries and clear logging. Returns true when connected, false otherwise.
const connectDB = async ({ retries = 5, initialDelayMs = 1000 } = {}) => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/myDatabase';

  // Avoid buffering commands indefinitely while disconnected (helps surfaces errors quickly)
  mongoose.set('bufferCommands', false);

  const opts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // Tunable timeouts
    serverSelectionTimeoutMS: 10000, // how long to try to find a server
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempting MongoDB connection (${attempt}/${retries}) to ${mongoUri}`);
      await mongoose.connect(mongoUri, opts);
      console.log('MongoDB connected');
      return true;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt} failed:`, err.message || err);
      if (attempt < retries) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms...`);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }
      console.error('All MongoDB connection attempts failed. The server will continue to run but database functionality may be limited.');
      return false;
    }
  }
};

module.exports = connectDB;