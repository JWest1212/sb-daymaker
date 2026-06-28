-- Phase 8: add 'shared_plan' to the shared_state_kind enum.
-- This is the only DB change in the Plan surface build.
-- Safe to run multiple times (IF NOT EXISTS guard).
alter type shared_state_kind add value if not exists 'shared_plan';
