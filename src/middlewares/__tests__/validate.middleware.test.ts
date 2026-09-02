import { z } from 'zod';
import { validate, validateQuery } from '../validate.middleware';
import { errorMiddleware } from '../error.middleware';
import { AppError } from '../../common/errors/app-error';

describe('Validation Middleware', () => {
  const schema = z.object({
    name: z.string().min(3),
    age: z.number().int().min(18),
  });

  it('passes valid request body to next()', () => {
    const req: any = { body: { name: 'Alice', age: 25 } };
    const res: any = {};
    const next = jest.fn();

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Alice', age: 25 });
  });

  it('attaches structured error details to AppError on invalid body', () => {
    const req: any = { body: { name: 'Al', age: 15 } };
    const res: any = {};
    const next = jest.fn();

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error: AppError = next.mock.calls[0][0];
    expect(error.statusCode).toBe(422);
    expect(error.details).toEqual([
      { field: 'name', message: 'String must contain at least 3 character(s)' },
      { field: 'age', message: 'Number must be greater than or equal to 18' },
    ]);
  });

  it('formats JSON response with errors array in errorMiddleware', () => {
    const error = new AppError('Validation error', 422, 'VALIDATION_ERROR' as any, [
      { field: 'email', message: 'Invalid email' },
    ]);
    const req: any = {};
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    errorMiddleware(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation error',
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'email', message: 'Invalid email' }],
    });
  });

  it('validates request path params and passes valid params to next()', () => {
    const paramSchema = z.object({
      id: z.string().uuid('ID must be a valid UUID'),
    });
    const req: any = { params: { id: '123e4567-e89b-12d3-a456-426614174000' } };
    const res: any = {};
    const next = jest.fn();

    const { validateParams } = require('../validate.middleware');
    validateParams(paramSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.params).toEqual({ id: '123e4567-e89b-12d3-a456-426614174000' });
  });

  it('rejects invalid path params with 422 AppError', () => {
    const paramSchema = z.object({
      id: z.string().uuid('ID must be a valid UUID'),
    });
    const req: any = { params: { id: 'invalid-not-uuid' } };
    const res: any = {};
    const next = jest.fn();

    const { validateParams } = require('../validate.middleware');
    validateParams(paramSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error: AppError = next.mock.calls[0][0];
    expect(error.statusCode).toBe(422);
    expect(error.details).toEqual([
      { field: 'id', message: 'ID must be a valid UUID' },
    ]);
  });
});
