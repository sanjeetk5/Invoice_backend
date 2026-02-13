const Invoice = require("../models/invoice");
const InvoiceLine = require("../models/invoiceline");
const Payment = require("../models/payment");

// ---------------------------
// POST Create Invoice
// ---------------------------
const createInvoice = async (req, res) => {
  try {
    const {
      invoiceNumber,
      customerName,
      issueDate,
      dueDate,
      lineItems,
      currency,
      taxPercent,
    } = req.body;

    if (!invoiceNumber || !customerName || !issueDate || !dueDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!lineItems || lineItems.length === 0) {
      return res.status(400).json({ message: "Line items are required" });
    }

    const invoice = await Invoice.create({
      userId: req.user._id,
      invoiceNumber,
      customerName,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      currency: currency || "USD",
      taxPercent: taxPercent || 0,
      status: "DRAFT",
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      amountPaid: 0,
      balanceDue: 0,
      isArchived: false,
    });

    const createdLineItems = await InvoiceLine.insertMany(
      lineItems.map((item) => ({
        invoiceId: invoice._id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
      }))
    );

    // subtotal = sum of line totals
    const subtotal = createdLineItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0
    );

    const taxPercentage = Number(taxPercent) || 0;
    const taxAmount = (subtotal * taxPercentage) / 100;

    const total = subtotal + taxAmount;

    invoice.subtotal = subtotal;
    invoice.taxAmount = taxAmount;
    invoice.total = total;
    invoice.amountPaid = 0;
    invoice.balanceDue = total;

    await invoice.save();

    return res.status(201).json({
      message: "Invoice created successfully",
      invoice,
      lineItems: createdLineItems,
    });
  } catch (error) {
    console.log("Error creating invoice:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// GET All Invoices (Only logged in user invoices)
// ---------------------------
const getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    res.json(invoices);
  } catch (error) {
    console.log("Error fetching invoices:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// GET Invoice Details (Only owner can view)
// ---------------------------
const getInvoiceDetails = async (req, res) => {
  try {
    const invoiceId = req.params.id;

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    const lineItems = await InvoiceLine.find({ invoiceId });
    const payments = await Payment.find({ invoiceId });

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const taxPercent = invoice.taxPercent || 0;
    const taxAmount = (subtotal * taxPercent) / 100;
    const total = subtotal + taxAmount;

    const amountPaid = payments.reduce((sum, pay) => sum + pay.amount, 0);
    const balanceDue = total - amountPaid;

    // update invoice totals (auto sync)
    invoice.subtotal = subtotal;
    invoice.taxAmount = taxAmount;
    invoice.total = total;
    invoice.amountPaid = amountPaid;
    invoice.balanceDue = balanceDue;

    if (balanceDue === 0) {
      invoice.status = "PAID";
    }

    await invoice.save();

    return res.json({
      invoice,
      lineItems,
      payments,
      subtotal,
      taxPercent,
      taxAmount,
      total,
      amountPaid,
      balanceDue,
    });
  } catch (error) {
    console.log("Error fetching invoice:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// POST Add Payment (Only owner)
// ---------------------------
const addPayment = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (invoice.isArchived) {
      return res
        .status(400)
        .json({ message: "Archived invoice cannot accept payments" });
    }

    const lineItems = await InvoiceLine.find({ invoiceId });
    const payments = await Payment.find({ invoiceId });

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const taxPercent = invoice.taxPercent || 0;
    const taxAmount = (subtotal * taxPercent) / 100;
    const total = subtotal + taxAmount;

    const amountPaid = payments.reduce((sum, pay) => sum + pay.amount, 0);
    const balanceDue = total - amountPaid;

    if (amount > balanceDue) {
      return res.status(400).json({ message: "Overpayment not allowed" });
    }

    const payment = await Payment.create({
      invoiceId,
      amount,
      paymentDate: new Date(),
    });

    const updatedAmountPaid = amountPaid + amount;
    const updatedBalanceDue = total - updatedAmountPaid;

    invoice.subtotal = subtotal;
    invoice.taxAmount = taxAmount;
    invoice.total = total;
    invoice.amountPaid = updatedAmountPaid;
    invoice.balanceDue = updatedBalanceDue;

    if (updatedBalanceDue === 0) {
      invoice.status = "PAID";
    }

    await invoice.save();

    return res.json({
      message: "Payment added successfully",
      payment,
      invoice,
    });
  } catch (error) {
    console.log("Error adding payment:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// POST Archive Invoice (Only owner)
// ---------------------------
const archiveInvoice = async (req, res) => {
  try {
    const { id } = req.body;

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    invoice.isArchived = true;
    await invoice.save();

    res.json({ message: "Invoice archived successfully", invoice });
  } catch (error) {
    console.log("Error archiving invoice:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------------------
// POST Restore Invoice (Only owner)
// ---------------------------
const restoreInvoice = async (req, res) => {
  try {
    const { id } = req.body;

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    invoice.isArchived = false;
    await invoice.save();

    res.json({ message: "Invoice restored successfully", invoice });
  } catch (error) {
    console.log("Error restoring invoice:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Delete related invoice lines
    await InvoiceLine.deleteMany({ invoiceId: invoice._id });

    // Delete related payments
    await Payment.deleteMany({ invoiceId: invoice._id });

    // Delete invoice
    await Invoice.deleteOne({ _id: invoice._id });

    res.json({ message: "Invoice deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoiceDetails,
  addPayment,
  archiveInvoice,
  restoreInvoice,
  deleteInvoice
};
