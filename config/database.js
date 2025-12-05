import mongoose from "mongoose";

/**
 * Connect to MongoDB database
 * @returns {Promise<void>}
 */
export const connectDB = async () => {
  try {
    // Provide fallback values for MongoDB connection
    const mongoUri = process.env.MONGODB_URI || 
                    `${process.env.MONGO_DB_URI || 'mongodb://localhost:27017'}/${process.env.DB_NAME || 'farmferry'}`;
    
    const conn = await mongoose.connect(mongoUri, {
      // Connection options are automatically handled in newer mongoose versions
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};
