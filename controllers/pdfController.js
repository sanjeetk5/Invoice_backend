const PDFDocument = require("pdfkit");
const path = require("path");

const Invoice = require("../models/invoice");
const InvoiceLine = require("../models/invoiceline");
const Payment = require("../models/payment");

const formatMoney = (value) => {
  return Number(value || 0).toFixed(2);
};

const generateInvoicePDF = async (req, res) => {
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

    const currencySymbol =
      invoice.currency === "INR"
        ? "₹"
        : invoice.currency === "EUR"
        ? "€"
        : "$";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`
    );

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    // ---------------- FONTS ----------------
    const fontRegular = path.join(process.cwd(), "fonts/DejaVuSans.ttf");
    const fontBold = path.join(process.cwd(), "fonts/DejaVuSans-Bold.ttf");

    let REGULAR = "Helvetica";
    let BOLD = "Helvetica-Bold";

    try {
      doc.font(fontRegular);
      REGULAR = fontRegular;
      BOLD = fontBold;
    } catch (err) {
      console.log("⚠️ Fonts missing, using default Helvetica");
    }

    // ---------------- COMPANY INFO ----------------
    const company = {
      name: "Monefy Invoice System",
      email: "support@monefy.com",
      phone: "+91 98765 43210",
      address: "Noida, Uttar Pradesh, India",
    };

    // ---------------- LOGO ----------------
    // const logoPath = path.join(process.cwd(), "assets/logo.png");

    // ---------------- HELPERS ----------------
    const drawLine = (y) => {
      doc
        .strokeColor("#E5E7EB")
        .lineWidth(1)
        .moveTo(50, y)
        .lineTo(545, y)
        .stroke();
    };

    const checkPageBreak = (y) => {
      if (y > 740) {
        doc.addPage();
        return 50;
      }
      return y;
    };

    // ---------------- HEADER ----------------
    let startY = 45;

    // Logo
    // try {
    //   doc.image(logoPath, 50, startY, { width: 50 });
    // } catch (err) {}

    // Company Details
    doc
      .font(BOLD)
      .fontSize(18)
      .fillColor("#111827")
      .text(company.name, 110, startY);

    doc
      .font(REGULAR)
      .fontSize(10)
      .fillColor("#6B7280")
      .text(company.address, 110, startY + 22);

    doc.text(company.email, 110, startY + 37);
    doc.text(company.phone, 110, startY + 52);

    // Invoice Title
    doc
      .font(BOLD)
      .fontSize(28)
      .fillColor("#111827")
      .text("INVOICE", 50, startY + 10, {
        align: "right",
      });

    // ---------------- META CARD BOX (RIGHT SIDE) ----------------
    const cardX = 345;
    const cardY = startY + 40;
    const cardWidth = 200;
    const cardHeight = 85;

    // Gray Card Background
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 10).fill("#F3F4F6");

    // Card Text
    doc.font(REGULAR).fontSize(10).fillColor("#374151");

    doc.text(`Invoice No:`, cardX + 15, cardY + 12);
    doc
      .font(BOLD)
      .fillColor("#111827")
      .text(invoice.invoiceNumber, cardX + 85, cardY + 12, {
        width: cardWidth - 100,
        align: "right",
      });

    doc.font(REGULAR).fillColor("#374151");
    doc.text(`Issue Date:`, cardX + 15, cardY + 32);
    doc
      .fillColor("#111827")
      .text(new Date(invoice.issueDate).toDateString(), cardX + 85, cardY + 32, {
        width: cardWidth - 100,
        align: "right",
      });

    doc.fillColor("#374151");
    doc.text(`Due Date:`, cardX + 15, cardY + 52);
    doc
      .fillColor("#111827")
      .text(new Date(invoice.dueDate).toDateString(), cardX + 85, cardY + 52, {
        width: cardWidth - 100,
        align: "right",
      });

    // ---------------- STATUS BADGE BELOW META CARD ----------------
    const statusColor = invoice.status === "PAID" ? "#16A34A" : "#D97706";

    doc.roundedRect(cardX + 30, cardY + 95, 140, 25, 12).fill(statusColor);

    doc
      .fillColor("white")
      .font(BOLD)
      .fontSize(11)
      .text(invoice.status, cardX + 30, cardY + 102, {
        width: 140,
        align: "center",
      });

    drawLine(175);

    // ---------------- BILL TO ----------------
    doc
      .font(BOLD)
      .fontSize(12)
      .fillColor("#111827")
      .text("Billed To", 50, 195);

    doc
      .font(REGULAR)
      .fontSize(11)
      .fillColor("#111827")
      .text(invoice.customerName, 50, 215);

    doc
      .font(REGULAR)
      .fontSize(10)
      .fillColor("#6B7280")
      .text(`Currency: ${invoice.currency}`, 50, 235);

    // ---------------- LINE ITEMS ----------------
    doc
      .font(BOLD)
      .fontSize(12)
      .fillColor("#111827")
      .text("Line Items", 50, 275);

    doc.roundedRect(50, 295, 495, 25, 6).fill("#F3F4F6");

    doc.font(BOLD).fontSize(10).fillColor("#111827");
    doc.text("Description", 60, 303);
    doc.text("Qty", 300, 303);
    doc.text("Unit Price", 360, 303);
    doc.text("Line Total", 470, 303);

    let y = 335;

    doc.font(REGULAR).fontSize(10).fillColor("#111827");

    lineItems.forEach((item) => {
      y = checkPageBreak(y);

      doc.fillColor("#111827").text(item.description, 60, y, { width: 220 });

      doc.fillColor("#6B7280").text(item.quantity.toString(), 305, y);

      doc
        .fillColor("#6B7280")
        .text(`${currencySymbol}${formatMoney(item.unitPrice)}`, 360, y);

      doc
        .fillColor("#111827")
        .font(BOLD)
        .text(`${currencySymbol}${formatMoney(item.lineTotal)}`, 470, y);

      doc.font(REGULAR);

      y += 22;

      doc
        .strokeColor("#E5E7EB")
        .lineWidth(0.7)
        .moveTo(50, y)
        .lineTo(545, y)
        .stroke();

      y += 10;
    });

    // ---------------- TOTALS BOX ----------------
    let totalsY = y + 25;
    totalsY = checkPageBreak(totalsY);

    doc.roundedRect(330, totalsY, 215, 130, 10).fill("#F9FAFB");

    doc.font(BOLD).fontSize(10).fillColor("#111827");
    doc.text("Subtotal:", 350, totalsY + 18);
    doc.text(`${currencySymbol}${formatMoney(subtotal)}`, 450, totalsY + 18, {
      align: "right",
      width: 80,
    });

    doc.font(REGULAR).fillColor("#6B7280");
    doc.text(`Tax (${taxPercent}%):`, 350, totalsY + 40);
    doc.text(`${currencySymbol}${formatMoney(taxAmount)}`, 450, totalsY + 40, {
      align: "right",
      width: 80,
    });

    doc.font(BOLD).fillColor("#111827");
    doc.text("Total:", 350, totalsY + 62);
    doc.text(`${currencySymbol}${formatMoney(total)}`, 450, totalsY + 62, {
      align: "right",
      width: 80,
    });

    doc.font(REGULAR).fillColor("#6B7280");
    doc.text("Amount Paid:", 350, totalsY + 84);
    doc.text(`${currencySymbol}${formatMoney(amountPaid)}`, 450, totalsY + 84, {
      align: "right",
      width: 80,
    });

    doc.font(BOLD).fillColor("#DC2626");
    doc.text("Balance Due:", 350, totalsY + 106);
    doc.text(`${currencySymbol}${formatMoney(balanceDue)}`, 450, totalsY + 106, {
      align: "right",
      width: 80,
    });

    // ---------------- PAYMENTS ----------------
    let paymentsY = totalsY + 160;
    paymentsY = checkPageBreak(paymentsY);

    doc.font(BOLD).fontSize(12).fillColor("#111827");
    doc.text("Payments", 50, paymentsY);

    let payY = paymentsY + 20;
    doc.font(REGULAR).fontSize(10).fillColor("#374151");

    if (payments.length === 0) {
      doc.fillColor("#6B7280").text("No payments yet.", 50, payY);
    } else {
      payments.forEach((pay, index) => {
        payY = checkPageBreak(payY);

        doc.roundedRect(50, payY, 495, 25, 8).fill("#F3F4F6");

        doc
          .fillColor("#111827")
          .text(
            `${index + 1}. Paid ${currencySymbol}${formatMoney(
              pay.amount
            )} on ${new Date(pay.paymentDate).toDateString()}`,
            60,
            payY + 7
          );

        payY += 35;
      });
    }

    // ---------------- FOOTER ----------------
    // doc
    //   .font(REGULAR)
    //   .fontSize(9)
    //   .fillColor("#9CA3AF")
    //   .text(`Generated by ${company.name}`, 50, 790, {
    //     align: "center",
    //     width: 495,
    //   });

    doc.end();
  } catch (error) {
    console.log("PDF Error:", error);
    res.status(500).json({ message: "PDF generation failed" });
  }
};

module.exports = { generateInvoicePDF };
