const pdf = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');  // Use uuid for unique filenames
const puppeteer = require('puppeteer');

// Method to handle PDF generation from uploaded image
// const generatePdfFromImage = (req, res) => {
//   if (!req.file) {
//     return res.status(400).send({ error: 'No file uploaded.' });
//   }
  
//   // Extract the receiptId from the request body
//   const { receiptId } = req.body;

//   if (!receiptId) {
//     return res.status(400).send({ error: 'Receipt ID is required.' });
//   }

//   // Generate a unique file name using the receiptId and current timestamp
//   const uniqueFileName = `receipt_${receiptId}.pdf`; 

//   // req.file.buffer contains the uploaded image as a Buffer
//   const imageBuffer = req.file.buffer;
//   console.log(req.body)
  
//   // Generate a PDF from the image using `pdfkit`
//   const doc = new pdf();

//   // Save the PDF to the server or send directly to the client
//   const pdfFilePath = path.join(__dirname, '../uploads', uniqueFileName);
//   const writeStream = fs.createWriteStream(pdfFilePath);
  
//   // Pipe the generated PDF to the write stream
//   doc.pipe(writeStream);



//   try {
//      // Add the image to the PDF (you can adjust the dimensions)
//   doc.image(imageBuffer, {
//     // fit: [700, 700],
//     fit: [600, 700],
//     // align: 'center',
//     // valign: 'center'
//   });
    
//   } catch (error) {
//     console.log(error)
//   }
 

//   // Finalize the PDF and send the response
//   doc.end();

//   writeStream.on('finish', () => {
//     // Send the URL of the generated PDF as a response
//     res.json({ success: true, fileUrl: `/uploads/${uniqueFileName}` });
//   });
// };



// Ensure the uploads folder exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const generatePdfFromImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: 'No file uploaded.' });
  }

  // Extract the receiptId from the request body
  const { receiptId } = req.body;

  if (!receiptId) {
    return res.status(400).send({ error: 'Receipt ID is required.' });
  }

  // Generate a unique file name using the receiptId and current timestamp
  const uniqueFileName = `receipt_${receiptId}.pdf`; 

  // Define the path for the generated PDF
  const pdfFilePath = path.join(uploadsDir, uniqueFileName);

  // Get the uploaded image buffer
  const imageBuffer = req.file.buffer;

  // Create an HTML string with the image embedded
  const htmlContent = `
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;  /* Preserve the aspect ratio */
          }
        </style>
      </head>
      <body>
        <img src="data:image/png;base64,${imageBuffer.toString('base64')}" alt="Receipt">
      </body>
    </html>
  `;

  // Create a browser instance using Puppeteer
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    // Set the HTML content for the page
    await page.setContent(htmlContent);
    

    // Define the path for the generated PDF
    const pdfFilePath = path.join(__dirname, '../uploads', uniqueFileName);

    // Generate the PDF from the HTML content
    await page.pdf({
      path: pdfFilePath,
      format: 'A4',  // You can change this to another format if needed
      printBackground: true,
      landscape: false,  // Portrait mode
    });
    

    // Close the browser instance
    await browser.close();

    // Send the URL of the generated PDF as a response
    res.json({ success: true, fileUrl: `/uploads/${uniqueFileName}` });

  } catch (error) {
    console.log(error);
    await browser.close();
    res.status(500).send({ error: 'An error occurred while generating the PDF.' });
  }
};




module.exports = {
  generatePdfFromImage,
};



