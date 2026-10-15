-- Apply in the Supabase SQL Editor or with the Supabase CLI after reviewing the project target.
create table if not exists public.products (
  id text primary key,
  slug text not null unique,
  name text not null,
  category text not null,
  description text not null default '',
  image_url text not null default '',
  size_label text not null default '',
  image_tone text not null default '#e8dfd5',
  tagline text,
  price_xof integer not null check (price_xof >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  shipping_city text not null,
  shipping_district text not null,
  shipping_address text not null,
  customer_note text,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  product_total_xof integer not null check (product_total_xof >= 0),
  delivery_fee_xof integer not null check (delivery_fee_xof >= 0),
  total_xof integer not null check (total_xof >= 200),
  order_status text not null check (order_status in ('awaiting_payment','processing','preparing','shipped','delivered','cancelled','payment_failed')),
  payment_status text not null check (payment_status in ('pending','paid','failed','initialization_failed','refunded')),
  geniuspay_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Initial catalogue for visual setup only: confirm products, prices, stock and imagery before publishing.
insert into public.products (id, slug, name, category, description, image_url, size_label, image_tone, tagline, price_xof, stock, is_available)
values
  ('savon-noir', 'savon-noir-beldi', 'Savon noir beldi', 'Rituel hammam', 'La pâte végétale traditionnelle qui prépare la peau au rituel du hammam.', 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85', '200 g', '#eadfd2', 'Le rituel', 8500, 0, false),
  ('huile-argan', 'huile-d-argan-pure', 'Huile d’argan pure', 'Huiles précieuses', 'Une huile dorée et généreuse, à intégrer à votre rituel visage et corps.', 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=900&q=85', '50 ml', '#e5d6b9', 'Origine Maroc', 14500, 0, false),
  ('huile-baobab', 'huile-de-baobab', 'Huile de baobab', 'Huiles précieuses', 'Une huile végétale inspirée des arbres majestueux de nos terres.', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=85', '50 ml', '#dfd0c5', 'Soin essentiel', 12000, 0, false),
  ('ghassoul', 'ghassoul-poudre-minerale', 'Ghassoul minéral', 'Rituel hammam', 'L’argile volcanique du Maroc pour un moment de soin tout en douceur.', 'https://images.unsplash.com/photo-1600428853876-fb5a850b444f?auto=format&fit=crop&w=900&q=85', '250 g', '#d9c9bc', 'Naturellement', 9500, 0, false)
on conflict (id) do nothing;

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (order_status, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('zayna-products', 'zayna-products', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

alter table public.products enable row level security;
alter table public.orders enable row level security;

revoke all on public.products, public.orders from anon, authenticated;
grant select on public.products to anon, authenticated;
create policy "Published products are visible to everyone" on public.products
  for select to anon, authenticated using (is_available);

-- The bucket serves public product images. Upload, list, replace and delete are restricted to admins.
create policy "Admins can read product image objects" on storage.objects
  for select to authenticated using (bucket_id = 'zayna-products' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can upload product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'zayna-products' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can replace product images" on storage.objects
  for update to authenticated using (bucket_id = 'zayna-products' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check (bucket_id = 'zayna-products' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can delete product images" on storage.objects
  for delete to authenticated using (bucket_id = 'zayna-products' and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Orders and payment state are accessed only by server routes with the server-only Supabase secret key.
