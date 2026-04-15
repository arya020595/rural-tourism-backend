const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail({ to, subject, html, text }) {
    return this.transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@ruraltourism.com",
      to,
      subject,
      html,
      text,
    });
  }

  async sendPasswordResetEmail(to, resetUrl, name = "User") {
    const subject = "Reset Your Password";
    const html = `
      <p>Hello ${name},</p>
      <p>We received a request to reset your password.</p>
      <p>Click the link below to set a new password:</p>
      <p><a href="${resetUrl}" target="_blank" rel="noopener noreferrer">${resetUrl}</a></p>
      <p>This link expires in 1 hour and can only be used once.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `;
    const text = [
      `Hello ${name},`,
      "",
      "We received a request to reset your password.",
      "Open the link below to set a new password:",
      resetUrl,
      "",
      "This link expires in 1 hour and can only be used once.",
      "If you did not request this, you can ignore this email.",
    ].join("\n");

    return this.sendMail({ to, subject, html, text });
  }
}

module.exports = {
  EmailService,
  emailService: new EmailService(),
};
