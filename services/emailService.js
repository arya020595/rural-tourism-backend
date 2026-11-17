const nodemailer = require("nodemailer");

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

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
    const safeName = escapeHtml(name);
    const safeResetUrlText = escapeHtml(resetUrl);
    const subject = "Reset Your Password";
    const html = `
      <p>Hello ${safeName},</p>
      <p>We received a request to reset your password.</p>
      <p>Click the link below to set a new password:</p>
      <p><a href="${resetUrl}" target="_blank" rel="noopener noreferrer">${safeResetUrlText}</a></p>
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

  /** Registration approval: the operator can now log in. */
  async sendRegistrationApprovedEmail(to, name, companyName, loginUrl) {
    const subject = "Pendaftaran RuTEC diluluskan / RuTEC registration approved";
    const html = `
      <p>Hello ${escapeHtml(name)},</p>
      <p>Pendaftaran <b>${escapeHtml(companyName)}</b> telah diluluskan oleh persatuan anda. Anda kini boleh log masuk.</p>
      <p>The registration for <b>${escapeHtml(companyName)}</b> has been approved by your association. You can now log in.</p>
      <p><a href="${loginUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(loginUrl)}</a></p>
    `;
    const text = [
      `Hello ${name},`,
      "",
      `Pendaftaran ${companyName} telah diluluskan oleh persatuan anda. Anda kini boleh log masuk.`,
      `The registration for ${companyName} has been approved by your association. You can now log in.`,
      "",
      loginUrl,
    ].join("\n");
    return this.sendMail({ to, subject, html, text });
  }

  /** Registration approval: rejected — contact the association. */
  async sendRegistrationRejectedEmail(to, name, companyName, reason, associationName) {
    const subject = "Pendaftaran RuTEC ditolak / RuTEC registration rejected";
    const who = associationName ? escapeHtml(associationName) : "persatuan anda / your association";
    const html = `
      <p>Hello ${escapeHtml(name)},</p>
      <p>Pendaftaran <b>${escapeHtml(companyName)}</b> tidak diluluskan. / The registration for <b>${escapeHtml(companyName)}</b> was not approved.</p>
      <p><b>Sebab / Reason:</b> ${escapeHtml(reason || "-")}</p>
      <p>Sila hubungi ${who} untuk mengemas kini pendaftaran anda. / Please contact ${who} to update your registration.</p>
    `;
    const text = [
      `Hello ${name},`,
      "",
      `Pendaftaran ${companyName} tidak diluluskan. / The registration for ${companyName} was not approved.`,
      `Sebab / Reason: ${reason || "-"}`,
      `Sila hubungi ${associationName || "persatuan anda"} untuk mengemas kini pendaftaran anda. / Please contact ${associationName || "your association"} to update your registration.`,
    ].join("\n");
    return this.sendMail({ to, subject, html, text });
  }

  /** An active member deactivated by its association — contact the association. */
  async sendCompanyDeactivatedEmail(to, name, companyName, reason, associationName) {
    const subject = "Akaun RuTEC tidak aktif / RuTEC account deactivated";
    const who = associationName ? escapeHtml(associationName) : "persatuan anda / your association";
    const html = `
      <p>Hello ${escapeHtml(name)},</p>
      <p>Akaun <b>${escapeHtml(companyName)}</b> telah dinyahaktifkan oleh persatuan anda. / The account for <b>${escapeHtml(companyName)}</b> has been deactivated by your association.</p>
      <p><b>Sebab / Reason:</b> ${escapeHtml(reason || "-")}</p>
      <p>Sila hubungi ${who} untuk maklumat lanjut. / Please contact ${who} for more information.</p>
    `;
    const text = [
      `Hello ${name},`,
      "",
      `Akaun ${companyName} telah dinyahaktifkan oleh persatuan anda. / The account for ${companyName} has been deactivated by your association.`,
      `Sebab / Reason: ${reason || "-"}`,
      `Sila hubungi ${associationName || "persatuan anda"} untuk maklumat lanjut. / Please contact ${associationName || "your association"} for more information.`,
    ].join("\n");
    return this.sendMail({ to, subject, html, text });
  }
}

module.exports = {
  EmailService,
  emailService: new EmailService(),
};
