-- D1 schema for the course API (tutor-proxy/api.js).
-- Apply with:  npx wrangler d1 execute deep-learning-lab --remote --file schema.sql
-- No table stores IP addresses. `sync` rows are reachable only with their 100-bit code.

CREATE TABLE IF NOT EXISTS sync (
  code    TEXT PRIMARY KEY,          -- the learner's private sync code
  data    TEXT NOT NULL,             -- their learning record, reading progress and notes (JSON)
  updated INTEGER NOT NULL,          -- ms since epoch
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stats (
  qid     TEXT PRIMARY KEY,          -- question id, e.g. c:1.1:3:1 (checkpoint), q:2.3:4 (quiz), e:… (explain), lab:1.1|spiral-lab
  right   INTEGER NOT NULL DEFAULT 0,
  wrong   INTEGER NOT NULL DEFAULT 0,
  updated INTEGER
);

CREATE TABLE IF NOT EXISTS certs (
  id      TEXT PRIMARY KEY,          -- 10-character certificate id
  data    TEXT NOT NULL,             -- name, modules passed, counts, dates (JSON)
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS challenge_scores (
  id      TEXT NOT NULL,             -- lab challenge id, e.g. spiral-small
  value   REAL NOT NULL,             -- the learner's result (e.g. parameters used, steps taken)
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS challenge_scores_id ON challenge_scores (id, value);
