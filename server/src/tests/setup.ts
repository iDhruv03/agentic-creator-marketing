// Imported first by every test file so the shared connection is in-memory.
process.env.CMI_DB_PATH = ':memory:';
process.env.CMI_SIM_PACE_MS = '0';
process.env.CMI_AUTO_SEED = 'false';
