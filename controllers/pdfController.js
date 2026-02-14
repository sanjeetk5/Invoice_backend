const PDFDocument = require("pdfkit");
const Invoice = require("../models/invoice");
const InvoiceLine = require("../models/invoiceline");
const Payment = require("../models/payment");

const generateInvoicePDF = async (req, res) => {
  try {
    const invoiceId = req.params.id;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

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

    const currencySymbol =
      invoice.currency === "INR"
        ? "₹"
        : invoice.currency === "EUR"
        ? "€"
        : "$";

    // Headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`
    );

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    // Helper function
    const drawLine = (y) => {
      doc
        .strokeColor("#E5E7EB")
        .lineWidth(1)
        .moveTo(50, y)
        .lineTo(545, y)
        .stroke();
    };

    // ---------------- HEADER ----------------
    doc
      .fontSize(28)
      .fillColor("#111827")
      .text("INVOICE", 50, 45);

    doc
      .fontSize(12)
      .fillColor("#6B7280")
      .text(`Invoice No: ${invoice.invoiceNumber}`, 400, 55, { align: "right" });

    doc
      .fontSize(10)
      .fillColor("#6B7280")
      .text(`Issue Date: ${new Date(invoice.issueDate).toDateString()}`, 400, 75, {
        align: "right",
      });

    doc
      .fontSize(10)
      .fillColor("#6B7280")
      .text(`Due Date: ${new Date(invoice.dueDate).toDateString()}`, 400, 92, {
        align: "right",
      });

    // Status Badge
    const statusColor =
      invoice.status === "PAID" ? "#16A34A" : "#D97706";

    doc
      .roundedRect(400, 115, 140, 25, 12)
      .fill(statusColor);

    doc
      .fillColor("white")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(invoice.status, 400, 122, {
        width: 140,
        align: "center",
      });

    doc.font("Helvetica").fillColor("#111827");

    drawLine(155);

    // ---------------- CUSTOMER INFO ----------------
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Billed To", 50, 175);

    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#111827")
      .text(invoice.customerName, 50, 195);

    doc
      .fontSize(10)
      .fillColor("#6B7280")
      .text(`Currency: ${invoice.currency}`, 50, 215);

    doc.fillColor("#111827");

    // ---------------- LINE ITEMS TABLE ----------------
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827");
    doc.text("Line Items", 50, 250);

    // Table Header Background
    doc
      .roundedRect(50, 275, 495, 25, 6)
      .fill("#F3F4F6");

    doc.fillColor("#111827").fontSize(10).font("Helvetica-Bold");
    doc.text("Description", 60, 283);
    doc.text("Qty", 300, 283);
    doc.text("Unit Price", 360, 283);
    doc.text("Total", 470, 283);

    let y = 310;
    doc.font("Helvetica").fontSize(10).fillColor("#111827");

    lineItems.forEach((item, index) => {
      if (y > 650) {
        doc.addPage();
        y = 50;
      }

      doc.fillColor("#111827").text(item.description, 60, y, { width: 220 });

      doc.fillColor("#6B7280").text(item.quantity.toString(), 305, y);

      doc
        .fillColor("#6B7280")
        .text(`${currencySymbol}${item.unitPrice.toFixed(2)}`, 360, y);

      doc
        .fillColor("#111827")
        .font("Helvetica-Bold")
        .text(`${currencySymbol}${item.lineTotal.toFixed(2)}`, 470, y);

      doc.font("Helvetica");

      y += 25;

      // row separator
      doc
        .strokeColor("#E5E7EB")
        .lineWidth(0.7)
        .moveTo(50, y)
        .lineTo(545, y)
        .stroke();

      y += 10;
    });

    // ---------------- TOTALS BOX ----------------
    let totalsY = y + 30;

    if (totalsY < 500) totalsY = 500;

    doc
      .roundedRect(330, totalsY, 215, 120, 10)
      .fill("#F9FAFB");

    doc.fillColor("#111827").fontSize(10).font("Helvetica-Bold");

    doc.text("Subtotal:", 350, totalsY + 20);
    doc.text(`${currencySymbol}${subtotal.toFixed(2)}`, 450, totalsY + 20, {
      align: "right",
      width: 80,
    });

    doc.font("Helvetica").fillColor("#6B7280");
    doc.text(`Tax (${taxPercent}%):`, 350, totalsY + 40);
    doc.text(`${currencySymbol}${taxAmount.toFixed(2)}`, 450, totalsY + 40, {
      align: "right",
      width: 80,
    });

    doc.font("Helvetica-Bold").fillColor("#111827");
    doc.text("Total:", 350, totalsY + 60);
    doc.text(`${currencySymbol}${total.toFixed(2)}`, 450, totalsY + 60, {
      align: "right",
      width: 80,
    });

    doc.font("Helvetica").fillColor("#6B7280");
    doc.text("Amount Paid:", 350, totalsY + 80);
    doc.text(`${currencySymbol}${amountPaid.toFixed(2)}`, 450, totalsY + 80, {
      align: "right",
      width: 80,
    });

    doc.font("Helvetica-Bold").fillColor("#DC2626");
    doc.text("Balance Due:", 350, totalsY + 100);
    doc.text(`${currencySymbol}${balanceDue.toFixed(2)}`, 450, totalsY + 100, {
      align: "right",
      width: 80,
    });

    doc.fillColor("#111827");

    // ---------------- PAYMENTS SECTION ----------------
    const paymentsY = totalsY + 150;

    doc.fontSize(12).font("Helvetica-Bold").fillColor("#111827");
    doc.text("Payments", 50, paymentsY);

    let payY = paymentsY + 20;

    doc.fontSize(10).font("Helvetica").fillColor("#374151");

    if (payments.length === 0) {
      doc.fillColor("#6B7280").text("No payments yet.", 50, payY);
    } else {
      payments.forEach((pay, index) => {
        doc
          .roundedRect(50, payY, 495, 25, 8)
          .fill("#F3F4F6");

        doc.fillColor("#111827").text(
          `${index + 1}. Paid ${currencySymbol}${pay.amount.toFixed(2)} on ${new Date(
            pay.paymentDate
          ).toDateString()}`,
          60,
          payY + 7
        );

        payY += 35;

        if (payY > 750) {
          doc.addPage();
          payY = 50;
        }
      });
    }

    // ---------------- FOOTER ----------------
    doc
      .fontSize(9)
      .fillColor("#9CA3AF")
      .text("Generated by Invoice Management System", 50, 780, {
        align: "center",
        width: 495,
      });

    doc.end();
  } catch (error) {
    console.log("PDF Error:", error);
    res.status(500).json({ message: "PDF generation failed" });
  }
};

module.exports = { generateInvoicePDF };
