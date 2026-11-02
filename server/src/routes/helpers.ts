import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { CoreError } from '../core/ids';
import { appendAudit } from '../core/audit';
import type { AuthedRequest, User } from '../auth/auth';

export type Handler = (req: AuthedRequest, res: Response) => unknown | Promise<unknown>;

/** Wrap an async handler so thrown errors reach the error middleware. */
export function h(fn: Handler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as AuthedRequest, res)).catch(next);
  };
}

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`);
    throw new CoreError(`Validation failed: ${issues.join('; ')}`, 400, 'VALIDATION', issues);
  }
  return result.data;
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof CoreError) {
    res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body.', code: 'BAD_JSON' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: err?.message ?? 'Internal server error', code: 'INTERNAL' });
}

/** Record a human dashboard action in the same audit trail agents write to. */
export function auditHuman(user: User | undefined, tool: string, parameters: unknown, summary: string, campaignId?: string | null, status: 'SUCCESS' | 'FAILED' = 'SUCCESS'): void {
  appendAudit({ actor_type: 'HUMAN', actor_id: user?.id ?? 'anonymous', actor_name: user?.name, campaign_id: campaignId ?? null, tool_name: tool, parameters, execution_status: status, result_summary: summary, guardrail_notes: 'Human action via dashboard.' });
}

export const qnum = (v: unknown): number | undefined => (v === undefined || v === '' ? undefined : Number(v));
export const qstr = (v: unknown): string | undefined => (typeof v === 'string' && v.length ? v : undefined);
