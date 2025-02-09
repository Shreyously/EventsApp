import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No Token Provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is guest for restricted routes
    if (user.isGuest) {
      const restrictedPaths = [
        '/createevent',
        '/dashboard',
        '/join',
        '/leave',
        '/update',
        '/delete'
      ];

      const isRestrictedPath = restrictedPaths.some(path => 
        req.path.includes(path)
      );

      if (isRestrictedPath) {
        return res.status(403).json({ 
          message: "This action requires a full account" 
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.log("Error in protectRoute middleware: ", error.message);
    res.status(401).json({ message: "Unauthorized - Invalid Token" });
  }
};