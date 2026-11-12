-- 0001: tài khoản, vai trò, thông tin cửa hàng

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
$$;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, update (full_name, role) on public.profiles to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (true);
-- Chủ sửa hồ sơ người khác (không tự hạ quyền mình để tránh cửa hàng mất chủ)
create policy profiles_owner_update on public.profiles for update to authenticated
  using (public.is_owner() and id <> auth.uid())
  with check (public.is_owner());

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  name text not null,
  address text not null default '',
  phone text not null default '',
  note text
);
insert into public.store_settings (name, address, phone)
values ('Nội Thất Hùng Loan', 'Làng nghề Hà Lâm 1 – Thư Lâm – Hà Nội', '0916.771.586 – 0961.761.868');

alter table public.store_settings enable row level security;
revoke all on public.store_settings from anon, authenticated;
grant select, update (name, address, phone, note) on public.store_settings to authenticated;
create policy store_read on public.store_settings for select to authenticated using (true);
create policy store_owner_update on public.store_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

revoke execute on function public.is_owner() from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
