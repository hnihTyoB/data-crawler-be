import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email.').email('Email không đúng định dạng.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Email không đúng định dạng.'),
  password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự.')
    .regex(/[a-z]/, 'Mật khẩu phải có ít nhất một chữ thường.')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất một chữ hoa.')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất một chữ số.')
    .regex(
      /[^a-zA-Z0-9]/,
      'Mật khẩu phải có ít nhất một ký tự đặc biệt.',
    ),
  fullName: z.string().trim().min(1, 'Họ và tên không được để trống.').optional(),
});

export const updateMeSchema = z.object({
  fullName: z.string().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại.'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự.')
      .regex(/[a-z]/, 'Mật khẩu phải có ít nhất một chữ thường.')
      .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất một chữ hoa.')
      .regex(/[0-9]/, 'Mật khẩu phải có ít nhất một chữ số.')
      .regex(
        /[^a-zA-Z0-9]/,
        'Mật khẩu phải có ít nhất một ký tự đặc biệt.',
      ),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới.'),
  })
  .refine(
    (data) => data.newPassword === data.confirmPassword,
    {
      message: 'Mật khẩu xác nhận không khớp.',
      path: ["confirmPassword"],
    }
  );

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email.').email('Email không đúng định dạng.'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự.')
    .regex(/[a-z]/, 'Mật khẩu phải có ít nhất một chữ thường.')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất một chữ hoa.')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất một chữ số.')
    .regex(
      /[^a-zA-Z0-9]/,
      'Mật khẩu phải có ít nhất một ký tự đặc biệt.',
    ),
});

export const resendVerificationSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email.').email('Email không đúng định dạng.'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Thiếu mã xác thực email.'),
});

