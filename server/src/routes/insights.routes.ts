import { Router } from 'express';
import { z } from 'zod';
import { h, parse } from './helpers';
import { requireAuth, requireRole, brandScope } from '../auth/auth';
import { CoreError } from '../core/ids';
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
  const sc = SCENARIOS.find((x) => x.key === scenario);
  if (!sc) throw new CoreError(`Unknown scenario ${scenario}`, 404, 'NOT_FOUND');
  const scope = brandScope(req.user!);
  if (scope !== null && !scope.includes(sc.brand_id)) throw new CoreError(`This scenario runs against ${sc.brand_id}, which is outside your workspace.`, 403, 'FORBIDDEN');
  res.json(await runScenario(scenario, { mode, started_by: req.user!.id }));
}));
