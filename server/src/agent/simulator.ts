import { AgentToolkit } from './toolkit';
import { getCampaign } from '../core/campaigns';
import { listCollaborations } from '../core/collaborations';

/**
 * Deterministic planner used when no LLM credentials are configured.
 * It follows the same discovery → shortlist → brief → offer → track → pay
 * arc a Claude-driven run takes, reasoning from real campaign data and
 * calling the same governed tools, so guardrails and checkpoints fire
 * exactly as they would for a live model.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export async function runSimulatedAgent(kit: AgentToolkit, campaignId: string, goal: string): Promise<string> {
  const pace = Number(process.env.CMI_SIM_PACE_MS ?? 350);
  const g = goal.toLowerCase();
  const wantsPayment = /\b(pay|payout|release|settle)\b/.test(g);
  const wantsTracking = /\b(track|verify|deliverable|content|publish)\b/.test(g) || wantsPayment;
  const offerCount = /\b(one|1|single)\b/.test(g) ? 1 : /\b(three|3)\b/.test(g) ? 3 : 2;

  kit.status('Planning: inspect campaign → discover creators → shortlist → refine brief → send offers' + (wantsTracking ? ' → track deliverables' : '') + (wantsPayment ? ' → release payments' : ''));
  await sleep(pace);

  // 1. Inspect
  const campaign = getCampaign(campaignId);
  kit.think(`Before spending anything I need the current state of "${campaign.title}": available budget, who is already shortlisted or under contract, and any pending checkpoints. Goal from the operator: "${goal}".`);
  const status = await kit.call('get_campaign_status', { campaign_id: campaignId });
  if (kit.cancelled) return 'Run cancelled by operator.';
  const snapshot = (status.result as any) ?? {};
  const available = snapshot.budget?.available ?? campaign.financials.available;
  const existing: string[] = (snapshot.collaborations ?? []).filter((c: any) => !['DECLINED', 'CANCELLED'].includes(c.status)).map((c: any) => c.creator_id);
  await sleep(pace);

  // 2. Discover
  const niche = campaign.target_niches[0] ?? campaign.brand_name ?? '';
  const ceiling = Math.min(kit.session.rate_ceiling, campaign.rate_band_max ?? Number.POSITIVE_INFINITY);
  kit.think(`Budget available is ${money(available)} and my per-collaboration ceiling is ${money(kit.session.rate_ceiling)}${campaign.rate_band_max ? ` (campaign band ≤ ${money(campaign.rate_band_max)})` : ''}. I will search "${niche}" creators${campaign.target_platforms.length ? ` on ${campaign.target_platforms.join('/')}` : ''}, scored against this brief, and look for high engagement relative to audience size.`);
  const search = await kit.call('search_creators', { campaign_id: campaignId, niche, platform: campaign.target_platforms[0], min_engagement: 3, limit: 8, sort: 'relevance' });
  if (kit.cancelled) return 'Run cancelled by operator.';
  let candidates: any[] = ((search.result as any)?.creators ?? []).filter((c: any) => !existing.includes(c.id) && c.available !== false);
  if (candidates.length === 0) {
    kit.think('No niche match. Widening the search across all niches so I can still produce a defensible shortlist.');
    const wide = await kit.call('search_creators', { campaign_id: campaignId, min_engagement: 2, limit: 8 });
    candidates = ((wide.result as any)?.creators ?? []).filter((c: any) => !existing.includes(c.id));
  }
  await sleep(pace);

  // 3. Benchmark the top candidate's rate
  const top = candidates[0];
  if (top) {
    kit.think(`@${top.handle.replace('@', '')} leads with match ${top.match_score}/100 (${top.match_reasons?.[0] ?? 'strong fit'}). Let me sanity-check the video rate of ${money(top.rates_usd.video)} against peers before I commit budget.`);
    const bench = await kit.call('get_rate_benchmark', { follower_count: top.follower_count, deliverable: 'video', niche: top.primary_niche });
    const b = bench.result as any;
    if (b) kit.say(`Benchmark for ${b.tier} creators: median ${money(b.median)}, p75 ${money(b.p75)}. ${top.rates_usd.video <= b.p75 ? 'The asking rate is within market range.' : 'The asking rate is above the 75th percentile; I will negotiate or hold.'}`);
    await sleep(pace);
  }

  // 4. Shortlist
  const shortlist = candidates.slice(0, 3);
  for (const c of shortlist) {
    if (kit.cancelled) return 'Run cancelled by operator.';
    await kit.call('add_to_shortlist', { campaign_id: campaignId, creator_id: c.id, rationale: `${c.match_reasons?.slice(0, 2).join('. ') || 'Strong niche and audience fit'}. Engagement ${c.engagement_rate_pct}% on ${c.follower_count.toLocaleString()} followers; video rate ${money(c.rates_usd.video)}.` });
    await sleep(pace / 2);
  }

  // 5. Brief refinement (only when the brief is thin; post-acceptance edits trigger a checkpoint)
  if (!campaign.content_guidelines || campaign.content_guidelines.length < 60 || campaign.required_deliverables.length === 0) {
    kit.think('The content guidelines are thin. A precise brief lifts creator acceptance and makes compliance checks enforceable, so I will add disclosure, hashtag and deliverable requirements.');
    await kit.call('draft_campaign_brief', {
      campaign_id: campaignId,
      content_guidelines: `${campaign.content_guidelines ? campaign.content_guidelines + ' ' : ''}Disclose with #ad in the first line. Tag ${campaign.brand_name ? '@' + campaign.brand_name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'the brand'} and use #${campaign.title.replace(/[^A-Za-z0-9]/g, '')}. Mention the key product truths from the brief in the first 15 seconds.`,
      required_deliverables: campaign.required_deliverables.length ? campaign.required_deliverables : ['1x YouTube Video', '1x Instagram Reel'],
    });
    await sleep(pace);
  }

  // 6. Offers
  let sent = 0;
  const offerPlan = shortlist.slice(0, offerCount);
  for (const c of offerPlan) {
    if (kit.cancelled) return 'Run cancelled by operator.';
    const wantsVideo = campaign.required_deliverables.some((d) => /youtube|video/i.test(d)) || campaign.target_platforms.includes('youtube');
    const deliverables = wantsVideo && c.platforms.includes('youtube') ? ['YOUTUBE_VIDEO', 'REEL'] : c.platforms.includes('tiktok') ? ['TIKTOK_VIDEO', 'POST'] : ['REEL', 'POST'];
    const askingRate = deliverables.reduce((sum, d) => sum + (d === 'YOUTUBE_VIDEO' ? c.rates_usd.video : d === 'POST' ? c.rates_usd.post : c.rates_usd.reel), 0);
    // Negotiate toward the ceiling; the first candidate's full rate may exceed it, which exercises the checkpoint path.
    const proposed = sent === 0 ? askingRate : Math.min(askingRate, ceiling);
    const fits = proposed <= kit.session.rate_ceiling;
    kit.think(`Offering @${c.handle.replace('@', '')} ${deliverables.join(' + ')} at ${money(proposed)} (rate card ${money(askingRate)}). ${fits ? 'This is inside my ceiling, so it executes immediately with escrow locked.' : `This is above my ${money(kit.session.rate_ceiling)} ceiling; governance should park it for human approval rather than let me spend it.`}`);
    const deadline = campaign.end_date ?? new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
    const res = await kit.call('send_collaboration_offer', { campaign_id: campaignId, creator_id: c.id, proposed_rate: proposed, deliverables, deadline, terms: `${deliverables.length} deliverables with 30-day category exclusivity and a tracked link. Content must follow the brief and carry #ad disclosure.`, message: `Hi ${c.name.split(' ')[0]}, we loved your recent work and think you're a natural fit for ${campaign.title}.` });
    if (res.status === 'SUCCESS') sent += 1;
    if (res.status === 'REJECTED_BY_GUARDRAIL' && /Budget ceiling/i.test(res.error ?? '')) {
      kit.say('Hard budget ceiling reached. I will stop sending offers and report back rather than attempt to work around the limit.');
      break;
    }
    await sleep(pace);
  }

  // 7. Tracking & payments against already-accepted work
  if (wantsTracking) {
    const active = listCollaborations({ campaign_id: campaignId }).filter((c) => ['ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED'].includes(c.status));
    for (const col of active.slice(0, 2)) {
      if (kit.cancelled) return 'Run cancelled by operator.';
      const pending = col.deliverables.find((d) => d.status === 'PENDING');
      if (pending) {
        kit.think(`@${col.creator_handle} has a ${pending.deliverable_type} outstanding. I'll record the published URL and run compliance before anything is paid.`);
        const url = pending.platform === 'youtube' ? `https://youtube.com/watch?v=${col.id.slice(-6)}` : pending.platform === 'tiktok' ? `https://www.tiktok.com/@${col.creator_handle}/video/${Date.now()}` : `https://www.instagram.com/reel/${col.id.slice(-8)}/`;
        await kit.call('track_deliverable', { collaboration_id: col.id, deliverable_id: pending.id, content_url: url, caption: `#ad Testing ${campaign.title} this week — full thoughts in the video. ${campaign.content_guidelines.match(/#[A-Za-z0-9_]+/g)?.slice(0, 2).join(' ') ?? ''}` });
        await sleep(pace);
      }
      const submitted = listCollaborations({ campaign_id: campaignId }).find((c) => c.id === col.id)?.deliverables.find((d) => d.status === 'SUBMITTED');
      if (submitted) {
        if (submitted.compliance?.passed) {
          kit.think(`Compliance passed at ${submitted.compliance.score}%, so I can approve the ${submitted.deliverable_type}.`);
          await kit.call('review_deliverable', { deliverable_id: submitted.id, decision: 'APPROVED', notes: 'Meets brief and disclosure requirements.' });
        } else {
          kit.think(`Compliance flagged issues on the ${submitted.deliverable_type}; requesting changes rather than approving.`);
          await kit.call('review_deliverable', { deliverable_id: submitted.id, decision: 'CHANGES_REQUESTED', notes: submitted.compliance?.checks.filter((c) => !c.passed).map((c) => c.detail).join(' ') ?? 'Please fix disclosure.' });
        }
        await sleep(pace);
      }
      if (wantsPayment) {
        const approved = listCollaborations({ campaign_id: campaignId }).find((c) => c.id === col.id)?.deliverables.find((d) => d.status === 'APPROVED');
        if (approved) {
          const amount = col.agreed_rate ?? col.proposed_rate;
          kit.think(`Releasing ${money(amount)} to @${col.creator_handle} for the approved ${approved.deliverable_type}. ${amount > 1000 ? 'This exceeds the $1,000 autonomous threshold, so I expect a human checkpoint.' : 'This is under the autonomous threshold.'}`);
          await kit.call('release_payment', { collaboration_id: col.id, deliverable_id: approved.id, amount, note: 'Deliverable approved; releasing escrow.' });
          await sleep(pace);
        }
      }
    }
  }

  // 8. Wrap up
  await kit.call('list_audit_logs', { campaign_id: campaignId, limit: 10, this_session_only: true });
  const summary = `Campaign "${campaign.title}": shortlisted ${shortlist.length} creator(s), sent ${sent} offer(s) committing ${money(kit.spend)}, ${kit.checkpoints} action(s) held for human approval, ${kit.blocked} blocked by guardrails. ${kit.checkpoints > 0 ? 'Pending checkpoints need a reviewer decision before those actions take effect.' : 'No human intervention required.'}`;
  kit.say(summary);
  return summary;
}
