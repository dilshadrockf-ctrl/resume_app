-- Core configuration rows (NOT user data). Idempotent; run after migrations.
INSERT INTO "Plan" (id, name, tagline, "priceCentsMonthly", "priceCentsAnnual", limits, features, highlighted)
VALUES
  ('free',   'Free',        'Everything you need to land the interview', 0, 0,
   '{"resumes":3,"exportPdf":true,"exportDocx":true,"aiActionsPerMonth":0,"templates":4,"versions":10,"jdMatches":5}',
   '["Unlimited editing","ATS-friendly templates","PDF & DOCX export","Career profile library","Application tracker"]', false),
  ('pro',    'Pro (BYO AI)','Local-first, with your own AI provider keys', 0, 0,
   '{"resumes":50,"exportPdf":true,"exportDocx":true,"aiActionsPerMonth":100000,"templates":6,"versions":100,"jdMatches":500}',
   '["Everything in Free","BYO OpenAI/Anthropic/Gemini/Ollama","Job-description tailoring","Cover letter drafts","Unlimited version history"]', true),
  ('team',   'Team',        'For career services & small teams', 0, 0,
   '{"resumes":500,"exportPdf":true,"exportDocx":true,"aiActionsPerMonth":1000000,"templates":6,"versions":500,"jdMatches":5000}',
   '["Everything in Pro","Shared template packs","CSV import/export","SSO-ready architecture"]', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, tagline = EXCLUDED.tagline, limits = EXCLUDED.limits, features = EXCLUDED.features;
