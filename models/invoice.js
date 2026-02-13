const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    invoiceNumber: { type: String, required: true },
    customerName: { type: String, required: true },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },

    currency: {
      type: String,
      enum: ["USD", "INR", "EUR"],
      default: "USD",
    },

    taxPercent: {
      type: Number,
      default: 0,
    },

    subtotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["DRAFT", "PAID"],
      default: "DRAFT",
    },

    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },

    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
