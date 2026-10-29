import mongoose from 'mongoose';
import { HttpError } from '../utils/http-error.js';

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'Route not found'));
}

export function errorHandler(error, _req, res, _next) {
  let status = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let details = error.details;
  if (error?.name === 'ZodError') {
    status = 400;
    message = 'Request validation failed';
    details = error.issues?.map((item) => ({ field: item.path.join('.'), message: item.message }));
  } else if (error instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed';
    details = Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }));
  } else if (error instanceof mongoose.Error.CastError) {
    status = 400;
    message = 'Invalid identifier';
  } else if (error?.code === 11000) {
    status = 409;
    message = 'A record with this unique value already exists';
  }
  if (status >= 500) message = 'Internal server error';
  res.status(status).json({ error: { message, ...(details ? { details } : {}) } });
}
