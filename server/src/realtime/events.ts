import { EventEmitter } from 'node:events';

/**
 * In-process event bus. Everything the core changes is announced here so the
 * dashboard (via SSE) and the agent runtime observe the same stream of facts.
 */
export type PlatformEventType =
  | 'campaign.updated'
  | 'shortlist.updated'
  | 'collaboration.updated'
  | 'deliverable.updated'
  | 'checkpoint.created'
  | 'checkpoint.resolved'
  | 'ledger.posted'
  | 'audit.appended'
  | 'notification.created'
  | 'agent.run'
  | 'session.updated'
  | 'evaluation.recorded';

export interface PlatformEvent {
  type: PlatformEventType;
  payload: Record<string, unknown>;
  at: string;
}

class PlatformBus extends EventEmitter {
  publish(type: PlatformEventType, payload: Record<string, unknown> = {}): void {
    const evt: PlatformEvent = { type, payload, at: new Date().toISOString() };
    this.emit('event', evt);
    this.emit(type, evt);
  }
}

export const bus = new PlatformBus();
bus.setMaxListeners(200);
