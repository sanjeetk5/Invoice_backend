const puppeteer = require("puppeteer");
const Invoice = require("../models/invoice");
const InvoiceLine = require("../models/invoiceline");
const Payment = require("../models/payment");

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

    const html = `
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 30px;
            color: #111;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .info {
            margin-top: 10px;
            font-size: 14px;
            color: #444;
          }
          .badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            display: inline-block;
          }
          .paid {
            background: #d1fae5;
            color: #065f46;
          }
          .draft {
            background: #fef3c7;
            color: #92400e;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            font-size: 13px;
          }
          th {
            background: #f9fafb;
            text-align: left;
          }
          .totals {
            margin-top: 30px;
            width: 320px;
            float: right;
            font-size: 14px;
          }
          .totals div {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          .totals .bold {
            font-weight: bold;
          }
          .payments {
            margin-top: 50px;
          }
          .payments h3 {
            margin-bottom: 10px;
          }
          .payment-item {
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 10px;
            font-size: 13px;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div>
            <h1>Invoice</h1>
            <div class="info">
              <p><b>Invoice Number:</b> ${invoice.invoiceNumber}</p>
              <p><b>Customer:</b> ${invoice.customerName}</p>
              <p><b>Issue Date:</b> ${new Date(invoice.issueDate).toDateString()}</p>
              <p><b>Due Date:</b> ${new Date(invoice.dueDate).toDateString()}</p>
              <p><b>Currency:</b> ${invoice.currency}</p>
            </div>
          </div>

          <div>
            <span class="badge ${
              invoice.status === "PAID" ? "paid" : "draft"
            }">
              ${invoice.status}
            </span>
          </div>
        </div>

        <h3>Line Items</h3>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems
              .map(
                (item) => `
              <tr>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>${currencySymbol}${item.unitPrice}</td>
                <td>${currencySymbol}${item.lineTotal}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="totals">
          <div><span>Subtotal:</span><span class="bold">${currencySymbol}${subtotal.toFixed(
            2
          )}</span></div>
          <div><span>Tax (${taxPercent}%):</span><span class="bold">${currencySymbol}${taxAmount.toFixed(
            2
          )}</span></div>
          <div><span>Total:</span><span class="bold">${currencySymbol}${total.toFixed(
            2
          )}</span></div>
          <div><span>Amount Paid:</span><span class="bold">${currencySymbol}${amountPaid.toFixed(
            2
          )}</span></div>
          <div><span>Balance Due:</span><span class="bold">${currencySymbol}${balanceDue.toFixed(
            2
          )}</span></div>
        </div>

        <div style="clear: both;"></div>

        <div class="payments">
          <h3>Payments</h3>
          ${
            payments.length === 0
              ? "<p>No payments yet.</p>"
              : payments
                  .map(
                    (pay) => `
                  <div class="payment-item">
                    Paid <b>${currencySymbol}${pay.amount}</b> on ${new Date(
                      pay.paymentDate
                    ).toDateString()}
                  </div>
                `
                  )
                  .join("")
          }
        </div>

      </body>
      </html>
    `;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.log("PDF Error:", error);
    res.status(500).json({ message: "PDF generation failed" });
  }
};

module.exports = { generateInvoicePDF };
