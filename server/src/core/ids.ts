import { randomBytes } from 'node:crypto';

/** Short, prefixed, URL-safe identifiers: camp_8f3a2c1d */
export function newId(prefix: string, bytes = 5): string {
  return `${prefix}_${randomBytes(bytes).toString('hex')}`;
}

export class CoreError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(message: string, status = 400, code = 'BAD_REQUEST', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(what: string, id: string): CoreError {
  return new CoreError(`${what} '${id}' not found.`, 404, 'NOT_FOUND');
}

export function money(n: number): string {
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
