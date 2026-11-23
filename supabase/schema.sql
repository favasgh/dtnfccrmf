-- ============================================================
-- Double Tap CRM — Full Database Schema
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- 0. Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PRODUCTS
-- ============================================================
create table products (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  price       numeric(10,2) not null,
  my_cost     numeric(10,2) not null,
  category    text not null check (category in ('card','service')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table products enable row level security;
create policy "user_products" on products
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 2. LEADS
-- ============================================================
create table leads (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text not null,
  business_name        text,
  business_type        text,
  phone                text,
  source               text check (source in (
                         'instagram','google_maps','referral',
                         'meta_ad','walk_in','other'
                       )),
  stage                text not null default 'New' check (stage in (
                         'New','Contacted','Replied','Interested',
                         'Sample Shown','Negotiating','Won','Lost',
                         'Follow Up Later'
                       )),
  interested_product   text,
  objection            text,
  notes                text,
  next_follow_up_date  date,
  created_at           timestamptz not null default now()
);

alter table leads enable row level security;
create policy "user_leads" on leads
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 3. CUSTOMERS
-- ============================================================
create table customers (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  business_name   text,
  phone           text,
  email           text,
  address         text,
  lead_id         uuid references leads(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

alter table customers enable row level security;
create policy "user_customers" on customers
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 4. ORDERS
-- ============================================================
create sequence order_number_seq start 1;

create table orders (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  order_no            text not null unique
                        default 'DT-' || lpad(nextval('order_number_seq')::text, 3, '0'),
  customer_id         uuid not null references customers(id) on delete restrict,
  order_date          date not null default current_date,
  status              text not null default 'Awaiting Advance' check (status in (
                        'Awaiting Advance','In Progress','At Printo',
                        'Ready','Delivered','Closed','Cancelled'
                      )),
  advance_amount      numeric(10,2) not null default 0,
  advance_date        date,
  delivery_charge     numeric(10,2) not null default 0,
  sent_to_printo_date date,
  card_ready_date     date,
  encoding_done       boolean not null default false,
  profile_ready       boolean not null default false,
  delivery_date       date,
  balance_received    boolean not null default false,
  link_confirmed      boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now()
);

alter table orders enable row level security;
create policy "user_orders" on orders
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Business rule: cannot move past 'Awaiting Advance' without advance
create or replace function check_advance_before_progress()
returns trigger as $$
begin
  if NEW.status != 'Awaiting Advance'
     and NEW.status != 'Cancelled'
     and (NEW.advance_amount is null or NEW.advance_amount <= 0) then
    raise exception 'Cannot move order past Awaiting Advance without an advance payment.';
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_check_advance
  before update on orders
  for each row execute function check_advance_before_progress();

-- ============================================================
-- 5. ORDER ITEMS
-- ============================================================
create table order_items (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  order_id    uuid not null references orders(id) on delete cascade,
  product_id  uuid references products(id) on delete set null,
  description text not null,
  qty         integer not null default 1 check (qty > 0),
  unit_price  numeric(10,2) not null,
  created_at  timestamptz not null default now()
);

alter table order_items enable row level security;
create policy "user_order_items" on order_items
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 6. ACTIVITIES
-- ============================================================
create table activities (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  lead_id     uuid references leads(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  type        text not null check (type in ('call','whatsapp','note','follow_up')),
  text        text not null,
  created_at  timestamptz not null default now(),
  check (
    (lead_id is not null and customer_id is null) or
    (lead_id is null and customer_id is not null)
  )
);

alter table activities enable row level security;
create policy "user_activities" on activities
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 7. SETTINGS (single row per user, JSONB data)
-- ============================================================
create table settings (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table settings enable row level security;
create policy "user_settings" on settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 8. WHATSAPP TEMPLATES
-- ============================================================
create table whatsapp_templates (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  template   text not null,
  created_at timestamptz not null default now()
);

alter table whatsapp_templates enable row level security;
create policy "user_wa_templates" on whatsapp_templates
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 9. VIEW: orders with computed totals
-- ============================================================
create or replace view orders_with_totals as
select
  o.*,
  coalesce(t.total_amount, 0)                              as total_amount,
  coalesce(t.total_amount, 0) + o.delivery_charge - o.advance_amount as balance_due,
  coalesce(t.profit, 0)                                    as profit
from orders o
left join lateral (
  select
    sum(oi.qty * oi.unit_price)                             as total_amount,
    sum(oi.qty * (oi.unit_price - coalesce(p.my_cost, 0))) as profit
  from order_items oi
  left join products p on p.id = oi.product_id
  where oi.order_id = o.id
) t on true;

-- ============================================================
-- Done! Now sign up in the app, and the seed data will be
-- inserted automatically on your first visit to /products.
-- ============================================================
