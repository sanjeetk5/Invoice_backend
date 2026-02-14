const PDFDocument = require("pdfkit");
const path = require("path");
const Invoice = require("../models/invoice");
const InvoiceLine = require("../models/invoiceline");
const Payment = require("../models/payment");

// ✅ format number properly (fixes weird '1 issue)
const formatMoney = (value) => {
  return Number(value || 0).toFixed(2);
};

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

    // ------------------ PDF RESPONSE HEADERS ------------------
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`
    );

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    // ------------------ COMPANY INFO ------------------
    const company = {
      name: "Monefy Invoice System",
      email: "support@monefy.com",
      phone: "+91 98765 43210",
      address: "Noida, Uttar Pradesh, India",
    };

    // ------------------ LOGO ------------------
    // Put your logo inside backend/assets/logo.png
    // const logoPath = path.join(__dirname, "../assets/logo.png");

    // Helper to draw line
    const drawLine = (y) => {
      doc
        .strokeColor("#E5E7EB")
        .lineWidth(1)
        .moveTo(50, y)
        .lineTo(545, y)
        .stroke();
    };

    // Helper to check page break
    const checkPageBreak = (y) => {
      if (y > 740) {
        doc.addPage();
        return 50;
      }
      return y;
    };

    // ------------------ HEADER ------------------
    let startY = 45;

    // Logo
    // try {
    //   doc.image(logoPath, 50, startY, { width: 50 });
    // } catch (err) {
    //   // if logo missing, ignore
    // }

    // Company name
    doc
      .fontSize(18)
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .text(company.name, 110, startY);

    doc
      .fontSize(10)
      .fillColor("#6B7280")
      .font("Helvetica")
      .text(company.address, 110, startY + 22);

    doc.text(company.email, 110, startY + 37);
    doc.text(company.phone, 110, startY + 52);

    // Invoice Title
    doc
      .fontSize(26)
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .text("INVOICE", 400, startY, { align: "right" });

    // Invoice Meta Info
    doc
      .fontSize(10)
      .fillColor("#6B7280")
      .font("Helvetica")
      .text(`Invoice No: ${invoice.invoiceNumber}`, 400, startY + 35, {
        align: "right",
      });

    doc.text(`Issue Date: ${new Date(invoice.issueDate).toDateString()}`, 400, startY + 50, {
      align: "right",
    });

    doc.text(`Due Date: ${new Date(invoice.dueDate).toDateString()}`, 400, startY + 65, {
      align: "right",
    });

    // Status badge
    const statusColor = invoice.status === "PAID" ? "#16A34A" : "#D97706";

    doc.roundedRect(405, startY + 85, 130, 25, 12).fill(statusColor);

    doc
      .fillColor("white")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(invoice.status, 405, startY + 92, {
        width: 130,
        align: "center",
      });

    drawLine(150);

    // ------------------ BILL TO ------------------
    doc
      .fontSize(12)
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .text("Billed To", 50, 170);

    doc
      .fontSize(11)
      .fillColor("#111827")
      .font("Helvetica")
      .text(invoice.customerName, 50, 190);

    doc
      .fontSize(10)
      .fillColor("#6B7280")
      .text(`Currency: ${invoice.currency}`, 50, 208);

    // ------------------ LINE ITEMS ------------------
    doc
      .fontSize(12)
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .text("Line Items", 50, 245);

    // Table Header background
    doc.roundedRect(50, 265, 495, 25, 6).fill("#F3F4F6");

    doc.fillColor("#111827").fontSize(10).font("Helvetica-Bold");
    doc.text("Description", 60, 273);
    doc.text("Qty", 300, 273);
    doc.text("Unit Price", 360, 273);
    doc.text("Line Total", 470, 273);

    let y = 305;
    doc.font("Helvetica").fontSize(10).fillColor("#111827");

    lineItems.forEach((item) => {
      y = checkPageBreak(y);

      doc.fillColor("#111827").text(item.description, 60, y, { width: 220 });

      doc.fillColor("#6B7280").text(item.quantity.toString(), 305, y);

      doc
        .fillColor("#6B7280")
        .text(`${currencySymbol}${formatMoney(item.unitPrice)}`, 360, y);

      doc
        .fillColor("#111827")
        .font("Helvetica-Bold")
        .text(`${currencySymbol}${formatMoney(item.lineTotal)}`, 470, y);

      doc.font("Helvetica");

      y += 22;

      doc
        .strokeColor("#E5E7EB")
        .lineWidth(0.7)
        .moveTo(50, y)
        .lineTo(545, y)
        .stroke();

      y += 10;
    });

    // ------------------ TOTALS BOX ------------------
    let totalsY = y + 25;
    totalsY = checkPageBreak(totalsY);

    doc.roundedRect(330, totalsY, 215, 130, 10).fill("#F9FAFB");

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#111827");
    doc.text("Subtotal:", 350, totalsY + 18);
    doc.text(`${currencySymbol}${formatMoney(subtotal)}`, 450, totalsY + 18, {
      align: "right",
      width: 80,
    });

    doc.font("Helvetica").fillColor("#6B7280");
    doc.text(`Tax (${taxPercent}%):`, 350, totalsY + 40);
    doc.text(`${currencySymbol}${formatMoney(taxAmount)}`, 450, totalsY + 40, {
      align: "right",
      width: 80,
    });

    doc.font("Helvetica-Bold").fillColor("#111827");
    doc.text("Total:", 350, totalsY + 62);
    doc.text(`${currencySymbol}${formatMoney(total)}`, 450, totalsY + 62, {
      align: "right",
      width: 80,
    });

    doc.font("Helvetica").fillColor("#6B7280");
    doc.text("Amount Paid:", 350, totalsY + 84);
    doc.text(`${currencySymbol}${formatMoney(amountPaid)}`, 450, totalsY + 84, {
      align: "right",
      width: 80,
    });

    doc.font("Helvetica-Bold").fillColor("#DC2626");
    doc.text("Balance Due:", 350, totalsY + 106);
    doc.text(`${currencySymbol}${formatMoney(balanceDue)}`, 450, totalsY + 106, {
      align: "right",
      width: 80,
    });

    // ------------------ PAYMENTS ------------------
    let paymentsY = totalsY + 160;
    paymentsY = checkPageBreak(paymentsY);

    doc.fontSize(12).font("Helvetica-Bold").fillColor("#111827");
    doc.text("Payments", 50, paymentsY);

    let payY = paymentsY + 20;
    doc.fontSize(10).font("Helvetica").fillColor("#374151");

    if (payments.length === 0) {
      doc.fillColor("#6B7280").text("No payments yet.", 50, payY);
    } else {
      payments.forEach((pay, index) => {
        payY = checkPageBreak(payY);

        doc.roundedRect(50, payY, 495, 25, 8).fill("#F3F4F6");

        doc.fillColor("#111827").text(
          `${index + 1}. Paid ${currencySymbol}${formatMoney(
            pay.amount
          )} on ${new Date(pay.paymentDate).toDateString()}`,
          60,
          payY + 7
        );

        payY += 35;
      });
    }

    // ------------------ FOOTER ------------------
    doc
      .fontSize(9)
      .fillColor("#9CA3AF")
      .text(`Generated by ${company.name}`, 50, 790, {
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
