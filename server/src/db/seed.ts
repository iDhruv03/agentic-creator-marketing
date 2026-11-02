/**
 * Seed the shared data layer with a realistic, paper-aligned dataset.
 *
 * Everything that moves money or state goes through the Infrastructure
 * Core (createCampaign, sendOffer, acceptOffer, submitDeliverable, …) so the
 * double-entry ledger, notifications and audit chain are internally
 * consistent from the first boot.
 */
import { db, execute, queryOne, queryAll, initDatabase } from './database';
import { createUser } from '../auth/auth';
import { createCampaign, addToShortlist, reviewShortlist } from '../core/campaigns';
import { sendOffer, acceptOffer, counterOffer, declineOffer, submitDeliverable, reviewDeliverable, postMessage, startWork } from '../core/collaborations';
import { releasePayment } from '../core/payments';
import { createSession, createCheckpoint, requireSession } from '../core/governance';
import { appendAudit, type AuditInput } from '../core/audit';
import { createRun, appendRunEvent, updateRun } from '../agent/runs';
import { execute as run } from './database';

const daysAgo = (d: number, h = 10) => new Date(Date.now() - d * 86400000 - (24 - h) * 3600000).toISOString();

function avatar(seed: string): string {
  return `https://i.pravatar.cc/160?u=${encodeURIComponent(seed)}`;
}

function clearAll() {
  const tables = ['evaluation_runs', 'notifications', 'agent_run_events', 'agent_runs', 'approval_checkpoints', 'agent_sessions', 'ledger_entries', 'negotiation_messages', 'deliverables', 'collaborations', 'campaign_shortlist', 'campaigns', 'agency_brands', 'creators', 'agencies', 'brands', 'users'];
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const t of tables) execute(`DELETE FROM ${t};`);
  // audit_logs is append-only; drop and recreate for a clean seed.
  db.exec("DROP TRIGGER IF EXISTS audit_logs_no_update; DROP TRIGGER IF EXISTS audit_logs_no_delete; DELETE FROM audit_logs; DELETE FROM sqlite_sequence WHERE name = 'audit_logs';");
  initDatabase();
  db.exec('PRAGMA foreign_keys = ON;');
}

function backdate(table: string, id: string, iso: string, cols: string[] = ['created_at']) {
  for (const c of cols) run(`UPDATE ${table} SET ${c} = ? WHERE id = ?`, [iso, id]);
}

