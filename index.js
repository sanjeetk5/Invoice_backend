const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connection = require("./config/db");
const invoiceRoutes = require("./routes/invoiceRoutes");
const authRoutes = require("./routes/authRoutes");
const pdfRoutes = require("./routes/pdfRoutes");

const app = express();

app.use(cors());
app.use(express.json());


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api", pdfRoutes);

app.get("/", (req, res) => {
  res.send("Invoice Backend Running 🚀");
});

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

app.listen(process.env.port, async () => {
    try {
      await connection;
      console.log("Connected to db");
    } catch (err) {
      console.log(err);
      console.log("Error connecting in database");
    }


    console.log(`Server running on http://localhost:${process.env.port}`);
  
    //console.log(`Server is running at port ${process.env.port}`);
  });
