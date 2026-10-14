-- Private bucket for optional personal visit photos.
-- Object paths must start with the owner's user id: <uid>/<file>.
insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', false)
on conflict (id) do nothing;

create policy "visit photos owner read" on storage.objects for select
  using (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "visit photos owner insert" on storage.objects for insert
  with check (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "visit photos owner delete" on storage.objects for delete
  using (bucket_id = 'visit-photos' and (storage.foldername(name))[1] = auth.uid()::text);
