// details.code is a stable, language-neutral error code the UI can translate (e.g. "MACHINE_OCCUPIED").
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const fail = (status, code, message, extra = {}) => {
  throw new ApiError(status, message, { code, ...extra });
};
