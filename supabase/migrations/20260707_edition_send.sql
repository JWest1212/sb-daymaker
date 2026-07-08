-- Reader Edition — send path support (spec §7.5). Atomic increments for the
-- Resend webhook handler (open/click events can arrive concurrently and in
-- bursts; a read-then-write from the API route would race).

create or replace function increment_edition_open(p_edition_id uuid)
returns void as $$
  update editions set open_count = open_count + 1 where id = p_edition_id;
$$ language sql;

create or replace function increment_edition_click(p_edition_id uuid)
returns void as $$
  update editions set click_count = click_count + 1 where id = p_edition_id;
$$ language sql;

-- Both are called only from the webhook route via the service-role client
-- (bypasses RLS already), so no SECURITY DEFINER / public grant needed.
