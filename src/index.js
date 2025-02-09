import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { connectDB } from "./lib/db.js";
import setupSocket from "./lib/socket.js";
import UserRoute from "./routes/user.route.js";
import EventRoute from "./routes/event.route.js";

dotenv.config(); // Ensure environment variables are loaded first

const app = express();
const httpServer = createServer(app);
export const io = setupSocket(httpServer);

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// CORS Configuration
const corsOptions = {
    origin: [
        "http://localhost:5173",
        "https://events-6rjfmxjoo-shreyouslys-projects.vercel.app",
        "https://events.vercel.app" // Add your production URL
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
    exposedHeaders: ["set-cookie"],
    preflightContinue: false,
    optionsSuccessStatus: 204, // Or 200
};

app.use(cors(corsOptions));
app.options('*', cors());

// API Routes
app.use("/api/user", UserRoute);
app.use("/api/events", EventRoute);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!" });
});

// Connect to DB and Start Server
connectDB()
    .then(() => {
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Database connection failed:", error);
        process.exit(1); // Exit process if DB connection fails
    });

export { app };
