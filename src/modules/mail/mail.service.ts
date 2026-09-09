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

  async sendDigestEmail(
    recipients: string[],
    subject: string,
    digest: {
      period: "DAILY" | "WEEKLY";
      startDate: Date;
      endDate: Date;
      stats: {
        newUsers: number;
        crawlJobsTotal: number;
        crawlJobsCompleted: number;
        crawlJobsFailed: number;
        crawledPages: number;
        exportsGenerated: number;
        webhookDeliveries: number;
        auditLogsRecorded: number;
      };
    },
  ): Promise<void> {
    if (!recipients.length) return;

    const periodLabel = digest.period === "DAILY" ? "Hàng Ngày" : "Hàng Tuần";
    const dateRange = `${digest.startDate.toLocaleDateString("vi-VN")} - ${digest.endDate.toLocaleDateString("vi-VN")}`;

    const mailOptions = {
      from: mailConfig.from,
      to: recipients.join(", "),
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; background-color: #fcfdfc; border: 1px solid #d1fae5; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 6px 14px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 12px; font-weight: 600; color: #047857;">
              🌿 Báo Cáo Tổng Hợp ${periodLabel}
            </div>
            <h2 style="color: #064e3b; margin: 12px 0 4px 0; font-size: 22px;">Hệ Thống Data Crawler</h2>
            <p style="color: #6b7280; font-size: 13px; margin: 0;">Khung thời gian: ${dateRange}</p>
          </div>

          <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
            <h3 style="color: #111827; font-size: 15px; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px;">
              📊 Chỉ Số Hoạt Động Cốt Lõi
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #4b5563;">Người dùng mới đăng ký:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #065f46;">${digest.stats.newUsers}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4b5563;">Tổng tác vụ cào dữ liệu:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827;">${digest.stats.crawlJobsTotal}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4b5563;">Tác vụ hoàn thành thành công:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #059669;">${digest.stats.crawlJobsCompleted}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4b5563;">Tác vụ thất bại:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${digest.stats.crawlJobsFailed > 0 ? "#dc2626" : "#4b5563"};">${digest.stats.crawlJobsFailed}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4b5563;">Tổng số trang web đã crawl:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827;">${digest.stats.crawledPages}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4b5563;">Tệp dữ liệu xuất bản (Exports):</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827;">${digest.stats.exportsGenerated}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4b5563;">Thông báo Webhook đã gửi:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827;">${digest.stats.webhookDeliveries}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4b5563;">Nhật ký kiểm toán ghi nhận:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827;">${digest.stats.auditLogsRecorded}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 24px 0 12px 0;">
            <a href="${mailConfig.frontendUrl}/dashboard" style="background-color: #059669; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px; display: inline-block;">
              Mở Bảng Điều Khiển Quản Trị
            </a>
          </div>

          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            Đây là email tự động từ Phân hệ Tác vụ Định kỳ Data Crawler. Bạn nhận được thư này vì có quyền Quản trị viên hệ thống.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}