export function runSeed(opts: { quiet?: boolean } = {}): void {
  const log = (m: string) => { if (!opts.quiet) console.log(m); };
  log('Seeding CMI shared data layer…');
  clearAll();

  // ---------------------------------------------------------------- brands & agencies
  const brands = [
    { id: 'brand_techpulse', name: 'TechPulse Audio', industry: 'Consumer Electronics', website: 'techpulse.audio', description: 'Premium wireless audio for commuters and creators.', total_budget: 120000 },
    { id: 'brand_glow', name: 'Glow Botanicals', industry: 'Beauty & Skincare', website: 'glowbotanicals.com', description: 'Clean, dermatologist-formulated skincare.', total_budget: 80000 },
    { id: 'brand_apex', name: 'Apex Athletics', industry: 'Fitness & Apparel', website: 'apexathletics.co', description: 'Performance apparel and training programs.', total_budget: 150000 },
    { id: 'brand_nomad', name: 'Nomad Kitchen', industry: 'Food & Beverage', website: 'nomadkitchen.co', description: 'Globally inspired meal kits delivered weekly.', total_budget: 60000 },
  ];
  for (const b of brands) execute(`INSERT INTO brands (id, name, industry, website, description, total_budget, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [b.id, b.name, b.industry, b.website, b.description, b.total_budget, daysAgo(120)]);

  execute(`INSERT INTO agencies (id, name, contact_email, description, created_at) VALUES ('agency_omni', 'OmniMedia Creator Agency', 'partnerships@omnimedia.co', 'Full-service creator agency for consumer brands.', ?)`, [daysAgo(110)]);
  execute(`INSERT INTO agencies (id, name, contact_email, description, created_at) VALUES ('agency_elevate', 'Elevate Marketing Group', 'ops@elevate.io', 'Performance-led influencer marketing.', ?)`, [daysAgo(100)]);
  execute(`INSERT INTO agency_brands (agency_id, brand_id) VALUES ('agency_omni', 'brand_techpulse'), ('agency_omni', 'brand_glow'), ('agency_omni', 'brand_nomad'), ('agency_elevate', 'brand_apex')`);

  // ---------------------------------------------------------------- creators
  type C = { id: string; name: string; handle: string; bio: string; location: string; niche: string; secondary: string[]; platforms: string[]; stats: any[]; audience: any; portfolio: any[]; tags: string[]; followers: number; er: number; views: number; rates: [number, number, number, number]; rating: number; done: number; resp: number; available?: boolean };
  const creators: C[] = [
    { id: 'cr_marcus', name: 'Marcus Vance', handle: 'marcus_tech', bio: 'Deep-dive tech reviews, acoustics and gadget teardowns. 7 years reviewing hardware; I say what the spec sheet won\'t.', location: 'Austin, TX', niche: 'Tech & Gadgets', secondary: ['Audio Gear', 'Consumer Electronics', 'Productivity'], platforms: ['youtube', 'instagram'], stats: [{ platform: 'youtube', handle: 'MarcusVanceTech', followers: 420000, engagement_rate: 4.8, avg_views: 118000 }, { platform: 'instagram', handle: 'marcus_tech', followers: 96000, engagement_rate: 3.9, avg_views: 31000 }], audience: { countries: [{ name: 'United States', pct: 48 }, { name: 'United Kingdom', pct: 14 }, { name: 'Canada', pct: 9 }, { name: 'Germany', pct: 6 }], ages: [{ range: '18-24', pct: 22 }, { range: '25-34', pct: 46 }, { range: '35-44', pct: 22 }, { range: '45+', pct: 10 }], gender: { female: 31, male: 67, other: 2 } }, portfolio: [{ title: 'Best ANC earbuds of the year', platform: 'youtube', url: 'https://youtube.com/watch?v=mv-anc', views: 412000, brand: 'Sonos' }, { title: 'Studio monitor shootout', platform: 'youtube', url: 'https://youtube.com/watch?v=mv-monitors', views: 188000 }, { title: 'Desk setup tour 2026', platform: 'instagram', url: 'https://instagram.com/reel/mv-desk', views: 74000, brand: 'Logitech' }], tags: ['long-form', 'technical', 'teardown', 'studio-quality'], followers: 420000, er: 4.8, views: 118000, rates: [750, 950, 1800, 400], rating: 4.9, done: 14, resp: 6 },
    { id: 'cr_priya', name: 'Priya Natarajan', handle: 'priya.codes', bio: 'Software engineer turned creator. Honest reviews of gear that actually helps you work — laptops, audio, ergonomics.', location: 'Toronto, CA', niche: 'Tech & Gadgets', secondary: ['Productivity', 'Audio Gear', 'Education'], platforms: ['youtube', 'tiktok', 'instagram'], stats: [{ platform: 'youtube', handle: 'PriyaCodes', followers: 265000, engagement_rate: 5.6, avg_views: 92000 }, { platform: 'tiktok', handle: 'priya.codes', followers: 310000, engagement_rate: 7.1, avg_views: 140000 }, { platform: 'instagram', handle: 'priya.codes', followers: 58000, engagement_rate: 4.2, avg_views: 19000 }], audience: { countries: [{ name: 'United States', pct: 41 }, { name: 'India', pct: 18 }, { name: 'Canada', pct: 12 }, { name: 'United Kingdom', pct: 8 }], ages: [{ range: '18-24', pct: 38 }, { range: '25-34', pct: 44 }, { range: '35-44', pct: 13 }, { range: '45+', pct: 5 }], gender: { female: 44, male: 54, other: 2 } }, portfolio: [{ title: 'I tried 6 noise-cancelling earbuds while coding', platform: 'youtube', url: 'https://youtube.com/watch?v=pc-earbuds', views: 221000 }, { title: 'Ergonomic desk in 60 seconds', platform: 'tiktok', url: 'https://tiktok.com/@priya.codes/video/1', views: 890000, brand: 'Autonomous' }], tags: ['short-form', 'educational', 'relatable', 'high-energy'], followers: 265000, er: 5.6, views: 92000, rates: [550, 800, 1400, 300], rating: 4.8, done: 9, resp: 4 },
    { id: 'cr_liam', name: 'Liam Okafor', handle: 'liamgear', bio: 'Everyday-carry and commuter tech. Short, punchy reviews for people who just want to know if it\'s worth it.', location: 'London, UK', niche: 'Tech & Gadgets', secondary: ['Lifestyle & Travel', 'Audio Gear'], platforms: ['youtube', 'instagram'], stats: [{ platform: 'youtube', handle: 'LiamGear', followers: 140000, engagement_rate: 4.1, avg_views: 44000 }, { platform: 'instagram', handle: 'liamgear', followers: 72000, engagement_rate: 3.6, avg_views: 22000 }], audience: { countries: [{ name: 'United Kingdom', pct: 46 }, { name: 'United States', pct: 24 }, { name: 'Australia', pct: 8 }, { name: 'Ireland', pct: 5 }], ages: [{ range: '18-24', pct: 27 }, { range: '25-34', pct: 48 }, { range: '35-44', pct: 18 }, { range: '45+', pct: 7 }], gender: { female: 29, male: 69, other: 2 } }, portfolio: [{ title: 'Commuter earbuds under £150', platform: 'youtube', url: 'https://youtube.com/watch?v=lg-commute', views: 96000 }, { title: 'What\'s in my bag — spring edit', platform: 'instagram', url: 'https://instagram.com/reel/lg-bag', views: 41000, brand: 'Bellroy' }], tags: ['short-form', 'commuter', 'value'], followers: 140000, er: 4.1, views: 44000, rates: [380, 520, 950, 200], rating: 4.7, done: 11, resp: 9 },
    { id: 'cr_sofia', name: 'Sofia Reyes', handle: 'sofiasetup', bio: 'Creator-economy tools, cameras and streaming gear for people building a channel from scratch.', location: 'Mexico City, MX', niche: 'Tech & Gadgets', secondary: ['Education', 'Gaming'], platforms: ['youtube', 'tiktok'], stats: [{ platform: 'youtube', handle: 'SofiaSetup', followers: 88000, engagement_rate: 6.4, avg_views: 39000 }, { platform: 'tiktok', handle: 'sofiasetup', followers: 150000, engagement_rate: 8.2, avg_views: 95000 }], audience: { countries: [{ name: 'Mexico', pct: 34 }, { name: 'United States', pct: 31 }, { name: 'Spain', pct: 9 }, { name: 'Colombia', pct: 7 }], ages: [{ range: '18-24', pct: 41 }, { range: '25-34', pct: 40 }, { range: '35-44', pct: 14 }, { range: '45+', pct: 5 }], gender: { female: 52, male: 46, other: 2 } }, portfolio: [{ title: 'Budget streaming setup that doesn\'t look budget', platform: 'youtube', url: 'https://youtube.com/watch?v=ss-stream', views: 132000, brand: 'Elgato' }], tags: ['bilingual', 'tutorial', 'short-form'], followers: 150000, er: 6.4, views: 39000, rates: [300, 450, 800, 180], rating: 4.6, done: 6, resp: 5 },
    { id: 'cr_elena', name: 'Elena Rostova', handle: 'elena_beauty', bio: 'Clean beauty advocate and dermatology student. Routines backed by ingredients, not hype.', location: 'New York, NY', niche: 'Beauty & Skincare', secondary: ['Wellness', 'Organic Living', 'Self Care'], platforms: ['instagram', 'tiktok'], stats: [{ platform: 'instagram', handle: 'elena_beauty', followers: 285000, engagement_rate: 5.4, avg_views: 88000 }, { platform: 'tiktok', handle: 'elena_beauty', followers: 410000, engagement_rate: 8.9, avg_views: 260000 }], audience: { countries: [{ name: 'United States', pct: 55 }, { name: 'United Kingdom', pct: 11 }, { name: 'Canada', pct: 8 }, { name: 'Australia', pct: 6 }], ages: [{ range: '18-24', pct: 45 }, { range: '25-34', pct: 36 }, { range: '35-44', pct: 14 }, { range: '45+', pct: 5 }], gender: { female: 78, male: 20, other: 2 } }, portfolio: [{ title: 'Barrier repair routine (derm-approved)', platform: 'tiktok', url: 'https://tiktok.com/@elena_beauty/video/2', views: 1200000, brand: 'CeraVe' }, { title: 'SPF myths, debunked', platform: 'instagram', url: 'https://instagram.com/reel/eb-spf', views: 210000 }], tags: ['educational', 'ingredient-led', 'aesthetic', 'short-form'], followers: 410000, er: 5.4, views: 88000, rates: [500, 700, 1200, 300], rating: 4.9, done: 18, resp: 8 },
    { id: 'cr_amara', name: 'Amara Diallo', handle: 'amaraglow', bio: 'Skincare for melanin-rich skin. Honest, slow-paced reviews and 30-day tests.', location: 'Atlanta, GA', niche: 'Beauty & Skincare', secondary: ['Wellness', 'Lifestyle & Travel'], platforms: ['instagram', 'youtube', 'tiktok'], stats: [{ platform: 'instagram', handle: 'amaraglow', followers: 132000, engagement_rate: 6.7, avg_views: 51000 }, { platform: 'youtube', handle: 'AmaraGlow', followers: 94000, engagement_rate: 5.2, avg_views: 38000 }, { platform: 'tiktok', handle: 'amaraglow', followers: 205000, engagement_rate: 9.1, avg_views: 150000 }], audience: { countries: [{ name: 'United States', pct: 62 }, { name: 'United Kingdom', pct: 9 }, { name: 'Nigeria', pct: 7 }, { name: 'Canada', pct: 5 }], ages: [{ range: '18-24', pct: 36 }, { range: '25-34', pct: 42 }, { range: '35-44', pct: 16 }, { range: '45+', pct: 6 }], gender: { female: 84, male: 14, other: 2 } }, portfolio: [{ title: '30 days with a vitamin C serum', platform: 'youtube', url: 'https://youtube.com/watch?v=ag-vitc', views: 76000, brand: 'Glow Botanicals' }], tags: ['30-day-test', 'inclusive', 'calm'], followers: 205000, er: 6.7, views: 51000, rates: [420, 600, 1000, 250], rating: 4.8, done: 12, resp: 12 },
    { id: 'cr_hana', name: 'Hana Kim', handle: 'hanaskin', bio: 'K-beauty routines and minimalist skincare. Glass-skin content that converts.', location: 'Seoul, KR', niche: 'Beauty & Skincare', secondary: ['Fashion', 'Lifestyle & Travel'], platforms: ['tiktok', 'instagram'], stats: [{ platform: 'tiktok', handle: 'hanaskin', followers: 680000, engagement_rate: 7.8, avg_views: 420000 }, { platform: 'instagram', handle: 'hanaskin', followers: 210000, engagement_rate: 4.4, avg_views: 70000 }], audience: { countries: [{ name: 'United States', pct: 38 }, { name: 'South Korea', pct: 17 }, { name: 'Philippines', pct: 9 }, { name: 'United Kingdom', pct: 7 }], ages: [{ range: '18-24', pct: 52 }, { range: '25-34', pct: 33 }, { range: '35-44', pct: 11 }, { range: '45+', pct: 4 }], gender: { female: 81, male: 17, other: 2 } }, portfolio: [{ title: '7-skin method, explained', platform: 'tiktok', url: 'https://tiktok.com/@hanaskin/video/3', views: 2400000, brand: 'Laneige' }], tags: ['aesthetic', 'trend-led', 'short-form'], followers: 680000, er: 7.8, views: 420000, rates: [900, 1300, 2200, 500], rating: 4.7, done: 21, resp: 18 },
    { id: 'cr_david', name: 'David Chen', handle: 'dchen_fitness', bio: 'Hybrid athlete and coach. Marathons, HIIT and science-backed nutrition without the bro-science.', location: 'Vancouver, CA', niche: 'Fitness & Apparel', secondary: ['Athletics', 'Nutrition', 'Health'], platforms: ['instagram', 'youtube', 'tiktok'], stats: [{ platform: 'instagram', handle: 'dchen_fitness', followers: 165000, engagement_rate: 6.2, avg_views: 58000 }, { platform: 'youtube', handle: 'DavidChenFit', followers: 120000, engagement_rate: 4.9, avg_views: 41000 }, { platform: 'tiktok', handle: 'dchen_fitness', followers: 240000, engagement_rate: 8.4, avg_views: 170000 }], audience: { countries: [{ name: 'Canada', pct: 32 }, { name: 'United States', pct: 30 }, { name: 'United Kingdom', pct: 10 }, { name: 'Australia', pct: 8 }], ages: [{ range: '18-24', pct: 29 }, { range: '25-34', pct: 46 }, { range: '35-44', pct: 19 }, { range: '45+', pct: 6 }], gender: { female: 45, male: 53, other: 2 } }, portfolio: [{ title: 'Sub-3 marathon training block', platform: 'youtube', url: 'https://youtube.com/watch?v=dc-sub3', views: 98000 }, { title: '12-minute hotel HIIT', platform: 'tiktok', url: 'https://tiktok.com/@dchen_fitness/video/4', views: 640000, brand: 'Nike' }], tags: ['coaching', 'science-backed', 'high-energy'], followers: 240000, er: 6.2, views: 58000, rates: [400, 550, 900, 250], rating: 4.9, done: 9, resp: 5 },
    { id: 'cr_zara', name: 'Zara Hussain', handle: 'zaralifts', bio: 'Powerlifter and physio. Strength programs for women who want to lift heavy and move well.', location: 'Manchester, UK', niche: 'Fitness & Apparel', secondary: ['Health', 'Education'], platforms: ['instagram', 'youtube'], stats: [{ platform: 'instagram', handle: 'zaralifts', followers: 198000, engagement_rate: 5.1, avg_views: 62000 }, { platform: 'youtube', handle: 'ZaraLifts', followers: 76000, engagement_rate: 4.3, avg_views: 28000 }], audience: { countries: [{ name: 'United Kingdom', pct: 44 }, { name: 'United States', pct: 27 }, { name: 'Australia', pct: 8 }, { name: 'Ireland', pct: 5 }], ages: [{ range: '18-24', pct: 24 }, { range: '25-34', pct: 49 }, { range: '35-44', pct: 20 }, { range: '45+', pct: 7 }], gender: { female: 72, male: 26, other: 2 } }, portfolio: [{ title: 'Deadlift form fixes every lifter needs', platform: 'youtube', url: 'https://youtube.com/watch?v=zl-dl', views: 54000 }], tags: ['technical', 'coaching', 'women-in-sport'], followers: 198000, er: 5.1, views: 62000, rates: [450, 600, 1100, 260], rating: 4.8, done: 7, resp: 10 },
    { id: 'cr_jaxson', name: 'Jaxson Miller', handle: 'jax_gaming', bio: 'Competitive FPS, peripherals and PC builds. Daily streams, weekly deep dives.', location: 'Denver, CO', niche: 'Gaming', secondary: ['Tech & Gadgets', 'Audio Gear'], platforms: ['youtube', 'tiktok'], stats: [{ platform: 'youtube', handle: 'JaxGaming', followers: 890000, engagement_rate: 3.2, avg_views: 210000 }, { platform: 'tiktok', handle: 'jax_gaming', followers: 520000, engagement_rate: 6.3, avg_views: 300000 }], audience: { countries: [{ name: 'United States', pct: 52 }, { name: 'United Kingdom', pct: 10 }, { name: 'Canada', pct: 8 }, { name: 'Brazil', pct: 6 }], ages: [{ range: '18-24', pct: 49 }, { range: '25-34', pct: 37 }, { range: '35-44', pct: 10 }, { range: '45+', pct: 4 }], gender: { female: 18, male: 80, other: 2 } }, portfolio: [{ title: 'Best gaming headsets 2026', platform: 'youtube', url: 'https://youtube.com/watch?v=jx-headsets', views: 530000, brand: 'SteelSeries' }], tags: ['live', 'competitive', 'high-volume'], followers: 890000, er: 3.2, views: 210000, rates: [1400, 1900, 3200, 700], rating: 4.5, done: 26, resp: 24 },
    { id: 'cr_maya', name: 'Maya Lin', handle: 'mayalifestyle', bio: 'Slow living, sustainable fashion and interiors. Travel vlogs across Europe and Asia.', location: 'Lisbon, PT', niche: 'Lifestyle & Travel', secondary: ['Home & Interior', 'Fashion', 'Photography'], platforms: ['instagram', 'youtube'], stats: [{ platform: 'instagram', handle: 'mayalifestyle', followers: 530000, engagement_rate: 3.9, avg_views: 140000 }, { platform: 'youtube', handle: 'MayaLin', followers: 210000, engagement_rate: 3.4, avg_views: 66000 }], audience: { countries: [{ name: 'United Kingdom', pct: 38 }, { name: 'United States', pct: 22 }, { name: 'Germany', pct: 9 }, { name: 'France', pct: 7 }], ages: [{ range: '18-24', pct: 19 }, { range: '25-34', pct: 48 }, { range: '35-44', pct: 24 }, { range: '45+', pct: 9 }], gender: { female: 65, male: 33, other: 2 } }, portfolio: [{ title: 'A slow week in the Azores', platform: 'youtube', url: 'https://youtube.com/watch?v=ml-azores', views: 180000, brand: 'Away' }], tags: ['cinematic', 'aesthetic', 'long-form'], followers: 530000, er: 3.9, views: 140000, rates: [900, 1200, 2200, 500], rating: 4.8, done: 22, resp: 20 },
    { id: 'cr_tomas', name: 'Tomás Herrera', handle: 'tomascooks', bio: 'Weeknight cooking with big flavour. Former line cook, now feeding 2 million people a week.', location: 'Chicago, IL', niche: 'Food & Cooking', secondary: ['Lifestyle & Travel', 'Parenting & Family'], platforms: ['tiktok', 'instagram', 'youtube'], stats: [{ platform: 'tiktok', handle: 'tomascooks', followers: 1100000, engagement_rate: 7.4, avg_views: 780000 }, { platform: 'instagram', handle: 'tomascooks', followers: 340000, engagement_rate: 4.6, avg_views: 120000 }, { platform: 'youtube', handle: 'TomasCooks', followers: 160000, engagement_rate: 4.1, avg_views: 58000 }], audience: { countries: [{ name: 'United States', pct: 58 }, { name: 'Mexico', pct: 11 }, { name: 'Canada', pct: 8 }, { name: 'United Kingdom', pct: 6 }], ages: [{ range: '18-24', pct: 26 }, { range: '25-34', pct: 41 }, { range: '35-44', pct: 22 }, { range: '45+', pct: 11 }], gender: { female: 58, male: 40, other: 2 } }, portfolio: [{ title: '15-minute birria tacos', platform: 'tiktok', url: 'https://tiktok.com/@tomascooks/video/5', views: 4100000 }, { title: 'Meal-prep for the week in 1 hour', platform: 'youtube', url: 'https://youtube.com/watch?v=tc-prep', views: 240000, brand: 'HelloFresh' }], tags: ['short-form', 'high-volume', 'family'], followers: 1100000, er: 7.4, views: 780000, rates: [1200, 1700, 2800, 600], rating: 4.9, done: 31, resp: 14 },
    { id: 'cr_nia', name: 'Nia Thompson', handle: 'niaeats', bio: 'Plant-forward recipes and honest meal-kit reviews. Budget-friendly, never boring.', location: 'Portland, OR', niche: 'Food & Cooking', secondary: ['Wellness', 'Finance & Investing'], platforms: ['instagram', 'youtube'], stats: [{ platform: 'instagram', handle: 'niaeats', followers: 118000, engagement_rate: 5.9, avg_views: 44000 }, { platform: 'youtube', handle: 'NiaEats', followers: 64000, engagement_rate: 4.7, avg_views: 24000 }], audience: { countries: [{ name: 'United States', pct: 64 }, { name: 'Canada', pct: 12 }, { name: 'United Kingdom', pct: 8 }, { name: 'Australia', pct: 5 }], ages: [{ range: '18-24', pct: 23 }, { range: '25-34', pct: 47 }, { range: '35-44', pct: 21 }, { range: '45+', pct: 9 }], gender: { female: 71, male: 27, other: 2 } }, portfolio: [{ title: 'I ranked 5 meal kits by cost per serving', platform: 'youtube', url: 'https://youtube.com/watch?v=ne-kits', views: 61000 }], tags: ['budget', 'plant-forward', 'review'], followers: 118000, er: 5.9, views: 44000, rates: [350, 480, 850, 200], rating: 4.7, done: 8, resp: 7 },
    { id: 'cr_oliver', name: 'Oliver Brandt', handle: 'oliver.money', bio: 'Personal finance for people in their 20s. No get-rich-quick, just boring maths that works.', location: 'Berlin, DE', niche: 'Finance & Investing', secondary: ['Education', 'Tech & Gadgets'], platforms: ['youtube', 'instagram'], stats: [{ platform: 'youtube', handle: 'OliverMoney', followers: 310000, engagement_rate: 4.4, avg_views: 95000 }, { platform: 'instagram', handle: 'oliver.money', followers: 84000, engagement_rate: 3.8, avg_views: 26000 }], audience: { countries: [{ name: 'Germany', pct: 36 }, { name: 'United States', pct: 24 }, { name: 'United Kingdom', pct: 13 }, { name: 'Netherlands', pct: 6 }], ages: [{ range: '18-24', pct: 31 }, { range: '25-34', pct: 51 }, { range: '35-44', pct: 13 }, { range: '45+', pct: 5 }], gender: { female: 39, male: 59, other: 2 } }, portfolio: [{ title: 'The 3-fund portfolio, explained', platform: 'youtube', url: 'https://youtube.com/watch?v=om-3fund', views: 410000 }], tags: ['educational', 'long-form', 'trust'], followers: 310000, er: 4.4, views: 95000, rates: [700, 900, 1700, 350], rating: 4.8, done: 10, resp: 16 },
    { id: 'cr_grace', name: 'Grace Whitfield', handle: 'graceathome', bio: 'Small-space interiors and renter-friendly makeovers. Before/afters that are actually achievable.', location: 'Brooklyn, NY', niche: 'Home & Interior', secondary: ['Lifestyle & Travel', 'Fashion'], platforms: ['instagram', 'tiktok'], stats: [{ platform: 'instagram', handle: 'graceathome', followers: 245000, engagement_rate: 4.9, avg_views: 81000 }, { platform: 'tiktok', handle: 'graceathome', followers: 390000, engagement_rate: 7.2, avg_views: 260000 }], audience: { countries: [{ name: 'United States', pct: 61 }, { name: 'United Kingdom', pct: 10 }, { name: 'Canada', pct: 9 }, { name: 'Australia', pct: 6 }], ages: [{ range: '18-24', pct: 24 }, { range: '25-34', pct: 50 }, { range: '35-44', pct: 19 }, { range: '45+', pct: 7 }], gender: { female: 76, male: 22, other: 2 } }, portfolio: [{ title: 'Studio apartment makeover for $600', platform: 'tiktok', url: 'https://tiktok.com/@graceathome/video/6', views: 1900000, brand: 'IKEA' }], tags: ['before-after', 'aesthetic', 'renter'], followers: 390000, er: 4.9, views: 81000, rates: [650, 850, 1500, 350], rating: 4.8, done: 15, resp: 11 },
    { id: 'cr_kenji', name: 'Kenji Sato', handle: 'kenjioutdoors', bio: 'Trail running, bikepacking and gear that survives. Based in the Alps, filming in the rain.', location: 'Innsbruck, AT', niche: 'Outdoors & Adventure', secondary: ['Fitness & Apparel', 'Lifestyle & Travel'], platforms: ['youtube', 'instagram'], stats: [{ platform: 'youtube', handle: 'KenjiOutdoors', followers: 178000, engagement_rate: 5.3, avg_views: 70000 }, { platform: 'instagram', handle: 'kenjioutdoors', followers: 112000, engagement_rate: 4.8, avg_views: 36000 }], audience: { countries: [{ name: 'United States', pct: 29 }, { name: 'Germany', pct: 19 }, { name: 'United Kingdom', pct: 12 }, { name: 'Austria', pct: 8 }], ages: [{ range: '18-24', pct: 18 }, { range: '25-34', pct: 44 }, { range: '35-44', pct: 27 }, { range: '45+', pct: 11 }], gender: { female: 37, male: 61, other: 2 } }, portfolio: [{ title: '200km bikepacking the Dolomites', platform: 'youtube', url: 'https://youtube.com/watch?v=ks-dolomites', views: 156000, brand: 'Patagonia' }], tags: ['cinematic', 'endurance', 'gear-test'], followers: 178000, er: 5.3, views: 70000, rates: [500, 700, 1300, 300], rating: 4.9, done: 13, resp: 30, available: false },
  ];
  for (const c of creators) {
    execute(
      `INSERT INTO creators (id, name, handle, avatar_url, bio, location, primary_niche, secondary_niches, platforms, platform_stats, audience, portfolio, content_tags, follower_count, engagement_rate, avg_views, rate_post, rate_reel, rate_video, rate_story, verified, rating, completed_campaigns, response_time_hours, wallet_balance, available, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, ?, ?)`,
      [c.id, c.name, c.handle, avatar(c.handle), c.bio, c.location, c.niche, JSON.stringify(c.secondary), JSON.stringify(c.platforms), JSON.stringify(c.stats), JSON.stringify(c.audience), JSON.stringify(c.portfolio), JSON.stringify(c.tags), c.followers, c.er, c.views, c.rates[0], c.rates[1], c.rates[2], c.rates[3], c.rating, c.done, c.resp, c.available === false ? 0 : 1, daysAgo(200)],
    );
  }

  // ---------------------------------------------------------------- users (password: demo1234)
  const users = [
    { email: 'maya@techpulse.audio', name: 'Maya Okonkwo', role: 'BRAND' as const, brand_id: 'brand_techpulse', title: 'Head of Creator Marketing', seed: 'maya-okonkwo' },
    { email: 'james@glowbotanicals.com', name: 'James Carter', role: 'BRAND' as const, brand_id: 'brand_glow', title: 'Brand Director', seed: 'james-carter' },
    { email: 'lena@apexathletics.co', name: 'Lena Fischer', role: 'BRAND' as const, brand_id: 'brand_apex', title: 'Growth Lead', seed: 'lena-fischer' },
    { email: 'sam@omnimedia.co', name: 'Sam Rivera', role: 'AGENCY' as const, agency_id: 'agency_omni', title: 'Account Director', seed: 'sam-rivera' },
    { email: 'ava@elevate.io', name: 'Ava Patel', role: 'AGENCY' as const, agency_id: 'agency_elevate', title: 'Partnerships Lead', seed: 'ava-patel' },
    { email: 'marcus@creator.cmi', name: 'Marcus Vance', role: 'CREATOR' as const, creator_id: 'cr_marcus', title: 'Creator', seed: 'marcus_tech' },
    { email: 'elena@creator.cmi', name: 'Elena Rostova', role: 'CREATOR' as const, creator_id: 'cr_elena', title: 'Creator', seed: 'elena_beauty' },
    { email: 'david@creator.cmi', name: 'David Chen', role: 'CREATOR' as const, creator_id: 'cr_david', title: 'Creator', seed: 'dchen_fitness' },
    { email: 'admin@cmi.local', name: 'Platform Admin', role: 'ADMIN' as const, title: 'Administrator', seed: 'admin' },
  ];
  const userIds: Record<string, string> = {};
  for (const u of users) {
    const created = createUser({ email: u.email, password: 'demo1234', name: u.name, role: u.role, brand_id: (u as any).brand_id ?? null, agency_id: (u as any).agency_id ?? null, creator_id: (u as any).creator_id ?? null, avatar_url: avatar(u.seed), title: u.title });
    userIds[u.email] = created.id;
  }
  const maya = { type: 'HUMAN' as const, id: userIds['maya@techpulse.audio'], name: 'Maya Okonkwo' };
  const james = { type: 'HUMAN' as const, id: userIds['james@glowbotanicals.com'], name: 'James Carter' };
  const lena = { type: 'HUMAN' as const, id: userIds['lena@apexathletics.co'], name: 'Lena Fischer' };
  const sam = { type: 'HUMAN' as const, id: userIds['sam@omnimedia.co'], name: 'Sam Rivera' };

  // ---------------------------------------------------------------- campaigns
  const earbuds = createCampaign({
    id: 'camp_techpulse_earbuds', created_at: daysAgo(28), brand_id: 'brand_techpulse', agency_id: 'agency_omni', title: 'PulseBuds Pro Launch', status: 'ACTIVE',
    brief: 'Launch the PulseBuds Pro — adaptive ANC, 38-hour battery, spatial audio — to tech-forward commuters and creators. We want honest, hands-on reviews that show the product in real commutes, flights and work sessions, not studio B-roll.',
    objectives: 'Drive 4,000 pre-orders in the first 30 days and establish PulseBuds Pro as the best-value ANC earbuds in its tier. Target ≥4.5% engagement and ≥1.5% click-through on tracked links.',
    target_niches: ['Tech & Gadgets', 'Audio Gear'], target_platforms: ['youtube', 'instagram'], target_audience: '22–38, urban commuters and remote workers in the US, UK and Canada who already own premium headphones.',
    content_guidelines: 'Disclose with #ad in the first line. Tag @techpulseaudio and use #PulseBudsPro. Mention adaptive ANC, 38-hour battery and the code PULSE20 within the first 3 lines of the caption. No competitor comparisons that name Sony or Apple.',
    required_deliverables: ['1x YouTube Video (8–12 min)', '1x Instagram Reel'], budget: 25000, rate_band_min: 600, rate_band_max: 1900, start_date: daysAgo(21).slice(0, 10), end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  }, maya);

  const radiance = createCampaign({
    id: 'camp_glow_radiance', created_at: daysAgo(40), brand_id: 'brand_glow', agency_id: 'agency_omni', title: 'Radiance Serum: 30-Day Glow', status: 'ACTIVE',
    brief: 'A 30-day challenge around our vitamin C + niacinamide Radiance Serum. Creators document real skin over a month with weekly check-ins; we want texture, honesty and before/afters.',
    objectives: 'Build a library of 30-day testimonial content and lift DTC conversion by 20% on the serum PDP. Secondary: 1M organic views across TikTok and Instagram.',
    target_niches: ['Beauty & Skincare', 'Wellness'], target_platforms: ['tiktok', 'instagram'], target_audience: '18–34 women in the US and UK with an interest in ingredient-led skincare.',
    content_guidelines: 'Use #ad or Paid Partnership label. Tag @glowbotanicals, use #30DayGlow and share code GLOW15. Show the product texture on camera. No medical claims beyond "brightening" and "evens tone".',
    required_deliverables: ['2x TikTok Video', '1x Instagram Reel', '4x Instagram Story'], budget: 14000, rate_band_min: 400, rate_band_max: 1400, start_date: daysAgo(35).slice(0, 10), end_date: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
  }, james);

  const training = createCampaign({
    id: 'camp_apex_training', created_at: daysAgo(50), brand_id: 'brand_apex', agency_id: 'agency_elevate', title: 'Apex 6-Week Hybrid Program', status: 'ACTIVE',
    brief: 'Launch the Apex Hybrid app program with athlete creators who follow the 6-week plan on camera, wearing the new Apex Flex line. Progress over perfection.',
    objectives: '10,000 app trials and 2,500 Flex line orders. Build long-term ambassador relationships with 3 athletes.',
    target_niches: ['Fitness & Apparel', 'Athletics'], target_platforms: ['instagram', 'youtube', 'tiktok'], target_audience: '20–35 active people in North America and the UK who train 3+ times a week.',
    content_guidelines: '#ad disclosure required. Tag @apexathletics, use #ApexHybrid and code APEX6. Show at least one full workout from the program per video.',
    required_deliverables: ['1x YouTube Video', '2x Instagram Reel', '4x Instagram Story'], budget: 30000, rate_band_min: 500, rate_band_max: 2000, start_date: daysAgo(42).slice(0, 10), end_date: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
  }, lena);

  const mealkit = createCampaign({
    id: 'camp_nomad_weeknights', created_at: daysAgo(6), brand_id: 'brand_nomad', agency_id: 'agency_omni', title: 'Nomad Weeknights', status: 'DRAFT',
    brief: 'Introduce Nomad Kitchen meal kits to busy households with 20-minute weeknight recipes from our Mexico City and Seoul collections.',
    objectives: 'Acquire 3,000 first-box customers at under $35 CAC.', target_niches: ['Food & Cooking', 'Parenting & Family'], target_platforms: ['tiktok', 'instagram', 'youtube'],
    target_audience: '25–45 households in the US with two working adults.', content_guidelines: '#ad disclosure. Tag @nomadkitchen and use #NomadWeeknights. Code NOMAD40 for 40% off the first box.',
    required_deliverables: ['1x TikTok Video', '1x Instagram Reel'], budget: 18000, rate_band_min: 400, rate_band_max: 2000,
  }, sam);

  const holiday = createCampaign({
    id: 'camp_techpulse_holiday', created_at: daysAgo(95), brand_id: 'brand_techpulse', agency_id: 'agency_omni', title: 'PulseBand Holiday Gift Guide', status: 'ACTIVE',
    brief: 'Position the PulseBand speaker as the gift of the season across gift-guide content.', objectives: '2,000 holiday-window orders.',
    target_niches: ['Tech & Gadgets', 'Lifestyle & Travel'], target_platforms: ['youtube', 'instagram'], target_audience: '25–44 gift buyers in the US and UK.',
    content_guidelines: '#ad disclosure. Tag @techpulseaudio and use #PulseBand. Code GIFT15.', required_deliverables: ['1x YouTube Video', '1x Instagram Post'], budget: 12000, rate_band_min: 500, rate_band_max: 2500,
    start_date: daysAgo(90).slice(0, 10), end_date: daysAgo(35).slice(0, 10),
  }, maya);

  // ---------------------------------------------------------------- agent sessions
  createSession({ id: 'sess_techpulse_operator', name: 'PulseBuds launch operator', brand_id: 'brand_techpulse', agency_id: 'agency_omni', campaign_id: earbuds.id, role_scope: 'FULL_OPERATOR', budget_ceiling: 15000, rate_ceiling: 1500, instructions: 'Prioritise creators with strong US/UK commuter audiences. Never exceed the campaign rate band. Escalate anything involving competitor mentions.' }, maya.id);
  createSession({ id: 'sess_glow_scout', name: 'Radiance discovery scout', brand_id: 'brand_glow', agency_id: 'agency_omni', campaign_id: radiance.id, role_scope: 'DISCOVERY_ONLY', budget_ceiling: 0, rate_ceiling: 0, instructions: 'Shortlist only; a human sends offers.' }, james.id);
  createSession({ id: 'sess_apex_manager', name: 'Apex hybrid campaign manager', brand_id: 'brand_apex', agency_id: 'agency_elevate', campaign_id: training.id, role_scope: 'CAMPAIGN_MANAGER', budget_ceiling: 12000, rate_ceiling: 1200 }, lena.id);
  createSession({ id: 'sess_nomad_planner', name: 'Nomad launch planner', brand_id: 'brand_nomad', agency_id: 'agency_omni', campaign_id: mealkit.id, role_scope: 'CAMPAIGN_MANAGER', budget_ceiling: 10000, rate_ceiling: 1500 }, sam.id);
  const operator = requireSession('sess_techpulse_operator');
  const agentActor = { type: 'AGENT' as const, id: operator.id, name: operator.name, session_id: operator.id };

  // Audit entries are queued and flushed in timestamp order at the end so the
  // hash chain (ordered by seq) also reads chronologically.
  const pendingAudits: AuditInput[] = [];
  const humanAudit = (who: { id: string; name: string }, tool: string, params: any, summary: string, campaignId: string | null, when: string) =>
    pendingAudits.push({ actor_type: 'HUMAN', actor_id: who.id, actor_name: who.name, campaign_id: campaignId, tool_name: tool, parameters: params, execution_status: 'SUCCESS', result_summary: summary, guardrail_notes: 'Human action via dashboard.', duration_ms: 40 + Math.floor(Math.random() * 60), timestamp: when });
  const creatorActor = (id: string, name: string) => ({ id, name });

  // ---------------------------------------------------------------- completed holiday campaign (history)
  const holidayCollab = sendOffer({ id: 'collab_maya_holiday', campaign_id: holiday.id, creator_id: 'cr_maya', proposed_rate: 2100, deliverables: ['YOUTUBE_VIDEO', 'POST'], deadline: daysAgo(55).slice(0, 10), message: 'We would love PulseBand in your winter gift guide.' }, maya);
  acceptOffer(holidayCollab.id, { type: 'CREATOR', id: 'cr_maya', name: 'Maya Lin' });
  const hv = holidayCollab.deliverables.find((d) => d.deliverable_type === 'YOUTUBE_VIDEO')!;
  const hp = holidayCollab.deliverables.find((d) => d.deliverable_type === 'POST')!;
  submitDeliverable(hv.id, { content_url: 'https://youtube.com/watch?v=ml-giftguide', caption: '#ad My 2025 gift guide for people who are impossible to buy for — the PulseBand speaker from @techpulseaudio made the cut (code GIFT15). #PulseBand' }, { type: 'HUMAN', id: 'cr_maya', name: 'Maya Lin' });
  reviewDeliverable(hv.id, 'APPROVED', 'Beautifully shot, thank you.', maya);
  submitDeliverable(hp.id, { content_url: 'https://www.instagram.com/p/ml-pulseband/', caption: '#ad Sunday mornings sound better. @techpulseaudio #PulseBand — GIFT15 for 15% off.' }, { type: 'HUMAN', id: 'cr_maya', name: 'Maya Lin' });
  reviewDeliverable(hp.id, 'APPROVED', undefined, maya);
  releasePayment({ collaboration_id: holidayCollab.id, deliverable_id: hv.id, amount: 1500, note: 'Video payout' }, maya);
  releasePayment({ collaboration_id: holidayCollab.id, deliverable_id: hp.id, amount: 600, note: 'Post payout' }, maya);
  const holidayLiam = sendOffer({ campaign_id: holiday.id, creator_id: 'cr_liam', proposed_rate: 950, deliverables: ['YOUTUBE_VIDEO'], deadline: daysAgo(55).slice(0, 10) }, maya);
  acceptOffer(holidayLiam.id, { type: 'CREATOR', id: 'cr_liam', name: 'Liam Okafor' });
  const lv = holidayLiam.deliverables[0];
  submitDeliverable(lv.id, { content_url: 'https://youtube.com/watch?v=lg-pulseband', caption: '#ad Is the PulseBand the best speaker under £200? @techpulseaudio #PulseBand code GIFT15' }, { type: 'HUMAN', id: 'cr_liam', name: 'Liam Okafor' });
  reviewDeliverable(lv.id, 'APPROVED', undefined, maya);
  releasePayment({ collaboration_id: holidayLiam.id, deliverable_id: lv.id, amount: 950 }, maya);
  execute(`UPDATE campaigns SET status = 'COMPLETED' WHERE id = ?`, [holiday.id]);

  // ---------------------------------------------------------------- PulseBuds (live, agent-operated)
  for (const [cid, rationale] of [['cr_marcus', 'Primary niche match, 48% US audience, 4.8% engagement on 420k — the archetypal PulseBuds reviewer.'], ['cr_priya', 'Strong cross-platform reach with a developer audience that over-indexes on premium audio.'], ['cr_liam', 'Commuter-focused UK audience at a value rate; good complement to Marcus.'], ['cr_sofia', 'Creator-tools angle for the "creators" segment; TikTok strength.']] as const) {
    addToShortlist(earbuds.id, cid, { type: 'AGENT', id: operator.id }, rationale);
  }
  const shortlist = queryAll<any>(`SELECT id, creator_id FROM campaign_shortlist WHERE campaign_id = ?`, [earbuds.id]);
  for (const s of shortlist) reviewShortlist(s.id, s.creator_id === 'cr_sofia' ? 'REJECTED' : 'APPROVED', maya.id);

  const marcus = sendOffer({ id: 'collab_marcus_techpulse', campaign_id: earbuds.id, creator_id: 'cr_marcus', proposed_rate: 1800, deliverables: ['YOUTUBE_VIDEO', 'REEL'], deadline: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10), terms: 'Exclusive tech-audio category sponsor for 30 days. Tracked link and PULSE20 code. 90-day organic usage rights.', message: 'Hi Marcus — we think PulseBuds Pro is exactly the kind of product your audience trusts you to stress-test. Open to your usual format.' }, agentActor);
  // Marcus countered, agent accepted via human-approved checkpoint
  counterOffer(marcus.id, 1950, 'Happy to do this. For a dedicated 10-minute video plus a reel with 30-day exclusivity I would need $1,950.', { type: 'CREATOR', id: 'cr_marcus', name: 'Marcus Vance' });
  acceptOffer(marcus.id, { type: 'BRAND', id: maya.id, name: maya.name }, 'Approved at $1,950 — looking forward to it.');
  startWork(marcus.id, { type: 'CREATOR', id: 'cr_marcus', name: 'Marcus Vance' });
  postMessage(marcus.id, 'Units arrived yesterday. First impressions on the ANC are strong; shooting commute footage this week.', { type: 'CREATOR', id: 'cr_marcus', name: 'Marcus Vance' });
  postMessage(marcus.id, 'Great — remember the PULSE20 code and #PulseBudsPro in the first three lines. Shout if you need extra B-roll.', { type: 'BRAND', id: maya.id, name: maya.name });
  const mv = marcus.deliverables.find((d) => d.deliverable_type === 'YOUTUBE_VIDEO')!;
  submitDeliverable(mv.id, { content_url: 'https://youtube.com/watch?v=mv-pulsebuds', caption: '#ad I wore the PulseBuds Pro from @techpulseaudio for two weeks of commutes and flights. Adaptive ANC is the headline, the 38-hour battery is the real story. Code PULSE20 for 20% off. #PulseBudsPro' }, { type: 'HUMAN', id: 'cr_marcus', name: 'Marcus Vance' });
  reviewDeliverable(mv.id, 'APPROVED', 'Exactly the tone we wanted.', maya);

  const priya = sendOffer({ id: 'collab_priya_techpulse', campaign_id: earbuds.id, creator_id: 'cr_priya', proposed_rate: 1400, deliverables: ['YOUTUBE_VIDEO', 'REEL'], deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), terms: 'Tracked link, PULSE20 code, 60-day organic usage rights.' }, agentActor);
  acceptOffer(priya.id, { type: 'CREATOR', id: 'cr_priya', name: 'Priya Natarajan' }, 'Love it. Shooting next week.');
  startWork(priya.id, { type: 'CREATOR', id: 'cr_priya', name: 'Priya Natarajan' });

  const liam = sendOffer({ id: 'collab_liam_techpulse', campaign_id: earbuds.id, creator_id: 'cr_liam', proposed_rate: 950, deliverables: ['YOUTUBE_VIDEO'], deadline: new Date(Date.now() + 18 * 86400000).toISOString().slice(0, 10) }, agentActor);
  counterOffer(liam.id, 1100, 'Could we do $1,100? The dedicated video takes a full shoot day.', { type: 'CREATOR', id: 'cr_liam', name: 'Liam Okafor' });

  // Pending checkpoints that a reviewer will see on login
  createCheckpoint({ session: operator, campaign_id: earbuds.id, action_type: 'PAYMENT_ABOVE_THRESHOLD', risk_level: 'HIGH', amount: 1950, tool_name: 'release_payment', payload: { collaboration_id: marcus.id, deliverable_id: mv.id, amount: 1950, note: 'Video approved; releasing full escrow per agreement.' }, justification: 'Payout of $1,950 exceeds the $1,000 autonomous release threshold.' });
  createCheckpoint({ session: operator, campaign_id: earbuds.id, action_type: 'OUT_OF_BAND_RATE', risk_level: 'MEDIUM', amount: 1900, tool_name: 'send_collaboration_offer', payload: { campaign_id: earbuds.id, creator_id: 'cr_jaxson', proposed_rate: 1900, deliverables: ['YOUTUBE_VIDEO'], deadline: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), terms: 'Single dedicated video; no exclusivity.' }, justification: 'Proposed $1,900 exceeds the per-collaboration ceiling of $1,500 authorised for this session.' });
  createCheckpoint({ session: operator, campaign_id: earbuds.id, action_type: 'AGENT_ESCALATION', risk_level: 'LOW', tool_name: 'request_human_approval', payload: { action_type: 'CREATOR_FIT', details: '@jax_gaming has the largest reach on the shortlist (890k) but only 18% female audience and a gaming-first positioning. Options: (a) send a single-video offer at $1,900, (b) skip and reallocate to two mid-tier tech creators, (c) ask Jaxson for a reduced "peripherals" angle at $1,400.', reason: 'Audience fit is borderline and the spend is a large share of remaining budget.' }, justification: 'CREATOR_FIT: Audience fit is borderline and the spend is a large share of remaining budget.' });

  // ---------------------------------------------------------------- Radiance (human-run, mid-flight)
  for (const [cid, r] of [['cr_elena', 'Dermatology student with ingredient-led content; 78% female 18–34 audience.'], ['cr_amara', 'Inclusive skincare testing with 30-day formats — a natural fit for the challenge.'], ['cr_hana', 'Largest TikTok reach in the category; trend-led content for the 1M-view goal.']] as const) addToShortlist(radiance.id, cid, james, r);
  for (const s of queryAll<any>(`SELECT id FROM campaign_shortlist WHERE campaign_id = ?`, [radiance.id])) reviewShortlist(s.id, 'APPROVED', james.id);

  const elena = sendOffer({ id: 'collab_elena_glow', campaign_id: radiance.id, creator_id: 'cr_elena', proposed_rate: 1200, deliverables: ['TIKTOK_VIDEO', 'TIKTOK_VIDEO', 'REEL', 'STORY'], deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), terms: '30-day challenge with weekly check-ins. GLOW15 code. 6-month organic usage rights.' }, james);
  acceptOffer(elena.id, { type: 'CREATOR', id: 'cr_elena', name: 'Elena Rostova' }, 'In! Starting the challenge Monday.');
  startWork(elena.id, { type: 'CREATOR', id: 'cr_elena', name: 'Elena Rostova' });
  const [et1, et2, er1] = elena.deliverables;
  submitDeliverable(et1.id, { content_url: 'https://www.tiktok.com/@elena_beauty/video/7301', caption: 'Paid partnership with @glowbotanicals — day 1 of #30DayGlow with the Radiance Serum. Texture check in the first 5 seconds. GLOW15 for 15% off. #ad' }, { type: 'HUMAN', id: 'cr_elena', name: 'Elena Rostova' });
  reviewDeliverable(et1.id, 'APPROVED', undefined, james);
  releasePayment({ collaboration_id: elena.id, deliverable_id: et1.id, amount: 300, note: 'Milestone 1 of 4' }, james);
  submitDeliverable(et2.id, { content_url: 'https://www.tiktok.com/@elena_beauty/video/7302', caption: 'Week 2 of the Radiance Serum challenge with @glowbotanicals. Noticeably brighter already. #30DayGlow GLOW15' }, { type: 'HUMAN', id: 'cr_elena', name: 'Elena Rostova' });
  reviewDeliverable(et2.id, 'CHANGES_REQUESTED', 'Missing the #ad / paid-partnership disclosure in the caption — please add it in the first line and resubmit.', james);
  void er1;

  const amara = sendOffer({ id: 'collab_amara_glow', campaign_id: radiance.id, creator_id: 'cr_amara', proposed_rate: 1000, deliverables: ['TIKTOK_VIDEO', 'REEL', 'STORY'], deadline: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10) }, james);
  acceptOffer(amara.id, { type: 'CREATOR', id: 'cr_amara', name: 'Amara Diallo' });
  const hana = sendOffer({ id: 'collab_hana_glow', campaign_id: radiance.id, creator_id: 'cr_hana', proposed_rate: 1400, deliverables: ['TIKTOK_VIDEO', 'REEL'], deadline: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10) }, james);
  declineOffer(hana.id, { type: 'CREATOR', id: 'cr_hana', name: 'Hana Kim' }, 'Thank you — I am fully booked through next month.');

  // ---------------------------------------------------------------- Apex (agency-run)
  for (const [cid, r] of [['cr_david', 'Hybrid athlete who already runs a structured program; 46% 25–34.'], ['cr_zara', 'Strength + physio credibility for the women-in-sport segment.'], ['cr_kenji', 'Endurance angle, strong EU audience for the Flex line.']] as const) addToShortlist(training.id, cid, lena, r);
  const david = sendOffer({ id: 'collab_david_apex', campaign_id: training.id, creator_id: 'cr_david', proposed_rate: 1700, deliverables: ['YOUTUBE_VIDEO', 'REEL', 'REEL', 'STORY'], deadline: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), terms: '6-week program on camera. APEX6 code. Ambassador option at the end.' }, lena);
  acceptOffer(david.id, { type: 'CREATOR', id: 'cr_david', name: 'David Chen' });
  startWork(david.id, { type: 'CREATOR', id: 'cr_david', name: 'David Chen' });
  const dr = david.deliverables.find((d) => d.deliverable_type === 'REEL')!;
  submitDeliverable(dr.id, { content_url: 'https://www.instagram.com/reel/dc-apex-w1/', caption: '#ad Week 1 of the @apexathletics Hybrid program. Day 3 was brutal in the best way. #ApexHybrid — APEX6 for 6 weeks free.' }, { type: 'HUMAN', id: 'cr_david', name: 'David Chen' });
  const zara = sendOffer({ id: 'collab_zara_apex', campaign_id: training.id, creator_id: 'cr_zara', proposed_rate: 1100, deliverables: ['YOUTUBE_VIDEO', 'REEL'], deadline: new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10) }, lena);
  void zara;

  // ---------------------------------------------------------------- historical agent run (replayable in the UI)
  const histRun = createRun({ session_id: operator.id, campaign_id: earbuds.id, goal: 'Launch PulseBuds Pro: shortlist 3–4 creators, refine the brief and send offers inside the rate band.', mode: 'SIMULATED', model: null });
  const ev = (type: any, payload: any) => appendRunEvent(histRun.id, type, payload);
  ev('status', { text: 'Run started in simulated planner mode · session PulseBuds launch operator' });
  ev('thinking', { text: 'Before spending anything I need the current state of "PulseBuds Pro Launch": available budget, existing collaborations and pending checkpoints.' });
  ev('tool_call', { id: 'call_1', tool: 'get_campaign_status', input: { campaign_id: earbuds.id }, step: 1 });
  ev('tool_result', { id: 'call_1', tool: 'get_campaign_status', status: 'SUCCESS', duration_ms: 12, result: { campaign: { id: earbuds.id, title: earbuds.title, status: 'ACTIVE' }, budget: { budget: 25000, available: 25000 } }, step: 1 });
  ev('thinking', { text: 'Budget is untouched. Searching Tech & Gadgets creators on YouTube and Instagram, scored against the brief.' });
  ev('tool_call', { id: 'call_2', tool: 'search_creators', input: { campaign_id: earbuds.id, niche: 'Tech & Gadgets', platform: 'youtube', min_engagement: 3, limit: 8 }, step: 2 });
  ev('tool_result', { id: 'call_2', tool: 'search_creators', status: 'SUCCESS', duration_ms: 18, result: { count: 5, creators: [{ id: 'cr_marcus', handle: '@marcus_tech', match_score: 93 }, { id: 'cr_priya', handle: '@priya.codes', match_score: 88 }, { id: 'cr_liam', handle: '@liamgear', match_score: 84 }, { id: 'cr_sofia', handle: '@sofiasetup', match_score: 71 }, { id: 'cr_jaxson', handle: '@jax_gaming', match_score: 58 }] }, step: 2 });
  for (const [i, c] of [['cr_marcus', 'marcus_tech'], ['cr_priya', 'priya.codes'], ['cr_liam', 'liamgear'], ['cr_sofia', 'sofiasetup']].entries()) {
    ev('tool_call', { id: `call_${3 + i}`, tool: 'add_to_shortlist', input: { campaign_id: earbuds.id, creator_id: c[0], rationale: 'Strong niche and audience fit for the brief.' }, step: 3 + i });
    ev('tool_result', { id: `call_${3 + i}`, tool: 'add_to_shortlist', status: 'SUCCESS', duration_ms: 9, result: { creator: `@${c[1]}`, status: 'SUGGESTED', message: `@${c[1]} added to the shortlist.` }, step: 3 + i });
  }
  ev('thinking', { text: 'Offering @marcus_tech video + reel at his $1,800 rate card. Inside my $1,500 ceiling? No — but this is the best-fit creator, so I will send it and let governance route it to a human rather than silently under-bid.' });
  ev('tool_call', { id: 'call_7', tool: 'send_collaboration_offer', input: { campaign_id: earbuds.id, creator_id: 'cr_marcus', proposed_rate: 1800, deliverables: ['YOUTUBE_VIDEO', 'REEL'] }, step: 7 });
  ev('checkpoint', { id: 'call_7', tool: 'send_collaboration_offer', checkpoint_id: 'chk_seed_marcus', message: 'Rate $1,800 is above the authorised per-collaboration ceiling ($1,500). Held for human approval.', guardrail_notes: 'Checkpoint: OUT_OF_BAND_RATE ($1,800 > $1,500).' });
  ev('tool_result', { id: 'call_7', tool: 'send_collaboration_offer', status: 'HELD_FOR_APPROVAL', duration_ms: 14, result: { status: 'PENDING_HUMAN_APPROVAL', checkpoint_id: 'chk_seed_marcus' }, guardrail_notes: 'Checkpoint: OUT_OF_BAND_RATE ($1,800 > $1,500).', step: 7 });
  ev('tool_call', { id: 'call_8', tool: 'send_collaboration_offer', input: { campaign_id: earbuds.id, creator_id: 'cr_priya', proposed_rate: 1400, deliverables: ['YOUTUBE_VIDEO', 'REEL'] }, step: 8 });
  ev('tool_result', { id: 'call_8', tool: 'send_collaboration_offer', status: 'SUCCESS', duration_ms: 21, result: { collaboration_id: 'collab_priya_techpulse', status: 'OFFERED', escrow_locked: 1400, message: 'Offer of $1,400 sent to @priya.codes; escrow hold recorded in the ledger.' }, step: 8 });
  ev('tool_call', { id: 'call_9', tool: 'send_collaboration_offer', input: { campaign_id: earbuds.id, creator_id: 'cr_liam', proposed_rate: 950, deliverables: ['YOUTUBE_VIDEO'] }, step: 9 });
  ev('tool_result', { id: 'call_9', tool: 'send_collaboration_offer', status: 'SUCCESS', duration_ms: 19, result: { collaboration_id: 'collab_liam_techpulse', status: 'OFFERED', escrow_locked: 950, message: 'Offer of $950 sent to @liamgear; escrow hold recorded in the ledger.' }, step: 9 });
  ev('tool_call', { id: 'call_10', tool: 'send_collaboration_offer', input: { campaign_id: earbuds.id, creator_id: 'cr_jaxson', proposed_rate: 3200, deliverables: ['YOUTUBE_VIDEO'] }, step: 10 });
  ev('guardrail', { id: 'call_10', tool: 'send_collaboration_offer', message: 'Budget ceiling exceeded: committing $3,200 would bring session spend to $5,550, above the hard ceiling of $15,000? No — rate $3,200 exceeds ceiling; blocked.', guardrail_notes: 'Hard budget ceiling breach.', rules: ['session_status', 'permission_scope', 'campaign_binding', 'budget_ceiling'] });
  ev('tool_result', { id: 'call_10', tool: 'send_collaboration_offer', status: 'REJECTED_BY_GUARDRAIL', duration_ms: 6, result: { error: 'Rate $3,200 exceeds the per-collaboration ceiling and the remaining band; blocked.' }, step: 10 });
  ev('text', { text: 'Shortlisted 4 creators, sent 2 offers ($2,350 committed), 1 offer held for human approval (@marcus_tech at $1,800), 1 blocked by guardrails (@jax_gaming at $3,200). Recommend approving the Marcus checkpoint — he is the strongest fit and the overage is 20%.' });
  ev('done', { status: 'COMPLETED', summary: 'Shortlisted 4, sent 2 offers, 1 checkpoint, 1 guardrail block.', steps: 10, checkpoints: 1, blocked: 1, spend: 2350 });
  updateRun(histRun.id, { status: 'COMPLETED', summary: 'Shortlisted 4 creators, sent 2 offers ($2,350 committed), 1 held for approval, 1 blocked by guardrails.', steps_count: 10, checkpoints_count: 1, blocked_count: 1, spend_committed: 2350 });
  run(`UPDATE agent_runs SET started_at = ?, finished_at = ? WHERE id = ?`, [daysAgo(19, 9), daysAgo(19, 9.1), histRun.id]);

  // Agent audit trail for the historical run (hash-chained, backdated timestamps)
  const t = (d: number, h: number) => daysAgo(d, h);
  const agentAudit = (tool: string, params: any, status: any, summary: string, notes: string, when: string, ms = 15) => pendingAudits.push({ actor_type: 'AGENT', actor_id: operator.id, actor_name: operator.name, session_id: operator.id, run_id: histRun.id, campaign_id: earbuds.id, tool_name: tool, parameters: params, execution_status: status, result_summary: summary, guardrail_notes: notes, duration_ms: ms, timestamp: when });
  agentAudit('get_campaign_status', { campaign_id: earbuds.id }, 'SUCCESS', 'Campaign snapshot retrieved.', 'Passed 3 governance rules (session_status, permission_scope, campaign_binding).', t(19, 9.01), 12);
  agentAudit('search_creators', { campaign_id: earbuds.id, niche: 'Tech & Gadgets', platform: 'youtube', min_engagement: 3 }, 'SUCCESS', '5 creators matched and scored.', 'Passed 3 governance rules.', t(19, 9.02), 18);
  agentAudit('add_to_shortlist', { campaign_id: earbuds.id, creator_id: 'cr_marcus' }, 'SUCCESS', '@marcus_tech added to the shortlist (match 93/100).', 'Passed 3 governance rules.', t(19, 9.03), 9);
  agentAudit('add_to_shortlist', { campaign_id: earbuds.id, creator_id: 'cr_priya' }, 'SUCCESS', '@priya.codes added to the shortlist (match 88/100).', 'Passed 3 governance rules.', t(19, 9.04), 8);
  agentAudit('send_collaboration_offer', { campaign_id: earbuds.id, creator_id: 'cr_marcus', proposed_rate: 1800, deliverables: ['YOUTUBE_VIDEO', 'REEL'] }, 'HELD_FOR_APPROVAL', 'Rate $1,800 is above the authorised per-collaboration ceiling ($1,500). Held for human approval.', 'Checkpoint: OUT_OF_BAND_RATE ($1,800 > $1,500).', t(19, 9.05), 14);
  agentAudit('send_collaboration_offer', { campaign_id: earbuds.id, creator_id: 'cr_priya', proposed_rate: 1400, deliverables: ['YOUTUBE_VIDEO', 'REEL'] }, 'SUCCESS', 'Offer of $1,400 sent to @priya.codes; escrow hold recorded in the ledger.', 'Passed 5 governance rules (session_status, permission_scope, campaign_binding, budget_ceiling, rate_ceiling).', t(19, 9.06), 21);
  agentAudit('send_collaboration_offer', { campaign_id: earbuds.id, creator_id: 'cr_liam', proposed_rate: 950, deliverables: ['YOUTUBE_VIDEO'] }, 'SUCCESS', 'Offer of $950 sent to @liamgear; escrow hold recorded in the ledger.', 'Passed 5 governance rules.', t(19, 9.07), 19);
  agentAudit('send_collaboration_offer', { campaign_id: earbuds.id, creator_id: 'cr_jaxson', proposed_rate: 3200, deliverables: ['YOUTUBE_VIDEO'] }, 'REJECTED_BY_GUARDRAIL', 'Rate $3,200 exceeds the per-collaboration ceiling and remaining band; blocked.', 'Hard budget ceiling breach.', t(19, 9.08), 6);
  pendingAudits.push({ actor_type: 'HUMAN', actor_id: maya.id, actor_name: maya.name, session_id: operator.id, run_id: histRun.id, campaign_id: earbuds.id, tool_name: 'resolve_checkpoint', parameters: { checkpoint_id: 'chk_seed_marcus', decision: 'APPROVED', amount: 1800 }, execution_status: 'SUCCESS', result_summary: 'Checkpoint chk_seed_marcus (OUT_OF_BAND_RATE) approved; send_collaboration_offer executed on behalf of the agent.', guardrail_notes: 'Reviewer notes: Marcus is worth the overage.', duration_ms: 40, timestamp: t(18, 11) });
  agentAudit('get_campaign_analytics', { campaign_id: earbuds.id }, 'SUCCESS', 'Analytics retrieved.', 'Passed 3 governance rules.', t(5, 14), 11);
  agentAudit('track_deliverable', { collaboration_id: marcus.id, deliverable_id: mv.id, content_url: 'https://youtube.com/watch?v=mv-pulsebuds' }, 'SUCCESS', 'Deliverable tracked. Compliance passed (100%).', 'Passed 3 governance rules.', t(3, 16), 25);
  agentAudit('release_payment', { collaboration_id: marcus.id, deliverable_id: mv.id, amount: 1950 }, 'HELD_FOR_APPROVAL', 'Payout of $1,950 exceeds the $1,000 autonomous threshold. Held for human approval.', 'Checkpoint: PAYMENT_ABOVE_THRESHOLD.', t(1, 9), 13);
  execute(`UPDATE agent_sessions SET spent_amount = ?, last_active_at = ? WHERE id = ?`, [4300, t(1, 9), operator.id]);

  // ---------------------------------------------------------------- human audit history
  humanAudit(maya, 'create_campaign', { title: holiday.title, budget: 12000 }, `Campaign "${holiday.title}" created with $12,000 budget.`, holiday.id, t(95, 10));
  humanAudit(maya, 'send_collaboration_offer', { creator_id: 'cr_maya', proposed_rate: 2100 }, 'Offer of $2,100 sent to @mayalifestyle for "PulseBand Holiday Gift Guide".', holiday.id, t(80, 11));
  humanAudit(creatorActor('cr_maya', 'Maya Lin'), 'accept_offer', { collaboration_id: holidayCollab.id }, `Creator accepted ${holidayCollab.id} at $2,100.`, holiday.id, t(79, 15));
  humanAudit(maya, 'send_collaboration_offer', { creator_id: 'cr_liam', proposed_rate: 950 }, 'Offer of $950 sent to @liamgear for "PulseBand Holiday Gift Guide".', holiday.id, t(78, 10));
  humanAudit(creatorActor('cr_liam', 'Liam Okafor'), 'accept_offer', { collaboration_id: holidayLiam.id }, `Creator accepted ${holidayLiam.id} at $950.`, holiday.id, t(77, 9));
  humanAudit(creatorActor('cr_maya', 'Maya Lin'), 'submit_deliverable', { deliverable_id: hv.id, content_url: 'https://youtube.com/watch?v=ml-giftguide' }, `Deliverable submitted on ${holidayCollab.id}; compliance passed (100%).`, holiday.id, t(60, 14));
  humanAudit(maya, 'review_deliverable', { deliverable_id: hv.id, decision: 'APPROVED' }, `Deliverable approved on ${holidayCollab.id}.`, holiday.id, t(59, 10));
  humanAudit(maya, 'release_payment', { collaboration_id: holidayCollab.id, deliverable_id: hv.id, amount: 1500 }, 'Released $1,500 to @mayalifestyle.', holiday.id, t(58, 11));
  humanAudit(maya, 'release_payment', { collaboration_id: holidayCollab.id, deliverable_id: hp.id, amount: 600 }, 'Released $600 to @mayalifestyle.', holiday.id, t(52, 11));
  humanAudit(maya, 'release_payment', { collaboration_id: holidayLiam.id, deliverable_id: lv.id, amount: 950 }, 'Released $950 to @liamgear.', holiday.id, t(50, 16));
  humanAudit(maya, 'transition_campaign', { status: 'COMPLETED' }, `Campaign "${holiday.title}" → COMPLETED.`, holiday.id, t(35, 10));
  humanAudit(james, 'create_campaign', { title: radiance.title, budget: 14000 }, `Campaign "${radiance.title}" created with $14,000 budget.`, radiance.id, t(40, 10));
  humanAudit(lena, 'create_campaign', { title: training.title, budget: 30000 }, `Campaign "${training.title}" created with $30,000 budget.`, training.id, t(50, 10));
  humanAudit(lena, 'send_collaboration_offer', { creator_id: 'cr_david', proposed_rate: 1700 }, 'Offer of $1,700 sent to @dchen_fitness for "Apex 6-Week Hybrid Program".', training.id, t(36, 10));
  humanAudit(creatorActor('cr_david', 'David Chen'), 'accept_offer', { collaboration_id: david.id }, `Creator accepted ${david.id} at $1,700.`, training.id, t(35, 12));
  humanAudit(james, 'add_to_shortlist', { creator_id: 'cr_elena' }, '@elena_beauty shortlisted for "Radiance Serum: 30-Day Glow".', radiance.id, t(33, 10));
  humanAudit(james, 'send_collaboration_offer', { creator_id: 'cr_elena', proposed_rate: 1200 }, 'Offer of $1,200 sent to @elena_beauty for "Radiance Serum: 30-Day Glow".', radiance.id, t(30, 10));
  humanAudit(creatorActor('cr_elena', 'Elena Rostova'), 'accept_offer', { collaboration_id: elena.id }, `Creator accepted ${elena.id} at $1,200.`, radiance.id, t(29, 13));
  humanAudit(james, 'send_collaboration_offer', { creator_id: 'cr_hana', proposed_rate: 1400 }, 'Offer of $1,400 sent to @hanaskin for "Radiance Serum: 30-Day Glow".', radiance.id, t(29, 10));
  humanAudit(creatorActor('cr_hana', 'Hana Kim'), 'decline_offer', { collaboration_id: hana.id }, `${hana.id} declined; escrow returned.`, radiance.id, t(28, 9));
  humanAudit(maya, 'create_campaign', { title: earbuds.title, budget: 25000 }, `Campaign "${earbuds.title}" created with $25,000 budget.`, earbuds.id, t(28, 10));
  humanAudit(maya, 'create_agent_session', { name: operator.name, role_scope: 'FULL_OPERATOR', budget_ceiling: 15000, rate_ceiling: 1500 }, 'Agent session "PulseBuds launch operator" authorised (FULL_OPERATOR, $15,000 ceiling).', earbuds.id, t(20, 16));
  humanAudit(maya, 'start_agent_run', { goal: histRun.goal, mode: 'SIMULATED' }, `Agent run ${histRun.id} started (SIMULATED).`, earbuds.id, t(19, 9));
  humanAudit(maya, 'review_shortlist', { creator_id: 'cr_marcus', status: 'APPROVED' }, 'Shortlist: @marcus_tech approved by reviewer.', earbuds.id, t(18, 10));
  humanAudit(maya, 'review_shortlist', { creator_id: 'cr_sofia', status: 'REJECTED' }, 'Shortlist: @sofiasetup rejected by reviewer.', earbuds.id, t(18, 10.1));
  humanAudit(creatorActor('cr_marcus', 'Marcus Vance'), 'counter_offer', { collaboration_id: marcus.id, amount: 1950 }, `Creator countered at $1,950 on ${marcus.id}.`, earbuds.id, t(17, 14));
  humanAudit(maya, 'accept_offer', { collaboration_id: marcus.id }, `Brand accepted ${marcus.id} at $1,950.`, earbuds.id, t(16, 10));
  humanAudit(creatorActor('cr_priya', 'Priya Natarajan'), 'accept_offer', { collaboration_id: priya.id }, `Creator accepted ${priya.id} at $1,400.`, earbuds.id, t(17, 18));
  humanAudit(creatorActor('cr_liam', 'Liam Okafor'), 'counter_offer', { collaboration_id: liam.id, amount: 1100 }, `Creator countered at $1,100 on ${liam.id}.`, earbuds.id, t(15, 12));
  humanAudit(creatorActor('cr_elena', 'Elena Rostova'), 'submit_deliverable', { deliverable_id: et1.id }, `Deliverable submitted on ${elena.id}; compliance passed (100%).`, radiance.id, t(22, 11));
  humanAudit(james, 'review_deliverable', { deliverable_id: et1.id, decision: 'APPROVED' }, `Deliverable approved on ${elena.id}.`, radiance.id, t(21, 9));
  humanAudit(james, 'release_payment', { collaboration_id: elena.id, deliverable_id: et1.id, amount: 300 }, 'Released $300 to @elena_beauty.', radiance.id, t(21, 9.5));
  humanAudit(creatorActor('cr_elena', 'Elena Rostova'), 'submit_deliverable', { deliverable_id: et2.id }, `Deliverable submitted on ${elena.id}; compliance flagged (67%).`, radiance.id, t(8, 15));
  humanAudit(james, 'review_deliverable', { deliverable_id: et2.id, decision: 'CHANGES_REQUESTED' }, `Deliverable changes requested on ${elena.id}.`, radiance.id, t(7, 10));
  humanAudit(creatorActor('cr_david', 'David Chen'), 'submit_deliverable', { deliverable_id: dr.id }, `Deliverable submitted on ${david.id}; compliance passed (100%).`, training.id, t(4, 17));
  humanAudit(creatorActor('cr_marcus', 'Marcus Vance'), 'submit_deliverable', { deliverable_id: mv.id }, `Deliverable submitted on ${marcus.id}; compliance passed (100%).`, earbuds.id, t(3, 15));
  humanAudit(maya, 'review_deliverable', { deliverable_id: mv.id, decision: 'APPROVED' }, `Deliverable approved on ${marcus.id}.`, earbuds.id, t(2, 10));
  humanAudit(sam, 'create_campaign', { title: mealkit.title, budget: 18000 }, `Campaign "${mealkit.title}" created with $18,000 budget.`, mealkit.id, t(6, 10));
  humanAudit(lena, 'send_collaboration_offer', { creator_id: 'cr_zara', proposed_rate: 1100 }, 'Offer of $1,100 sent to @zaralifts for "Apex 6-Week Hybrid Program".', training.id, t(3, 10));

  pendingAudits.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? '')).forEach((e) => appendAudit(e));

  // ---------------------------------------------------------------- evaluation history
  const evals = [
    ['tech_launch', 'Tech product launch (YouTube + IG)', 'MANUAL', 172800, 395, 84.0, 20, 2, 2], ['tech_launch', 'Tech product launch (YouTube + IG)', 'AGENTIC', 144, 15, 92.0, 8, 2, 1],
    ['beauty_ugc', 'Beauty UGC burst (TikTok + IG)', 'MANUAL', 201600, 447, 82.5, 25, 3, 3], ['beauty_ugc', 'Beauty UGC burst (TikTok + IG)', 'AGENTIC', 131, 18, 90.5, 9, 2, 1],
    ['fitness_program', 'Fitness program ambassadors', 'MANUAL', 158400, 342, 86.0, 15, 2, 2], ['fitness_program', 'Fitness program ambassadors', 'AGENTIC', 158, 14, 93.0, 7, 2, 1],
  ] as const;
  evals.forEach((e, i) => execute(`INSERT INTO evaluation_runs (id, scenario_name, scenario_key, workflow_type, time_to_launch_sec, human_minutes, matching_accuracy_pct, creators_evaluated, offers_sent, approvals_required, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [`eval_seed_${i}`, e[1], e[0], e[2], e[3], e[4], e[5], e[6], e[7], e[8], e[2] === 'MANUAL' ? 'Modelled manual workflow baseline.' : 'Measured against the governed MCP server (seeded history).', daysAgo(30 - i * 4)]));

  // ---------------------------------------------------------------- backdate for realistic timelines
  const bd = (table: string, id: string, d: number, h = 10, cols?: string[]) => backdate(table, id, daysAgo(d, h), cols);
  bd('campaigns', holiday.id, 95, 10, ['created_at', 'updated_at']);
  bd('collaborations', holidayCollab.id, 80, 10, ['created_at', 'updated_at']);
  bd('collaborations', holidayLiam.id, 78, 10, ['created_at', 'updated_at']);
  bd('collaborations', marcus.id, 19, 9, ['created_at']);
  bd('collaborations', priya.id, 19, 9, ['created_at']);
  bd('collaborations', liam.id, 19, 9, ['created_at']);
  bd('collaborations', elena.id, 30, 10, ['created_at']);
  bd('collaborations', amara.id, 27, 10, ['created_at']);
  bd('collaborations', hana.id, 29, 10, ['created_at', 'updated_at']);
  bd('collaborations', david.id, 36, 10, ['created_at']);
  bd('collaborations', zara.id, 3, 10, ['created_at', 'updated_at']);
  const ledgerRows = queryAll<any>(`SELECT id, campaign_id, entry_type, seq FROM ledger_entries ORDER BY seq`);
  const spread: Record<string, number> = { [holiday.id]: 85, [earbuds.id]: 19, [radiance.id]: 30, [training.id]: 36, [mealkit.id]: 6 };
  const perCampaign: Record<string, number> = {};
  for (const l of ledgerRows) {
    const base = spread[l.campaign_id] ?? 10;
    perCampaign[l.campaign_id] = (perCampaign[l.campaign_id] ?? 0) + 1;
    const offset = Math.min(base - 1, perCampaign[l.campaign_id] * (l.campaign_id === holiday.id ? 6 : l.campaign_id === radiance.id ? 3 : 2));
    run(`UPDATE ledger_entries SET created_at = ? WHERE id = ?`, [daysAgo(base - offset, 11), l.id]);
  }
  for (const m of queryAll<any>(`SELECT id, collaboration_id FROM negotiation_messages ORDER BY created_at`)) {
    const col = queryOne<any>(`SELECT created_at FROM collaborations WHERE id = ?`, [m.collaboration_id]);
    const n = queryOne<{ n: number }>(`SELECT COUNT(*) n FROM negotiation_messages WHERE collaboration_id = ? AND created_at <= (SELECT created_at FROM negotiation_messages WHERE id = ?)`, [m.collaboration_id, m.id])?.n ?? 1;
    run(`UPDATE negotiation_messages SET created_at = ? WHERE id = ?`, [new Date(new Date(col.created_at).getTime() + n * 26 * 3600000).toISOString(), m.id]);
  }
  for (const d of queryAll<any>(`SELECT d.id, d.submitted_at, d.approved_at, d.paid_at, c.created_at cat FROM deliverables d JOIN collaborations c ON c.id = d.collaboration_id`)) {
    const base = new Date(d.cat).getTime();
    if (d.submitted_at) run(`UPDATE deliverables SET submitted_at = ? WHERE id = ?`, [new Date(base + 6 * 86400000).toISOString(), d.id]);
    if (d.approved_at) run(`UPDATE deliverables SET approved_at = ? WHERE id = ?`, [new Date(base + 7 * 86400000).toISOString(), d.id]);
    if (d.paid_at) run(`UPDATE deliverables SET paid_at = ? WHERE id = ?`, [new Date(base + 8 * 86400000).toISOString(), d.id]);
  }
  run(`UPDATE notifications SET read = 1 WHERE created_at < ?`, [daysAgo(2)]);
  run(`UPDATE approval_checkpoints SET created_at = ? WHERE action_type = 'PAYMENT_ABOVE_THRESHOLD'`, [daysAgo(1, 9)]);
  run(`UPDATE approval_checkpoints SET created_at = ? WHERE action_type = 'OUT_OF_BAND_RATE'`, [daysAgo(0, 8)]);
  run(`UPDATE approval_checkpoints SET created_at = ? WHERE action_type = 'AGENT_ESCALATION'`, [daysAgo(0, 8.2)]);
  run(`UPDATE campaign_shortlist SET created_at = ? WHERE campaign_id = ?`, [daysAgo(19, 9.05), earbuds.id]);

  const counts = {
    brands: queryOne<any>(`SELECT COUNT(*) n FROM brands`)?.n, creators: queryOne<any>(`SELECT COUNT(*) n FROM creators`)?.n, campaigns: queryOne<any>(`SELECT COUNT(*) n FROM campaigns`)?.n,
    collaborations: queryOne<any>(`SELECT COUNT(*) n FROM collaborations`)?.n, ledger: queryOne<any>(`SELECT COUNT(*) n FROM ledger_entries`)?.n, audit: queryOne<any>(`SELECT COUNT(*) n FROM audit_logs`)?.n, checkpoints: queryOne<any>(`SELECT COUNT(*) n FROM approval_checkpoints`)?.n,
  };
  log(`Seeded: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}.`);
  log('Demo logins (password demo1234): maya@techpulse.audio · james@glowbotanicals.com · lena@apexathletics.co · sam@omnimedia.co · ava@elevate.io · marcus@creator.cmi · elena@creator.cmi · david@creator.cmi');
}

/** Seed on first boot if the database is empty. */
export function ensureSeeded(): void {
  const n = queryOne<{ n: number }>(`SELECT COUNT(*) n FROM users`)?.n ?? 0;
  if (n === 0) runSeed();
}

if (require.main === module) {
  runSeed();
}
