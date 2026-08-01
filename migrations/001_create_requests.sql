CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('Pickles', 'Ranch')),
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  style TEXT NOT NULL,
  quantity TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'In Progress', 'Ready', 'Complete')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_category ON requests (category);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);
