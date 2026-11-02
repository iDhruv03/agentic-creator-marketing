import type { Request, Response } from 'express';
import { bus, type PlatformEvent } from './events';
import { subscribeRun, listRunEvents, getRun } from '../agent/runs';

function open(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(': connected\n\n');
}

function send(res: Response, event: string, data: unknown, id?: string | number): void {
  if (id !== undefined) res.write(`id: ${id}\n`);
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Platform-wide change feed consumed by the dashboard to invalidate queries. */
export function platformEventStream(req: Request, res: Response): void {
  open(res);
  const listener = (evt: PlatformEvent) => send(res, evt.type, evt);
  bus.on('event', listener);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { bus.off('event', listener); clearInterval(ping); });
}

/** Replay + live tail of one agent run. */
export function runEventStream(req: Request, res: Response): void {
  const runId = String(req.params.id);
  let run;
  try { run = getRun(runId); } catch { res.status(404).json({ error: 'Run not found' }); return; }
  open(res);
  const lastSeq = Number(req.header('last-event-id') ?? req.query.after ?? 0);
  for (const e of listRunEvents(runId)) {
    if (e.seq > lastSeq) send(res, e.type, e, e.seq);
  }
  if (run.status !== 'RUNNING') { send(res, 'end', { status: run.status }); res.end(); return; }
  const unsubscribe = subscribeRun(runId, (e) => {
    send(res, e.type, e, e.seq);
    if (e.type === 'done') { send(res, 'end', { status: e.payload?.status }); res.end(); }
  });
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => { unsubscribe(); clearInterval(ping); });
}
