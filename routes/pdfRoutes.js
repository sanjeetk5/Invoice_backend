const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const { generateInvoicePDF } = require("../controllers/pdfController");

router.get("/invoices/:id/pdf", protect, generateInvoicePDF);

module.exports = router;
