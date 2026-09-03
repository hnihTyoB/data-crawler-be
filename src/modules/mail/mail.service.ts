import nodemailer from "nodemailer";
import { mailConfig } from "../../config/mail.config";

export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.port === 465,
      auth: {
        user: mailConfig.user,
        pass: mailConfig.pass,
      },
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${mailConfig.frontendUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: mailConfig.from,
      to: email,
      subject: "Reset Your Password - Data Crawler",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333333; text-align: center;">Reset Your Password</h2>
          <p style="color: #555555; font-size: 16px; line-height: 1.5;">
            You requested to reset your password for your Data Crawler account. Click the button below to set a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #777777; font-size: 14px; line-height: 1.5;">
            This link is valid for 15 minutes. If you did not request a password reset, please ignore this email.
          </p>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
          <p style="color: #999999; font-size: 12px; text-align: center;">
            If you're having trouble clicking the button, copy and paste the URL below into your web browser:
            <br>
            <a href="${resetUrl}" style="color: #007bff; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${mailConfig.frontendUrl}/verify-email?token=${token}`;

    const mailOptions = {
      from: mailConfig.from,
      to: email,
      subject: "Verify Your Email Address - Data Crawler",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #333333; text-align: center;">Verify Your Email Address</h2>
          <p style="color: #555555; font-size: 16px; line-height: 1.5;">
            Thank you for registering with Data Crawler! Please click the button below to verify your email address and activate your account:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background-color: #28a745; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
              Verify Email
            </a>
          </div>
          <p style="color: #777777; font-size: 14px; line-height: 1.5;">
            This link is valid for 24 hours. If you did not register for an account, please ignore this email.
          </p>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
          <p style="color: #999999; font-size: 12px; text-align: center;">
            If you're having trouble clicking the button, copy and paste the URL below into your web browser:
            <br>
            <a href="${verifyUrl}" style="color: #28a745; word-break: break-all;">${verifyUrl}</a>
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendDeactivationEmail(email: string, token: string): Promise<void> {
    const deactivateUrl = `${mailConfig.frontendUrl}/deactivate-account?token=${token}`;

    const mailOptions = {
      from: mailConfig.from,
      to: email,
      subject: "Confirm Account Deactivation - Data Crawler",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #d9534f; text-align: center;">Confirm Account Deactivation</h2>
          <p style="color: #555555; font-size: 16px; line-height: 1.5;">
            We received a request to deactivate your Data Crawler account. Deactivating your account will immediately stop all active crawl schedules and revoke your API keys and active sessions.
          </p>
          <p style="color: #555555; font-size: 16px; line-height: 1.5;">
            If you wish to proceed with deactivation, please click the confirmation button below:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${deactivateUrl}" style="background-color: #d9534f; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
              Confirm Deactivation
            </a>
          </div>
          <p style="color: #777777; font-size: 14px; line-height: 1.5;">
            This link is valid for 15 minutes. If you did not request to deactivate your account, please ignore this email and change your password immediately.
          </p>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
          <p style="color: #999999; font-size: 12px; text-align: center;">
            If you're having trouble clicking the button, copy and paste the URL below into your web browser:
            <br>
            <a href="${deactivateUrl}" style="color: #d9534f; word-break: break-all;">${deactivateUrl}</a>
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}
