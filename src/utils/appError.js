class AppError extends Error {
  constructor(message, statusCode, t, interpolation = {}) {
    const translatedMessage = t ? t(message, interpolation) : message;
    // console.log('Here:', t(message, interpolation));
    super(translatedMessage);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
