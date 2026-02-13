const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  createInvoice,
  getAllInvoices,
  getInvoiceDetails,
  addPayment,
  archiveInvoice,
  restoreInvoice,
  deleteInvoice
} = require("../controllers/invoiceController");

// Protected Routes
router.post("/", protect, createInvoice);
router.get("/", protect, getAllInvoices);
router.get("/:id", protect, getInvoiceDetails);
router.post("/:id/payments", protect, addPayment);
router.post("/archive", protect, archiveInvoice);
router.post("/restore", protect, restoreInvoice);
router.delete("/:id", protect, deleteInvoice);

module.exports = router;
