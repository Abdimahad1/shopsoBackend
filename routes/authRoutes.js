import express from "express";
import { registerUser, loginUser } from "../controllers/authController.js";

const router = express.Router();

router.post("/register", registerUser); // Admin-only usage
router.post("/login", loginUser);       // Used by your frontend login page

export default router;
