const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');  // Adjust the path if necessary
const multer = require('multer');
const db = require('../config/db');



const storage = multer.memoryStorage(); // Store files in memory for immediate processing
const upload = multer({ storage: storage }).single('receiptImage'); // 'receiptImage' is the field name you use in the form

router.post('/generate-pdf-from-image', upload, receiptController.generatePdfFromImage);
// Route to handle voiding the receipt
router.post('/void-receipt', (req, res) => {
    const { receipt_id } = req.body; // 'receipt_id' is coming from the frontend

    if (!receipt_id) {
      return res.status(400).send({ error: 'receipt_id is required' });
    }

    // Update the status column to 'void' for the given receipt_id
    db.query('UPDATE form_responses SET status = ? WHERE receipt_id = ?', 
        {
            replacements: ['void', receipt_id],
            type: db.QueryTypes.UPDATE
        })
        .then(() => {
            res.status(200).send({ message: 'Receipt voided successfully' });
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send({ error: 'Failed to void receipt' });
        });
});

module.exports = router;

//file transfer
// router.post('/generate-pdf-from-image', receiptController.uploadReceiptImage);



// Route to handle PDF generation from base64 image
// router.post('/generate-pdf-from-image', receiptController.generatePdf);

// Set up multer to handle file uploads