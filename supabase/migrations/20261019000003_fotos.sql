-- Fotos dos pratos: bucket público para leitura; só o administrador carrega, troca ou apaga.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pratos', 'pratos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do nothing;

create policy "admin carrega fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'pratos' and (select public.is_admin()));
create policy "admin troca fotos" on storage.objects for update to authenticated
  using (bucket_id = 'pratos' and (select public.is_admin()));
create policy "admin apaga fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'pratos' and (select public.is_admin()));
