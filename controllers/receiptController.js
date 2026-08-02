const pdf = require("pdfkit");
const fs = require("fs");
const path = require("path");

const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const generatePdfFromImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: "No file uploaded." });
  }

  const { receiptId } = req.body;
  if (!receiptId) {
    return res.status(400).send({ error: "Receipt ID is required." });
  }

  const uniqueFileName = `receipt_${receiptId}.pdf`;
  const pdfFilePath = path.join(uploadsDir, uniqueFileName);
  const imageBuffer = req.file.buffer;

  try {
    const doc = new pdf({ size: "A4", margin: 0 });
    const writeStream = fs.createWriteStream(pdfFilePath);

    doc.pipe(writeStream);

    // Compute a centered portrait-friendly box for the receipt image (mobile-like vertical style).
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const fitWidth = Math.min(pageWidth * 0.87, 520);
    const fitHeight = Math.min(pageHeight * 0.95, 1100);
    const x = (pageWidth - fitWidth) / 2;
    const y = (pageHeight - fitHeight) / 2;

    doc.image(imageBuffer, x, y, {
      fit: [fitWidth, fitHeight],
      align: "center",
      valign: "center",
    });
    doc.end();

    writeStream.on("finish", () => {
      return res.json({ success: true, fileUrl: `/uploads/${uniqueFileName}` });
    });

    writeStream.on("error", (error) => {
      console.error("Error writing receipt PDF:", error);
      return res.status(500).send({
        error: "An error occurred while generating the PDF.",
        message: error?.message || String(error),
      });
    });
  } catch (error) {
    console.error("Error generating receipt PDF:", error);
    return res.status(500).send({
      error: "An error occurred while generating the PDF.",
      message: error?.message || String(error),
    });
  }
};

module.exports = {
  generatePdfFromImage,
};
