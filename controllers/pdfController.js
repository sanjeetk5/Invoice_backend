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

    // ---------------- PDF RESPONSE HEADERS ----------------
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
    const cardX = 335;
    const cardY = startY + 45;
    const cardWidth = 210;
    const cardHeight = 85;

    // Gray Card Background
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 10).fill("#F3F4F6");

    // Card Border (premium look)
    doc
      .roundedRect(cardX, cardY, cardWidth, cardHeight, 10)
      .lineWidth(1)
      .strokeColor("#E5E7EB")
      .stroke();

    // Card Labels
    doc.font(REGULAR).fontSize(10).fillColor("#374151");

    doc.text("Invoice No:", cardX + 15, cardY + 12);

    // Invoice Number - SINGLE LINE (no wrap)
    doc
      .font(BOLD)
      .fontSize(9)
      .fillColor("#111827")
      .text(invoice.invoiceNumber, cardX + 85, cardY + 12, {
        width: cardWidth - 100,
        align: "right",
        lineBreak: false,
        ellipsis: true,
      });

    doc.font(REGULAR).fontSize(10).fillColor("#374151");
    doc.text("Issue Date:", cardX + 15, cardY + 34);

    doc
      .fillColor("#111827")
      .text(new Date(invoice.issueDate).toDateString(), cardX + 85, cardY + 34, {
        width: cardWidth - 100,
        align: "right",
        lineBreak: false,
      });

    doc.fillColor("#374151");
    doc.text("Due Date:", cardX + 15, cardY + 54);

    doc
      .fillColor("#111827")
      .text(new Date(invoice.dueDate).toDateString(), cardX + 85, cardY + 54, {
        width: cardWidth - 100,
        align: "right",
        lineBreak: false,
      });

    // ---------------- STATUS BADGE ----------------
    const statusColor = invoice.status === "PAID" ? "#16A34A" : "#D97706";

    doc.roundedRect(cardX + 35, cardY + 98, 140, 25, 12).fill(statusColor);

    // Badge border
    doc
      .roundedRect(cardX + 35, cardY + 98, 140, 25, 12)
      .lineWidth(1)
      .strokeColor("#0F9D58")
      .stroke();

    doc
      .fillColor("white")
      .font(BOLD)
      .fontSize(11)
      .text(invoice.status, cardX + 35, cardY + 105, {
        width: 140,
        align: "center",
      });

    drawLine(185);

    // ---------------- BILL TO ----------------
    doc
      .font(BOLD)
      .fontSize(12)
      .fillColor("#111827")
      .text("Billed To", 50, 205);

    doc
      .font(REGULAR)
      .fontSize(11)
      .fillColor("#111827")
      .text(invoice.customerName, 50, 225);

    doc
      .font(REGULAR)
      .fontSize(10)
      .fillColor("#6B7280")
      .text(`Currency: ${invoice.currency}`, 50, 245);

    // ---------------- LINE ITEMS ----------------
    doc
      .font(BOLD)
      .fontSize(12)
      .fillColor("#111827")
      .text("Line Items", 50, 285);

    // Table Header Background
    doc.roundedRect(50, 305, 495, 28, 8).fill("#F3F4F6");

    // Table Header Text
    doc.font(BOLD).fontSize(10).fillColor("#111827");
    doc.text("Description", 65, 315);
    doc.text("Qty", 305, 315);
    doc.text("Unit Price", 365, 315);
    doc.text("Line Total", 470, 315);

    let y = 350;
    doc.font(REGULAR).fontSize(10).fillColor("#111827");

    lineItems.forEach((item) => {
      y = checkPageBreak(y);

      doc.fillColor("#111827").text(item.description, 65, y, { width: 220 });

      doc.fillColor("#6B7280").text(item.quantity.toString(), 310, y);

      doc
        .fillColor("#6B7280")
        .text(`${currencySymbol}${formatMoney(item.unitPrice)}`, 365, y);

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

    doc.roundedRect(315, totalsY, 230, 140, 12).fill("#F9FAFB");

    doc
      .roundedRect(315, totalsY, 230, 140, 12)
      .lineWidth(1)
      .strokeColor("#E5E7EB")
      .stroke();

    doc.font(BOLD).fontSize(11).fillColor("#111827");
    doc.text("Subtotal:", 335, totalsY + 20);
    doc.text(`${currencySymbol}${formatMoney(subtotal)}`, 450, totalsY + 20, {
      align: "right",
      width: 80,
    });

    doc.font(REGULAR).fontSize(10).fillColor("#6B7280");
    doc.text(`Tax (${taxPercent}%):`, 335, totalsY + 45);
    doc.text(`${currencySymbol}${formatMoney(taxAmount)}`, 450, totalsY + 45, {
      align: "right",
      width: 80,
    });

    doc.font(BOLD).fontSize(11).fillColor("#111827");
    doc.text("Total:", 335, totalsY + 70);
    doc.text(`${currencySymbol}${formatMoney(total)}`, 450, totalsY + 70, {
      align: "right",
      width: 80,
    });

    doc.font(REGULAR).fontSize(10).fillColor("#6B7280");
    doc.text("Amount Paid:", 335, totalsY + 95);
    doc.text(`${currencySymbol}${formatMoney(amountPaid)}`, 450, totalsY + 95, {
      align: "right",
      width: 80,
    });

    doc.font(BOLD).fontSize(11).fillColor("#DC2626");
    doc.text("Balance Due:", 335, totalsY + 120);
    doc.text(`${currencySymbol}${formatMoney(balanceDue)}`, 450, totalsY + 120, {
      align: "right",
      width: 80,
    });

    // ---------------- PAYMENTS ----------------
    let paymentsY = totalsY + 170;
    paymentsY = checkPageBreak(paymentsY);

    doc.font(BOLD).fontSize(12).fillColor("#111827");
    doc.text("Payments", 50, paymentsY);

    let payY = paymentsY + 25;
    doc.font(REGULAR).fontSize(10).fillColor("#374151");

    if (payments.length === 0) {
      doc.fillColor("#6B7280").text("No payments yet.", 50, payY);
    } else {
      payments.forEach((pay, index) => {
        payY = checkPageBreak(payY);

        doc.roundedRect(50, payY, 495, 28, 10).fill("#F3F4F6");

        doc
          .roundedRect(50, payY, 495, 28, 10)
          .lineWidth(1)
          .strokeColor("#E5E7EB")
          .stroke();

        doc
          .fillColor("#111827")
          .text(
            `${index + 1}. Paid ${currencySymbol}${formatMoney(
              pay.amount
            )} on ${new Date(pay.paymentDate).toDateString()}`,
            65,
            payY + 9
          );

        payY += 40;
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
