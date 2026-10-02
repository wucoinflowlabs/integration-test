import { Router } from "express";
import productRoutes from "./product.js";
import checkoutRoutes from "./checkout.js";
import coinflowRoutes from "./coinflow.js";
import webhookRoutes from "./webhooks.js";

const router = Router();

router.use("/product", productRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/coinflow/webhook", webhookRoutes);
router.use("/coinflow", coinflowRoutes);

export default router;
