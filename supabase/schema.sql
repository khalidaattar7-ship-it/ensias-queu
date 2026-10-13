-- ENSIAS Founders — file d'attente des stands (projet Supabase DÉDIÉ, sans lien avec l'inscription).
-- À exécuter une fois dans SQL Editor, puis exécuter supabase/pins.local.sql (PINs, non versionné).
--
-- Modèle : un compteur par cellule.
--   last_issued  = dernier numéro distribué
--   now_serving  = numéro actuellement appelé (0 = personne encore)
--   epoch        = incrémenté à chaque remise à zéro (invalide les anciens tickets côté navigateur)
-- Les visiteurs lisent `queues` ; toute écriture passe par les fonctions ci-dessous.

create extension if not exists pgcrypto with schema extensions;

create table public.queues (
  cell_slug   text primary key,
  cell_name   text not null,
  last_issued int  not null default 0,
  now_serving int  not null default 0,
  epoch       int  not null default 1,
  updated_at  timestamptz not null default now(),
  constraint queues_serving_le_issued check (now_serving between 0 and last_issued)
);

-- PINs hachés : aucune policy → illisibles pour anon/authenticated.
create table public.queue_pins (
  cell_slug       text primary key references public.queues on delete cascade,
  pin_hash        text not null,
  failed_attempts int  not null default 0,
  locked_until    timestamptz
);

alter table public.queues enable row level security;
alter table public.queue_pins enable row level security;

revoke all on public.queues, public.queue_pins from anon, authenticated;
grant select on public.queues to anon, authenticated;

create policy "queues_public_read" on public.queues
  for select to anon, authenticated using (true);

insert into public.queues (cell_slug, cell_name) values
  ('incubation-sponsoring', 'Incubation & Sponsoring'),
  ('design', 'Design'),
  ('media', 'Media'),
  ('training', 'Training'),
  ('event', 'Event');

-- ---------------------------------------------------------------------------
-- Vérification du PIN (interne). 5 erreurs de suite → verrouillage 30 s.
-- Renvoie null si OK, sinon 'pin' ou 'locked'. Pas d'exception : le compteur d'échecs est conservé.
-- ---------------------------------------------------------------------------

create function public.queue_pin_error(p_slug text, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.queue_pins;
begin
  select * into r from public.queue_pins where cell_slug = p_slug for update;
  if not found then
    return 'pin';
  end if;
  if r.locked_until is not null and r.locked_until > now() then
    return 'locked';
  end if;
  if r.pin_hash = crypt(coalesce(p_pin, ''), r.pin_hash) then
    update public.queue_pins set failed_attempts = 0, locked_until = null where cell_slug = p_slug;
    return null;
  end if;
  update public.queue_pins
    set failed_attempts = case when r.failed_attempts + 1 >= 5 then 0 else r.failed_attempts + 1 end,
        locked_until    = case when r.failed_attempts + 1 >= 5 then now() + interval '30 seconds' else null end
    where cell_slug = p_slug;
  return 'pin';
end;
$$;

revoke execute on function public.queue_pin_error(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Étudiant : prendre un numéro (atomique : deux clics simultanés → deux numéros distincts).
-- ---------------------------------------------------------------------------

create function public.take_ticket(p_slug text) returns json
language sql security definer set search_path = public as $$
  update public.queues
    set last_issued = last_issued + 1, updated_at = now()
    where cell_slug = p_slug
    returning json_build_object('ticket', last_issued, 'epoch', epoch);
$$;

-- ---------------------------------------------------------------------------
-- Responsable : vérifier le PIN, appeler le suivant, remettre à zéro.
-- Réponse : {"ok": true, ...} ou {"ok": false, "error": "pin" | "locked"}.
-- ---------------------------------------------------------------------------

create function public.verify_queue_pin(p_slug text, p_pin text) returns json
language plpgsql security definer set search_path = public as $$
declare
  err text := public.queue_pin_error(p_slug, p_pin);
begin
  if err is not null then
    return json_build_object('ok', false, 'error', err);
  end if;
  return json_build_object('ok', true);
end;
$$;

create function public.call_next(p_slug text, p_pin text) returns json
language plpgsql security definer set search_path = public as $$
declare
  err text := public.queue_pin_error(p_slug, p_pin);
  q public.queues;
begin
  if err is not null then
    return json_build_object('ok', false, 'error', err);
  end if;
  update public.queues
    set now_serving = least(now_serving + 1, last_issued), updated_at = now()
    where cell_slug = p_slug
    returning * into q;
  return json_build_object('ok', true, 'now_serving', q.now_serving, 'last_issued', q.last_issued);
end;
$$;

create function public.reset_queue(p_slug text, p_pin text) returns json
language plpgsql security definer set search_path = public as $$
declare
  err text := public.queue_pin_error(p_slug, p_pin);
begin
  if err is not null then
    return json_build_object('ok', false, 'error', err);
  end if;
  update public.queues
    set last_issued = 0, now_serving = 0, epoch = epoch + 1, updated_at = now()
    where cell_slug = p_slug;
  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.take_ticket(text) from public;
revoke execute on function public.verify_queue_pin(text, text) from public;
revoke execute on function public.call_next(text, text) from public;
revoke execute on function public.reset_queue(text, text) from public;
grant execute on function public.take_ticket(text) to anon, authenticated;
grant execute on function public.verify_queue_pin(text, text) to anon, authenticated;
grant execute on function public.call_next(text, text) to anon, authenticated;
grant execute on function public.reset_queue(text, text) to anon, authenticated;
