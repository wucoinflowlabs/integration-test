import { Router } from "express";
import productRoutes from "./product.js";
import checkoutRoutes from "./checkout.js";

const router = Router();

router.use("/product", productRoutes);
router.use("/checkout", checkoutRoutes);

// Phase 2: router.use("/coinflow", coinflowRoutes) for the session-key and
// jwt-token endpoints the <CoinflowPurchase> component calls.

export default router;
