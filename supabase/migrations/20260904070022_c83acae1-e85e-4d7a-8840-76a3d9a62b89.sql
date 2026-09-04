create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'trainee');
  final_role public.app_role;
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
        email = excluded.email;

  final_role := case when requested = 'trainer' then 'trainer'::public.app_role else 'trainee'::public.app_role end;

  insert into public.user_roles (user_id, role)
  values (new.id, final_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- backfill: everyone without any role becomes a trainee, everyone without a profile gets one
insert into public.profiles (id, full_name, email)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', ''), coalesce(u.email, '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

insert into public.user_roles (user_id, role)
select u.id, 'trainee'::public.app_role
from auth.users u
left join public.user_roles r on r.user_id = u.id
where r.user_id is null
on conflict (user_id, role) do nothing;

-- users may no longer self-assign roles; roles come from the trigger or an admin
drop policy if exists "self signup role" on public.user_roles;