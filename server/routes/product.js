import { Router } from "express";

const router = Router();

const PRODUCT = {
  id: "sword_001",
  name: "Sword",
  description: "A finely balanced blade. Ships with a complimentary whetstone.",
  price: 10.99,
  currency: "USD",
};

router.get("/", (req, res) => {
  res.json(PRODUCT);
});

export default router;
