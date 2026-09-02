process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-for-jest-must-be-32-chars-long';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-jest-must-be-32-chars-long';
process.env.WEBHOOK_ENCRYPTION_KEY = process.env.WEBHOOK_ENCRYPTION_KEY || 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
