-- Kho ảnh đơn nội thất trên Supabase Storage (chạy 1 lần trên Supabase thật, KHÔNG nằm trong migrations vì bản test không có Storage).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('don-hang', 'don-hang', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "don-hang: thành viên xem" on storage.objects;
drop policy if exists "don-hang: thành viên tải lên" on storage.objects;
drop policy if exists "don-hang: người tải hoặc chủ xóa" on storage.objects;
create policy "don-hang: thành viên xem" on storage.objects for select to authenticated
  using (bucket_id = 'don-hang' and public.is_member());
create policy "don-hang: thành viên tải lên" on storage.objects for insert to authenticated
  with check (bucket_id = 'don-hang' and public.is_member());
create policy "don-hang: người tải hoặc chủ xóa" on storage.objects for delete to authenticated
  using (bucket_id = 'don-hang' and public.is_member() and (owner_id = auth.uid()::text or public.is_owner()));
