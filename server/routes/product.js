import { Router } from "express";
import { productForClient } from "../catalog.js";

const router = Router();

router.get("/", (req, res) => {
  res.json(productForClient());
});

export default router;
