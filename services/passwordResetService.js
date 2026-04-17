const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const UnifiedUser = require("../models/unifiedUserModel");
const { emailService } = require("./emailService");
const { ValidationError, TokenExpiredError } = require("./errors/AppError");

class PasswordResetService {
  async findUserByEmail(email) {
    return UnifiedUser.findOne({ where: { email } });
  }

  async findActiveUserByResetToken(hashedToken) {
    return UnifiedUser.findOne({
      where: {
        reset_token: hashedToken,
        reset_token_expires: { [Op.gt]: new Date() },
      },
    });
  }

  async findExpiredUserByResetToken(hashedToken) {
    return UnifiedUser.findOne({
      where: {
        reset_token: hashedToken,
        reset_token_expires: { [Op.lte]: new Date() },
      },
    });
  }

  hashToken(rawToken) {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }

  generateToken() {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    return { rawToken, hashedToken, expiresAt };
  }

  async requestPasswordReset(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      throw new ValidationError("Valid email address is required");
    }

    const user = await this.findUserByEmail(normalizedEmail);

    // Return silently to avoid user/email enumeration
    if (!user) {
      return;
    }

    const { rawToken, hashedToken, expiresAt } = this.generateToken();

    user.reset_token = hashedToken;
    user.reset_token_expires = expiresAt;
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8100";
    const resetUrl = `${frontendUrl}/forgot-password?step=reset&token=${rawToken}`;

    const targetEmail = user.email;
    const targetName = user.name || user.username || "User";

    await emailService.sendPasswordResetEmail(
      targetEmail,
      resetUrl,
      targetName,
    );
  }

  async resetPassword(token, password) {
    const rawToken = String(token || "").trim();
    const newPassword = String(password || "");

    if (!rawToken) {
      throw new ValidationError("Token is required");
    }

    if (newPassword.length < 6) {
      throw new ValidationError("Password must be at least 6 characters");
    }

    const hashedToken = this.hashToken(rawToken);

    const user = await this.findActiveUserByResetToken(hashedToken);

    if (!user) {
      const expiredUser = await this.findExpiredUserByResetToken(hashedToken);

      if (expiredUser) {
        throw new TokenExpiredError();
      }

      throw new ValidationError("Invalid or expired reset token.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.confirm_password = hashedPassword;
    user.reset_token = null;
    user.reset_token_expires = null;
    await user.save();
  }
}

module.exports = {
  PasswordResetService,
  passwordResetService: new PasswordResetService(),
};
