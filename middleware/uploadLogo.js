const multer = require("multer");

const storage = multer.memoryStorage();

const allowedMimeTypesByField = {
  operator_logo_image: ["image/jpeg", "image/png"],
  motac_license_file: ["application/pdf"],
  trading_operation_license: ["application/pdf"],
  homestay_certificate: ["application/pdf"],
  company_logo: ["image/jpeg", "image/png"],
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
