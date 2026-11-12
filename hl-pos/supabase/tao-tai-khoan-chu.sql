-- Chạy 1 lần sau khi tạo tài khoản đăng nhập đầu tiên trong Supabase (Authentication → Users → Add user).
-- Sửa email trong dấu nháy ở dòng 'where email = ...' thành đúng email vừa tạo, rồi bấm Run.
insert into public.profiles (id, full_name, role)
select id, 'Hiếu', 'owner' from auth.users where email = 'EMAIL_CUA_BAN@gmail.com'
on conflict (id) do update set role = 'owner';
