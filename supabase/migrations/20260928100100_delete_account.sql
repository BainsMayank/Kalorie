-- Kalorie — Stage 11a: "Delete my account and data" (Profile → Account).
--
-- The app calls this with supabase.rpc('delete_my_account'). It deletes the signed-in person
-- from auth.users; every table in 20260928100000_user_data.sql says `on delete cascade`, so all
-- their rows go with it, and Supabase's own auth tables drop their sign-in sessions too.
--
-- Why a database function: removing a sign-in account needs more rights than the app's key
-- has. `security definer` runs this one function with the rights of its owner (postgres), so
-- the app never needs the service_role key. It can only ever delete the person who calls it:
-- the id comes from their own sign-in token (auth.uid()), never from the app.
--
-- `set search_path = ''` makes every name below fully spelled out (auth.users), so nobody can
-- trick the function with a look-alike table in another schema.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  delete from auth.users where id = me;
end;
$$;

-- Only signed-in people may call it (Supabase lets everyone run new functions by default).
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
