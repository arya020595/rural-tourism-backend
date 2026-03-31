const multer = require("multer");

const storage = multer.memoryStorage();

const allowedMimeTypesByField = {
  operator_logo_image: ["application/pdf", "image/jpeg", "image/png"],
  motac_license_file: ["application/pdf", "image/jpeg", "image/png"],
  trading_operation_license: ["application/pdf", "image/jpeg", "image/png"],
  homestay_certificate: ["application/pdf", "image/jpeg", "image/png"],
  company_logo: ["application/pdf", "image/jpeg", "image/png"],
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = allowedMimeTypesByField[file.fieldname];

    if (!allowedMimeTypes) {
      cb(new Error(`Unsupported upload field: ${file.fieldname}`));
      return;
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      cb(
        new Error(
          `Invalid file type for ${file.fieldname}. Allowed: ${allowedMimeTypes.join(", ")}`,
        ),
      );
      return;
    }

    cb(null, true);
  },
});

module.exports = upload;
