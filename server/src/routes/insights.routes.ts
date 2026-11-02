import { Router } from 'express';
import { z } from 'zod';
import { h, parse } from './helpers';
import { requireAuth, requireRole } from '../auth/auth';
import { overviewAnalytics } from '../core/analytics';
import { evaluationSummary, runScenario, SCENARIOS } from '../core/evaluation';

export const insightsRouter = Router();

insightsRouter.get('/overview', requireRole('BRAND', 'AGENCY'), h((req, res) => {
  const user = req.user!;
  res.json(overviewAnalytics(user.role === 'BRAND' ? { brand_id: user.brand_id! } : user.role === 'AGENCY' ? { agency_id: user.agency_id! } : {}));
}));

insightsRouter.get('/evaluation', requireAuth, h((_req, res) => res.json(evaluationSummary())));
insightsRouter.get('/evaluation/scenarios', requireAuth, h((_req, res) => res.json(SCENARIOS)));

insightsRouter.post('/evaluation/run', requireRole('BRAND', 'AGENCY'), h(async (req, res) => {
  const { scenario, mode } = parse(z.object({ scenario: z.string(), mode: z.enum(['LLM', 'SIMULATED', 'AUTO']).optional() }), req.body);
  res.json(await runScenario(scenario, { mode, started_by: req.user!.id }));
}));
