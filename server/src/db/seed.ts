import { db, execute, initDatabase } from './database';

export function runSeed() {
  console.log('🌱 Seeding CMI Database with paper-aligned dataset...');

  // Ensure tables exist
  initDatabase();

  // Clear existing data to make seed idempotent
  execute('DELETE FROM evaluation_benchmarks;');
  execute('DELETE FROM audit_logs;');
  execute('DELETE FROM approval_checkpoints;');
  execute('DELETE FROM agent_sessions;');
  execute('DELETE FROM ledger_entries;');
  execute('DELETE FROM deliverables;');
  execute('DELETE FROM collaborations;');
  execute('DELETE FROM campaigns;');
  execute('DELETE FROM agency_brands;');
  execute('DELETE FROM creators;');
  execute('DELETE FROM agencies;');
  execute('DELETE FROM brands;');

  // 1. Brands
  const brands = [
    { id: 'brand_techpulse', name: 'TechPulse Audio', industry: 'Consumer Electronics', logo_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=120&auto=format&fit=crop&q=80', total_budget: 50000, allocated_budget: 20000, spent_budget: 3500 },
    { id: 'brand_glow', name: 'Glow Botanicals', industry: 'Beauty & Skincare', logo_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=120&auto=format&fit=crop&q=80', total_budget: 30000, allocated_budget: 12000, spent_budget: 2400 },
    { id: 'brand_apex', name: 'Apex Athletics', industry: 'Fitness & Apparel', logo_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=120&auto=format&fit=crop&q=80', total_budget: 75000, allocated_budget: 25000, spent_budget: 8200 },
  ];

  for (const b of brands) {
    execute(
      `INSERT INTO brands (id, name, industry, logo_url, total_budget, allocated_budget, spent_budget)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [b.id, b.name, b.industry, b.logo_url, b.total_budget, b.allocated_budget, b.spent_budget]
    );
  }

  // 2. Agencies
  const agencies = [
    { id: 'agency_omni', name: 'OmniMedia Creator Agency', contact_email: 'partnerships@omnimediacreators.com', logo_url: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?w=120&auto=format&fit=crop&q=80' },
    { id: 'agency_elevate', name: 'Elevate Marketing Group', contact_email: 'ops@elevatemedia.io', logo_url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=120&auto=format&fit=crop&q=80' }
  ];

  for (const a of agencies) {
    execute(
      `INSERT INTO agencies (id, name, contact_email, logo_url) VALUES (?, ?, ?, ?)`,
      [a.id, a.name, a.contact_email, a.logo_url]
    );
  }

  // Agency - Brand links
  execute(`INSERT INTO agency_brands (agency_id, brand_id) VALUES ('agency_omni', 'brand_techpulse');`);
  execute(`INSERT INTO agency_brands (agency_id, brand_id) VALUES ('agency_omni', 'brand_glow');`);
  execute(`INSERT INTO agency_brands (agency_id, brand_id) VALUES ('agency_elevate', 'brand_apex');`);

  // 3. Creators (10 rich creators)
  const creators = [
    {
      id: 'cr_marcus',
      name: 'Marcus Vance',
      handle: 'marcus_tech',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      bio: 'Deep-dive tech reviews, acoustics, audio gear, and cutting-edge gadget tear-downs. 7+ yrs reviewing hardware.',
      primary_niche: 'Tech & Gadgets',
      secondary_niches: JSON.stringify(['Audio Gear', 'Consumer Electronics', 'Productivity']),
      platforms: JSON.stringify(['youtube', 'instagram']),
      follower_count: 420000,
      engagement_rate: 4.8,
      rate_post: 750,
      rate_reel: 950,
      rate_video: 1800,
      rate_story: 400,
      audience_top_country: 'United States (48%)',
      audience_top_age: '25-34 (52%)',
      audience_gender_ratio: '68% Male / 32% Female',
      wallet_balance: 3600,
      escrow_pending: 1800,
      completed_campaigns: 14
    },
    {
      id: 'cr_elena',
      name: 'Elena Rostova',
      handle: 'elena_beauty',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      bio: 'Clean beauty advocate, dermatology student, organic skincare formulas & daily radiance rituals.',
      primary_niche: 'Beauty & Skincare',
      secondary_niches: JSON.stringify(['Wellness', 'Organic Living', 'Self Care']),
      platforms: JSON.stringify(['instagram', 'tiktok']),
      follower_count: 285000,
      engagement_rate: 5.4,
      rate_post: 500,
      rate_reel: 700,
      rate_video: 1200,
      rate_story: 300,
      audience_top_country: 'United States (55%)',
      audience_top_age: '18-24 (45%)',
      audience_gender_ratio: '78% Female / 22% Male',
      wallet_balance: 2400,
      escrow_pending: 1200,
      completed_campaigns: 18
    },
    {
      id: 'cr_david',
      name: 'David Chen',
      handle: 'dchen_fitness',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      bio: 'Hybrid athlete, marathoner, HIIT training programs & science-backed sports nutrition routines.',
      primary_niche: 'Fitness & Apparel',
      secondary_niches: JSON.stringify(['Athletics', 'Nutrition', 'Health']),
      platforms: JSON.stringify(['instagram', 'youtube', 'tiktok']),
      follower_count: 165000,
      engagement_rate: 6.2,
      rate_post: 400,
      rate_reel: 550,
      rate_video: 900,
      rate_story: 250,
      audience_top_country: 'Canada & USA (62%)',
      audience_top_age: '20-35 (60%)',
      audience_gender_ratio: '55% Male / 45% Female',
      wallet_balance: 1800,
      escrow_pending: 800,
      completed_campaigns: 9
    },
    {
      id: 'cr_maya',
      name: 'Maya Lin',
      handle: 'mayalifestyle',
      avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
      bio: 'Slow living, sustainable fashion, interior design aesthetics, and travel vlogs across Europe and Asia.',
      primary_niche: 'Lifestyle & Travel',
      secondary_niches: JSON.stringify(['Design', 'Fashion', 'Photography']),
      platforms: JSON.stringify(['instagram', 'youtube']),
      follower_count: 530000,
      engagement_rate: 3.9,
      rate_post: 900,
      rate_reel: 1200,
      rate_video: 2200,
      rate_story: 500,
      audience_top_country: 'United Kingdom (38%)',
      audience_top_age: '24-38 (58%)',
      audience_gender_ratio: '65% Female / 35% Male',
      wallet_balance: 5500,
      escrow_pending: 0,
      completed_campaigns: 22
    },
    {
      id: 'cr_jaxson',
      name: 'Jaxson Miller',
      handle: 'jax_gaming',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      bio: 'Pro gamer, gaming setups, mechanical keyboards, audio DACs, and competitive esports tips.',
      primary_niche: 'Tech & Gadgets',
      secondary_niches: JSON.stringify(['Gaming', 'PC Hardware', 'Streaming']),
      platforms: JSON.stringify(['youtube', 'tiktok']),
      follower_count: 340000,
      engagement_rate: 4.6,
      rate_post: 600,
      rate_reel: 800,
      rate_video: 1500,
      rate_story: 350,
      audience_top_country: 'United States (50%)',
      audience_top_age: '16-28 (68%)',
      audience_gender_ratio: '75% Male / 25% Female',
      wallet_balance: 2900,
      escrow_pending: 0,
      completed_campaigns: 11
    },
    {
      id: 'cr_chloe',
      name: 'Chloe Bennett',
      handle: 'chloewellness',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      bio: 'Certified holistic nutritionist, plant-based recipes, yoga, and mindful morning routines.',
      primary_niche: 'Beauty & Skincare',
      secondary_niches: JSON.stringify(['Wellness', 'Nutrition', 'Yoga']),
      platforms: JSON.stringify(['instagram', 'tiktok']),
      follower_count: 98000,
      engagement_rate: 6.7,
      rate_post: 350,
      rate_reel: 500,
      rate_video: 750,
      rate_story: 200,
      audience_top_country: 'Australia & USA (58%)',
      audience_top_age: '22-35 (55%)',
      audience_gender_ratio: '82% Female / 18% Male',
      wallet_balance: 1400,
      escrow_pending: 0,
      completed_campaigns: 8
    },
    {
      id: 'cr_liam',
      name: 'Liam O’Connor',
      handle: 'liam_ai_future',
      avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      bio: 'Exploring autonomous agents, developer tools, AI workflows, and hardware that powers the future.',
      primary_niche: 'Tech & Gadgets',
      secondary_niches: JSON.stringify(['Artificial Intelligence', 'Software', 'Productivity']),
      platforms: JSON.stringify(['youtube', 'instagram']),
      follower_count: 195000,
      engagement_rate: 5.9,
      rate_post: 550,
      rate_reel: 750,
      rate_video: 1300,
      rate_story: 300,
      audience_top_country: 'United States & Germany (52%)',
      audience_top_age: '22-40 (64%)',
      audience_gender_ratio: '72% Male / 28% Female',
      wallet_balance: 3100,
      escrow_pending: 0,
      completed_campaigns: 15
    },
    {
      id: 'cr_sarah',
      name: 'Sarah Jenkins',
      handle: 'sarah_active',
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      bio: 'Trail running, outdoor mountaineering gear tests, functional athletic wear reviews.',
      primary_niche: 'Fitness & Apparel',
      secondary_niches: JSON.stringify(['Outdoors', 'Trail Running', 'Endurance']),
      platforms: JSON.stringify(['instagram', 'youtube']),
      follower_count: 245000,
      engagement_rate: 4.5,
      rate_post: 550,
      rate_reel: 750,
      rate_video: 1250,
      rate_story: 300,
      audience_top_country: 'United States (60%)',
      audience_top_age: '24-42 (54%)',
      audience_gender_ratio: '50% Male / 50% Female',
      wallet_balance: 2200,
      escrow_pending: 0,
      completed_campaigns: 12
    }
  ];

  for (const c of creators) {
    execute(
      `INSERT INTO creators (
        id, name, handle, avatar_url, bio, primary_niche, secondary_niches,
        platforms, follower_count, engagement_rate, rate_post, rate_reel,
        rate_video, rate_story, audience_top_country, audience_top_age,
        audience_gender_ratio, wallet_balance, escrow_pending, completed_campaigns
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id, c.name, c.handle, c.avatar_url, c.bio, c.primary_niche, c.secondary_niches,
        c.platforms, c.follower_count, c.engagement_rate, c.rate_post, c.rate_reel,
        c.rate_video, c.rate_story, c.audience_top_country, c.audience_top_age,
        c.audience_gender_ratio, c.wallet_balance, c.escrow_pending, c.completed_campaigns
      ]
    );
  }

  // 4. Campaigns
  const campaigns = [
    {
      id: 'camp_techpulse_earbuds',
      brand_id: 'brand_techpulse',
      agency_id: 'agency_omni',
      title: 'TechPulse Wireless Earbuds Gen-3 Global Launch',
      brief: 'Introduce the new TechPulse Pro Wireless Noise-Cancelling Earbuds to audiophiles, tech enthusiasts, and daily commuters. Showcase active noise cancelling, 38-hour battery life, and spatial audio in real-world scenarios.',
      objectives: 'Drive brand consideration, generate 500,000+ targeted impressions, and achieve 4.0%+ engagement across tech communities.',
      target_niches: JSON.stringify(['Tech & Gadgets', 'Audio Gear', 'Productivity']),
      target_audience: 'Tech-savvy professionals, students, and commuters aged 20-38 looking for premium audio without $300 price tag.',
      content_guidelines: 'Highlight custom EQ app, demonstrate real-world mic clarity in public transit, include exclusive discount code TECHPULSE20 in caption/description, clear #ad disclosure in first 3 lines.',
      required_deliverables: JSON.stringify(['1x YouTube Dedicated Video or Segment', '1x Instagram Reel']),
      budget: 20000,
      spent: 3500,
      escrow_locked: 2600,
      status: 'ACTIVE',
      start_date: '2026-10-01',
      end_date: '2026-11-15'
    },
    {
      id: 'camp_glow_radiance',
      brand_id: 'brand_glow',
      agency_id: 'agency_omni',
      title: 'Glow Botanicals Autumn Radiance Rituals',
      brief: 'Highlight the 100% cold-pressed organic Sea Buckthorn face serum. Emphasize ethical sourcing, vegan certification, and lightweight absorption for dry winter skin transitions.',
      objectives: 'Establish credibility with clean beauty lovers and educate consumers on natural lipid barrier repair.',
      target_niches: JSON.stringify(['Beauty & Skincare', 'Wellness']),
      target_audience: 'Conscious consumers and skincare enthusiasts aged 22-45 seeking cruelty-free clean skincare.',
      content_guidelines: 'Demonstrate dropper application on bare skin, showcase morning glow with natural lighting, mention 30-day money-back guarantee, use #GlowBotanicals #CleanBeauty.',
      required_deliverables: JSON.stringify(['1x Instagram Reel with ASMR pipette sounds', '1x Story sequence']),
      budget: 12000,
      spent: 2400,
      escrow_locked: 1200,
      status: 'ACTIVE',
      start_date: '2026-10-10',
      end_date: '2026-11-20'
    },
    {
      id: 'camp_apex_training',
      brand_id: 'brand_apex',
      agency_id: 'agency_elevate',
      title: 'Apex Core-X High-Impact Training Gear',
      brief: 'Showcase high-durability sweat-wicking apparel and lightweight gym runners through real athletic workouts.',
      objectives: 'Show real athletic performance under intense stress; boost direct-to-consumer e-commerce checkout conversion.',
      target_niches: JSON.stringify(['Fitness & Apparel', 'Athletics']),
      target_audience: 'Runners, weightlifters, and fitness enthusiasts aged 18-35.',
      content_guidelines: 'Action shots doing sprints or lifts, show seam durability and flex, tag @apexathletics with promo code APEXFIT.',
      required_deliverables: JSON.stringify(['1x High-energy Reel', '1x YouTube workout segment']),
      budget: 25000,
      spent: 8200,
      escrow_locked: 800,
      status: 'ACTIVE',
      start_date: '2026-09-15',
      end_date: '2026-10-30'
    }
  ];

  for (const cmp of campaigns) {
    execute(
      `INSERT INTO campaigns (
        id, brand_id, agency_id, title, brief, objectives, target_niches,
        target_audience, content_guidelines, required_deliverables, budget,
        spent, escrow_locked, status, start_date, end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cmp.id, cmp.brand_id, cmp.agency_id, cmp.title, cmp.brief, cmp.objectives,
        cmp.target_niches, cmp.target_audience, cmp.content_guidelines,
        cmp.required_deliverables, cmp.budget, cmp.spent, cmp.escrow_locked,
        cmp.status, cmp.start_date, cmp.end_date
      ]
    );
  }

  // 5. Collaborations
  const collaborations = [
    {
      id: 'collab_marcus_techpulse',
      campaign_id: 'camp_techpulse_earbuds',
      creator_id: 'cr_marcus',
      proposed_rate: 1800,
      agreed_rate: 1800,
      status: 'DELIVERABLE_SUBMITTED',
      initiated_by: 'AGENT',
      agent_session_id: 'sess_agent_cmi_alpha',
      terms: '1x YouTube In-Depth Hardware Review + 1x Instagram Reel. 30-day link in bio. Code TECHPULSE20.',
      deadline: '2026-10-25'
    },
    {
      id: 'collab_elena_glow',
      campaign_id: 'camp_glow_radiance',
      creator_id: 'cr_elena',
      proposed_rate: 1200,
      agreed_rate: 1200,
      status: 'APPROVED',
      initiated_by: 'AGENT',
      agent_session_id: 'sess_agent_cmi_alpha',
      terms: '1x Instagram Reel + 3-frame Story series highlighting dropper application & glow results.',
      deadline: '2026-10-18'
    },
    {
      id: 'collab_david_apex',
      campaign_id: 'camp_apex_training',
      creator_id: 'cr_david',
      proposed_rate: 800,
      agreed_rate: 800,
      status: 'IN_PROGRESS',
      initiated_by: 'HUMAN',
      agent_session_id: null,
      terms: '1x HIIT training Reel wearing Apex Core-X compression shorts & tee.',
      deadline: '2026-10-28'
    },
    {
      id: 'collab_jax_techpulse',
      campaign_id: 'camp_techpulse_earbuds',
      creator_id: 'cr_jaxson',
      proposed_rate: 800,
      agreed_rate: 800,
      status: 'OFFERED',
      initiated_by: 'AGENT',
      agent_session_id: 'sess_agent_cmi_alpha',
      terms: '1x TikTok latency test with mobile FPS games showcasing zero-lag audio.',
      deadline: '2026-11-02'
    }
  ];

  for (const col of collaborations) {
    execute(
      `INSERT INTO collaborations (
        id, campaign_id, creator_id, proposed_rate, agreed_rate,
        status, initiated_by, agent_session_id, terms, deadline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        col.id, col.campaign_id, col.creator_id, col.proposed_rate, col.agreed_rate,
        col.status, col.initiated_by, col.agent_session_id, col.terms, col.deadline
      ]
    );
  }

  // 6. Deliverables
  const deliverables = [
    {
      id: 'deliv_marcus_yt',
      collaboration_id: 'collab_marcus_techpulse',
      deliverable_type: 'YOUTUBE_VIDEO',
      status: 'SUBMITTED',
      content_url: 'https://youtube.com/watch?v=sample_cmi_review_techpulse',
      caption: 'Can a $129 pair of earbuds beat the AirPods Pro 2? Testing TechPulse Pro ANC on the NYC Subway!',
      verification_notes: 'Audio test verified; ANC comparison segment at 04:15; affiliate link & sponsor disclaimer active.',
      metrics_json: JSON.stringify({ views: 48200, likes: 3200, comments: 284, engagement: '7.2%' }),
      submitted_at: '2026-10-18 14:30:00',
      approved_at: null
    },
    {
      id: 'deliv_elena_reel',
      collaboration_id: 'collab_elena_glow',
      deliverable_type: 'REEL',
      status: 'APPROVED',
      content_url: 'https://instagram.com/reel/sample_glow_radiance_ritual',
      caption: 'The only serum that restored my skin barrier after flight fatigue ✨ #GlowBotanicals #cleanbeauty #ad',
      verification_notes: 'Visual aesthetics verified; natural daylight lighting; #ad in first line of caption.',
      metrics_json: JSON.stringify({ views: 82000, likes: 6400, comments: 412, engagement: '8.3%' }),
      submitted_at: '2026-10-15 11:20:00',
      approved_at: '2026-10-16 09:15:00'
    }
  ];

  for (const d of deliverables) {
    execute(
      `INSERT INTO deliverables (
        id, collaboration_id, deliverable_type, status, content_url,
        caption, verification_notes, metrics_json, submitted_at, approved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.id, d.collaboration_id, d.deliverable_type, d.status, d.content_url,
        d.caption, d.verification_notes, d.metrics_json, d.submitted_at, d.approved_at
      ]
    );
  }

  // 7. Ledger Entries (Financial Ledger)
  const ledgerEntries = [
    {
      id: 'ledg_init_techpulse',
      campaign_id: 'camp_techpulse_earbuds',
      collaboration_id: null,
      actor_type: 'HUMAN',
      actor_id: 'user_brand_manager_1',
      entry_type: 'BUDGET_ALLOCATION',
      amount: 20000,
      balance_after: 20000,
      note: 'Initial campaign budget funded via corporate credit line.'
    },
    {
      id: 'ledg_escrow_marcus',
      campaign_id: 'camp_techpulse_earbuds',
      collaboration_id: 'collab_marcus_techpulse',
      actor_type: 'AGENT',
      actor_id: 'sess_agent_cmi_alpha',
      entry_type: 'ESCROW_HOLD',
      amount: 1800,
      balance_after: 18200,
      note: 'Escrow hold reserved for @marcus_tech offer dispatch.'
    },
    {
      id: 'ledg_escrow_jax',
      campaign_id: 'camp_techpulse_earbuds',
      collaboration_id: 'collab_jax_techpulse',
      actor_type: 'AGENT',
      actor_id: 'sess_agent_cmi_alpha',
      entry_type: 'ESCROW_HOLD',
      amount: 800,
      balance_after: 17400,
      note: 'Escrow hold reserved for @jax_gaming offer dispatch.'
    },
    {
      id: 'ledg_payout_past_collab',
      campaign_id: 'camp_techpulse_earbuds',
      collaboration_id: null,
      actor_type: 'HUMAN',
      actor_id: 'user_finance_exec',
      entry_type: 'PAYOUT_RELEASE',
      amount: 3500,
      balance_after: 13900,
      note: 'Completed milestone payouts for early creator seeding batch.'
    }
  ];

  for (const l of ledgerEntries) {
    execute(
      `INSERT INTO ledger_entries (
        id, campaign_id, collaboration_id, actor_type, actor_id,
        entry_type, amount, balance_after, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        l.id, l.campaign_id, l.collaboration_id, l.actor_type, l.actor_id,
        l.entry_type, l.amount, l.balance_after, l.note
      ]
    );
  }

  // 8. Agent Sessions
  const agentSessions = [
    {
      id: 'sess_agent_cmi_alpha',
      name: 'Omni-Agent CMI Alpha (Full Campaign Manager)',
      campaign_id: 'camp_techpulse_earbuds',
      role_scope: 'CAMPAIGN_MANAGER',
      allowed_tools: JSON.stringify([
        'search_creators',
        'draft_campaign_brief',
        'send_collaboration_offer',
        'track_deliverable',
        'release_payment',
        'get_campaign_status',
        'list_audit_logs',
        'request_human_approval'
      ]),
      budget_ceiling: 15000,
      rate_ceiling: 2000,
      spent_amount: 2600,
      status: 'ACTIVE'
    },
    {
      id: 'sess_agent_discovery_scout',
      name: 'Scout Agent Beta (Discovery & Brief Scoper)',
      campaign_id: 'camp_glow_radiance',
      role_scope: 'DISCOVERY_ONLY',
      allowed_tools: JSON.stringify([
        'search_creators',
        'draft_campaign_brief',
        'get_campaign_status'
      ]),
      budget_ceiling: 5000,
      rate_ceiling: 1000,
      spent_amount: 0,
      status: 'ACTIVE'
    }
  ];

  for (const s of agentSessions) {
    execute(
      `INSERT INTO agent_sessions (
        id, name, campaign_id, role_scope, allowed_tools,
        budget_ceiling, rate_ceiling, spent_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id, s.name, s.campaign_id, s.role_scope, s.allowed_tools,
        s.budget_ceiling, s.rate_ceiling, s.spent_amount, s.status
      ]
    );
  }

  // 9. Human-Approval Checkpoints (Section 9 of paper: High-impact actions held for human approval)
  const checkpoints = [
    {
      id: 'chk_payout_marcus',
      agent_session_id: 'sess_agent_cmi_alpha',
      campaign_id: 'camp_techpulse_earbuds',
      action_type: 'PAYMENT_ABOVE_THRESHOLD',
      status: 'PENDING',
      amount: 1800,
      tool_name: 'release_payment',
      payload_json: JSON.stringify({
        collaboration_id: 'collab_marcus_techpulse',
        deliverable_id: 'deliv_marcus_yt',
        amount: 1800,
        creator_handle: 'marcus_tech',
        deliverable_type: 'YOUTUBE_VIDEO'
      }),
      justification: 'Automated verification confirms YouTube video meets all brief constraints (38-hr battery test included, 48k views in 48h). Payout of $1,800 exceeds the $1,000 autonomous release ceiling and requires human sign-off.',
      reviewer_notes: null,
      resolved_by: null
    },
    {
      id: 'chk_rate_maya',
      agent_session_id: 'sess_agent_cmi_alpha',
      campaign_id: 'camp_techpulse_earbuds',
      action_type: 'OUT_OF_BAND_RATE',
      status: 'PENDING',
      amount: 2200,
      tool_name: 'send_collaboration_offer',
      payload_json: JSON.stringify({
        campaign_id: 'camp_techpulse_earbuds',
        creator_id: 'cr_maya',
        proposed_rate: 2200,
        creator_handle: 'mayalifestyle',
        deliverables: ['1x YouTube travel vlog segment', '1x Instagram Reel']
      }),
      justification: 'Proposed rate ($2,200) exceeds agent pre-approved rate ceiling ($2,000). Maya Lin has 530k followers and 3.9% engagement; high fit for commuter segment.',
      reviewer_notes: null,
      resolved_by: null
    }
  ];

  for (const chk of checkpoints) {
    execute(
      `INSERT INTO approval_checkpoints (
        id, agent_session_id, campaign_id, action_type, status,
        amount, tool_name, payload_json, justification, reviewer_notes, resolved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        chk.id, chk.agent_session_id, chk.campaign_id, chk.action_type, chk.status,
        chk.amount, chk.tool_name, chk.payload_json, chk.justification, chk.reviewer_notes, chk.resolved_by
      ]
    );
  }

  // 10. Immutable Audit Logs
  const auditLogs = [
    {
      id: 'aud_001',
      actor_type: 'AGENT',
      actor_id: 'sess_agent_cmi_alpha',
      session_id: 'sess_agent_cmi_alpha',
      campaign_id: 'camp_techpulse_earbuds',
      tool_name: 'search_creators',
      parameters_json: JSON.stringify({ niche: 'Tech & Gadgets', min_followers: 100000, min_engagement: 3.5 }),
      execution_status: 'SUCCESS',
      result_summary: 'Discovered 3 creators: @marcus_tech (420k), @jax_gaming (340k), @liam_ai_future (195k).',
      guardrail_notes: 'Permission granted for discovery scope.',
      duration_ms: 124
    },
    {
      id: 'aud_002',
      actor_type: 'AGENT',
      actor_id: 'sess_agent_cmi_alpha',
      session_id: 'sess_agent_cmi_alpha',
      campaign_id: 'camp_techpulse_earbuds',
      tool_name: 'send_collaboration_offer',
      parameters_json: JSON.stringify({ creator_id: 'cr_marcus', proposed_rate: 1800, deliverables: ['1x YouTube Video'] }),
      execution_status: 'SUCCESS',
      result_summary: 'Collaboration offer created and $1,800 locked in escrow.',
      guardrail_notes: 'Rate ($1,800) within agent ceiling ($2,000). Total spend within session budget ($15,000).',
      duration_ms: 215
    },
    {
      id: 'aud_003',
      actor_type: 'AGENT',
      actor_id: 'sess_agent_cmi_alpha',
      session_id: 'sess_agent_cmi_alpha',
      campaign_id: 'camp_techpulse_earbuds',
      tool_name: 'track_deliverable',
      parameters_json: JSON.stringify({ collaboration_id: 'collab_marcus_techpulse', deliverable_id: 'deliv_marcus_yt', content_url: 'https://youtube.com/watch?v=sample_cmi_review_techpulse' }),
      execution_status: 'SUCCESS',
      result_summary: 'Deliverable verified. Video live with 48.2k views, valid #ad disclosures, and custom link.',
      guardrail_notes: 'Content compliance checks passed.',
      duration_ms: 310
    },
    {
      id: 'aud_004',
      actor_type: 'AGENT',
      actor_id: 'sess_agent_cmi_alpha',
      session_id: 'sess_agent_cmi_alpha',
      campaign_id: 'camp_techpulse_earbuds',
      tool_name: 'release_payment',
      parameters_json: JSON.stringify({ collaboration_id: 'collab_marcus_techpulse', deliverable_id: 'deliv_marcus_yt', amount: 1800 }),
      execution_status: 'HELD_FOR_APPROVAL',
      result_summary: 'Checkpoint created: chk_payout_marcus. Payment held awaiting brand human manager sign-off.',
      guardrail_notes: 'HIGH_VALUE_PAYMENT rule triggered: Amount $1,800 > autonomous threshold ($1,000).',
      duration_ms: 180
    }
  ];

  for (const a of auditLogs) {
    execute(
      `INSERT INTO audit_logs (
        id, actor_type, actor_id, session_id, campaign_id,
        tool_name, parameters_json, execution_status, result_summary,
        guardrail_notes, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        a.id, a.actor_type, a.actor_id, a.session_id, a.campaign_id,
        a.tool_name, a.parameters_json, a.execution_status, a.result_summary,
        a.guardrail_notes, a.duration_ms
      ]
    );
  }

  // 11. Evaluation Benchmarks (Section 10 of research paper)
  const benchmarks = [
    {
      id: 'bench_run_01_manual',
      scenario_name: 'Tech Launch: Standard Rate Discovery & Offer Dispatch',
      workflow_type: 'MANUAL',
      time_to_launch_sec: 172800, // 48 hours
      operational_cost_minutes: 390, // 6.5 hours of human labour
      creator_matching_accuracy_pct: 84.5,
      creators_evaluated: 24,
      offers_sent: 5,
      approvals_required: 5,
      notes: 'Manual workflow conducted by junior agency media planner using spreadsheets, DMs, and manual emails.'
    },
    {
      id: 'bench_run_01_agentic',
      scenario_name: 'Tech Launch: Standard Rate Discovery & Offer Dispatch',
      workflow_type: 'AGENTIC',
      time_to_launch_sec: 144, // 2.4 minutes
      operational_cost_minutes: 18, // 18 minutes human checkpoint review
      creator_matching_accuracy_pct: 91.8,
      creators_evaluated: 24,
      offers_sent: 5,
      approvals_required: 2,
      notes: 'Autonomous CMI Agent execution with scoped budget ceiling ($15k) and human checkpoint on payments > $1k.'
    },
    {
      id: 'bench_run_02_manual',
      scenario_name: 'Clean Skincare Fall Campaign Creator Sourcing',
      workflow_type: 'MANUAL',
      time_to_launch_sec: 86400, // 24 hours
      operational_cost_minutes: 240, // 4.0 hours human labor
      creator_matching_accuracy_pct: 88.0,
      creators_evaluated: 18,
      offers_sent: 4,
      approvals_required: 4,
      notes: 'Brand manager manually evaluated profiles on Instagram and TikTok search tabs.'
    },
    {
      id: 'bench_run_02_agentic',
      scenario_name: 'Clean Skincare Fall Campaign Creator Sourcing',
      workflow_type: 'AGENTIC',
      time_to_launch_sec: 96, // 1.6 minutes
      operational_cost_minutes: 12, // 12 minutes human review
      creator_matching_accuracy_pct: 94.4,
      creators_evaluated: 18,
      offers_sent: 4,
      approvals_required: 1,
      notes: 'Agentic parallel creator filtering and automated brief attachment via MCP search_creators and draft_campaign_brief.'
    }
  ];

  for (const b of benchmarks) {
    execute(
      `INSERT INTO evaluation_benchmarks (
        id, scenario_name, workflow_type, time_to_launch_sec,
        operational_cost_minutes, creator_matching_accuracy_pct,
        creators_evaluated, offers_sent, approvals_required, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id, b.scenario_name, b.workflow_type, b.time_to_launch_sec,
        b.operational_cost_minutes, b.creator_matching_accuracy_pct,
        b.creators_evaluated, b.offers_sent, b.approvals_required, b.notes
      ]
    );
  }

  console.log('✅ CMI Database seeded successfully with brands, creators, campaigns, checkpoints, audit logs, and benchmarks.');
}

// Run directly if called as a script
if (require.main === module) {
  runSeed();
}
