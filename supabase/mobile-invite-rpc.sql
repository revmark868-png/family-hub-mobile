-- Family Hub Mobile invite join support
-- Run once in Supabase SQL Editor before testing mobile deep-link invite joins.

create or replace function public.join_family_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9-]', '', 'g'));
  v_existing_family_id uuid;
  v_existing_family_name text;
  v_target_family_id uuid;
  v_target_family_name text;
  v_target_role text := 'member';
  v_invite_id uuid;
  v_invite_status text;
  v_invite_expires_at timestamptz;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'Sign in before joining a family.');
  end if;

  if v_code = '' then
    return jsonb_build_object('ok', false, 'message', 'Paste an invite code first.');
  end if;

  select fm.family_id, f.name
    into v_existing_family_id, v_existing_family_name
  from public.family_members fm
  left join public.families f on f.id = fm.family_id
  where fm.user_id = v_user_id
    and fm.status = 'active'
  limit 1;

  select fi.id, fi.family_id, fi.role, fi.status, fi.expires_at, f.name
    into v_invite_id, v_target_family_id, v_target_role, v_invite_status, v_invite_expires_at, v_target_family_name
  from public.family_invites fi
  left join public.families f on f.id = fi.family_id
  where upper(fi.code) = v_code
  limit 1;

  if v_invite_id is not null then
    if v_invite_status = 'accepted' then
      return jsonb_build_object('ok', false, 'message', 'This invite link has already been used. Please ask for a new one.');
    end if;
    if v_invite_status = 'revoked' then
      return jsonb_build_object('ok', false, 'message', 'This invite link was revoked. Please ask for a new invite link.');
    end if;
    if v_invite_status = 'expired' or (v_invite_expires_at is not null and v_invite_expires_at < now()) then
      update public.family_invites set status = 'expired' where id = v_invite_id and status = 'pending';
      return jsonb_build_object('ok', false, 'message', 'This invite link has expired. Please ask for a new invite link.');
    end if;
  else
    select f.id, f.name
      into v_target_family_id, v_target_family_name
    from public.families f
    where upper(f.invite_code) = v_code
    limit 1;

    v_target_role := 'member';
  end if;

  if v_target_family_id is null then
    return jsonb_build_object('ok', false, 'message', 'That invite code does not exist or is no longer active.');
  end if;

  if v_existing_family_id is not null and v_existing_family_id <> v_target_family_id then
    return jsonb_build_object('ok', false, 'message', 'You already belong to ' || coalesce(v_existing_family_name, 'another family') || '. Leave that family before joining a different one.');
  end if;

  insert into public.family_members (family_id, user_id, role, status)
  values (v_target_family_id, v_user_id, coalesce(v_target_role, 'member'), 'active')
  on conflict (family_id, user_id)
  do update set role = excluded.role, status = 'active';

  if v_invite_id is not null then
    update public.family_invites
       set status = 'accepted', accepted_by = v_user_id, accepted_at = now()
     where id = v_invite_id
       and status = 'pending';
  end if;

  return jsonb_build_object('ok', true, 'familyName', coalesce(v_target_family_name, 'your family'));
end;
$$;

grant execute on function public.join_family_by_code(text) to authenticated;
