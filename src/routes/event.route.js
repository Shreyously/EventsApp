import express from "express";
import { CreateEvent, deleteEvent, getAllEvents, getEventById,joinEvent,leaveEvent, updateEvent } from "../controllers/event.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";


const router = express.Router();

router.post("/createevent", protectRoute, CreateEvent);
router.get("/getevents", getAllEvents);
router.get("/:id", getEventById);
router.put("/:id/update", protectRoute, updateEvent); // New update route
router.delete("/:id/delete", protectRoute, deleteEvent);
router.post("/:id/join", protectRoute, joinEvent );
router.post("/:id/leave", protectRoute, leaveEvent);

export default router;