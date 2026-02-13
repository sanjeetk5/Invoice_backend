const mongoose = require("mongoose");

const invoiceLineSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InvoiceLine", invoiceLineSchema);
