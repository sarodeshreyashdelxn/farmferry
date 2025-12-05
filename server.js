import dotenv from "dotenv";

// Load environment variables before anything else
dotenv.config();

import { connectDB } from "./config/database.js";
import { app } from "./app.js";

// Define port
const PORT = process.env.PORT || 9000;

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start the server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // app.listen(8000, '0.0.0.0', () => {
    //   console.log("Server running on http://0.0.0.0:8000");
    // });
    
    // Handle unhandled promise rejections
    process.on("unhandledRejection", (err) => {
      console.error("UNHANDLED REJECTION! Shutting down...");
      console.error(err.name, err.message);
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
