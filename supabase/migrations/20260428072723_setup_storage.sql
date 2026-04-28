-- Create a public bucket for screenshots
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do update set public = true;

-- Allow anonymous uploads (anyone with the anon key can upload)
create policy "Allow anonymous uploads"
on storage.objects for insert
to public
with check (bucket_id = 'screenshots');

-- Allow public access to screenshots
create policy "Allow public view"
on storage.objects for select
to public
using (bucket_id = 'screenshots');
