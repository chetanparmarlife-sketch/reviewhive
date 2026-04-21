-- =============================================================================
-- ReviewHive seed data.
-- Safe to run on a fresh project. Idempotent via ON CONFLICT DO NOTHING guards.
--
-- NOTE: auth.users rows (admin, demo reviewers) must be created via the
-- Supabase Dashboard → Authentication → Users flow (see SETUP.md). Once the
-- admin user exists, the row auto-appears in public.profiles via the
-- on_auth_user_created trigger; then run:
--
--     update public.profiles set role='admin'
--     where email = 'you@yourdomain.com';
--
-- Sample applications are seeded only if a demo reviewer profile exists
-- whose email ends with '@demo.in' — otherwise skipped (see tail of file).
-- =============================================================================

-- ---------- BRANDS ----------
-- We embed SVG placeholders as data: URIs so the UI renders without external
-- assets. In production, replace these with real logos uploaded to the
-- brand-logos bucket.

with seed(name, industry, color, description) as (
  values
    ('HoneyLeaf',          'Personal Care',         '#d97706', 'Natural skincare and haircare made with Ayurvedic ingredients.'),
    ('SoundWave',          'Consumer Electronics',  '#0f172a', 'Audio gear built for Indian commuters and gym-goers.'),
    ('DreamCloud',         'Home & Sleep',          '#6366f1', 'Affordable orthopaedic mattresses and pillows, 100-night trial.'),
    ('Blossom & Co',       'Beauty',                '#ec4899', 'Clean, cruelty-free makeup for every Indian skin tone.'),
    ('PureBase',           'Skincare',              '#10b981', 'Dermat-tested minimalist actives. Transparent formulas.'),
    ('SugarKiss',          'Beauty',                '#f43f5e', 'Bold lipsticks, long-wear kajals, everyday glam.'),
    ('Maharaja Grooming',  'Men''s Grooming',       '#1f2937', 'Beard, hair, and body care for the modern Indian gentleman.'),
    ('The Honest Kitchen', 'Healthy Food',          '#b45309', 'Protein bars, nut butters, and snacks with clean labels.'),
    ('NestRest',           'Home Furnishing',       '#0891b2', 'Bedding, rugs, and home décor crafted in India.'),
    ('SparkFit',           'Fitness',               '#dc2626', 'Home fitness gear: resistance bands, yoga mats, dumbbells.')
)
insert into public.brands (name, industry, description, logo_url)
select
  s.name, s.industry, s.description,
  'data:image/svg+xml;utf8,' ||
    replace(
      '<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 80 80''>' ||
        '<rect width=''80'' height=''80'' rx=''16'' fill=''' || s.color || '''/>' ||
        '<text x=''50%'' y=''54%'' dominant-baseline=''middle'' text-anchor=''middle'' ' ||
          'font-family=''system-ui,sans-serif'' font-size=''40'' font-weight=''700'' fill=''#ffffff''>' ||
          substr(s.name, 1, 1) || '</text>' ||
      '</svg>',
      '''', '%27'
    )
from seed s
where not exists (select 1 from public.brands b where b.name = s.name);

-- ---------- CAMPAIGNS + PRODUCTS ----------
-- Use a do-block so we can loop and read generated brand ids.
do $$
declare
  now_ts timestamptz := now();
  rec record;
  brand_id_v uuid;
  campaign_id_v uuid;
  cover text;
  requirements_json jsonb;
begin

  -- HoneyLeaf Vitamin C Serum Launch
  select id into brand_id_v from public.brands where name = 'HoneyLeaf' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'HoneyLeaf Vitamin C Serum Launch') then
    cover := 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%20600%20300%27%3E%3Cdefs%3E%3ClinearGradient%20id%3D%27g%27%20x1%3D%270%27%20y1%3D%270%27%20x2%3D%271%27%20y2%3D%271%27%3E%3Cstop%20offset%3D%270%27%20stop-color%3D%27%23d97706%27/%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%23fbbf24%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%27600%27%20height%3D%27300%27%20fill%3D%27url%28%23g%29%27/%3E%3Ctext%20x%3D%2740%27%20y%3D%27170%27%20font-family%3D%27system-ui%27%20font-size%3D%2726%27%20font-weight%3D%27700%27%20fill%3D%27white%27%3EHoneyLeaf%20Vitamin%20C%20Serum%3C/text%3E%3C/svg%3E';
    requirements_json := '["Must have an Amazon India Prime account","Review must be 80+ words with honest experience","Attach at least 1 real product photo","Review must mention ingredients you liked"]'::jsonb;
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, cover_image_url, category)
    values ('HoneyLeaf Vitamin C Serum Launch', brand_id_v, 'amazon_in',
      'Help us launch our new Vitamin C + Niacinamide serum. Buy, try for 7 days, and leave an honest 4+ star review on Amazon India.',
      650, 50, 'live', now_ts - interval '3 days', now_ts + interval '14 days',
      requirements_json, cover, 'Skincare')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, 'Vitamin C Serum 30ml',           'B0HONEY001', 'https://www.amazon.in/dp/B0HONEY001', 499, 0),
      (campaign_id_v, 'Niacinamide Face Serum',         'B0HONEY002', 'https://www.amazon.in/dp/B0HONEY002', 449, 1),
      (campaign_id_v, 'Hydrating Gel Moisturizer',      'B0HONEY003', 'https://www.amazon.in/dp/B0HONEY003', 399, 2),
      (campaign_id_v, 'Under Eye Brightening Cream',    'B0HONEY004', 'https://www.amazon.in/dp/B0HONEY004', 549, 3);
  end if;

  -- SoundWave Neckband Review Drive
  select id into brand_id_v from public.brands where name = 'SoundWave' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'SoundWave Neckband Review Drive') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('SoundWave Neckband Review Drive', brand_id_v, 'flipkart',
      'We''re scaling our hero neckband product on Flipkart. Buy, use for a week, and share honest feedback with pictures.',
      850, 40, 'live', now_ts - interval '5 days', now_ts + interval '10 days',
      '["Flipkart Plus membership preferred","Review must include pros and cons honestly","Attach product photo in real usage","Rating: your honest rating (min 4 stars for payout)"]'::jsonb,
      'Electronics')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, 'Bass Pro Neckband — Black',     'SNDW001', 'https://www.flipkart.com/p/itmSNDW001', 1299, 0),
      (campaign_id_v, 'Bass Pro Neckband — Blue',      'SNDW002', 'https://www.flipkart.com/p/itmSNDW002', 1299, 1),
      (campaign_id_v, 'Studio Wireless Headphones',    'SNDW003', 'https://www.flipkart.com/p/itmSNDW003', 2199, 2);
  end if;

  -- DreamCloud Memory Foam Pillow
  select id into brand_id_v from public.brands where name = 'DreamCloud' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'DreamCloud Memory Foam Pillow') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('DreamCloud Memory Foam Pillow', brand_id_v, 'amazon_in',
      'Launching our orthopaedic memory foam pillow. We need 30 honest long-form reviews from real sleepers.',
      500, 30, 'live', now_ts - interval '1 day', now_ts + interval '20 days',
      '["Use the pillow for at least 5 nights before reviewing","Review 100+ words describing comfort, firmness","Mention if you sleep on back, side, or stomach"]'::jsonb,
      'Home')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, 'Orthopaedic Memory Foam Pillow', 'B0DREAM001', 'https://www.amazon.in/dp/B0DREAM001', 899, 0),
      (campaign_id_v, 'Cervical Contour Pillow',        'B0DREAM002', 'https://www.amazon.in/dp/B0DREAM002', 1099, 1),
      (campaign_id_v, 'Cooling Gel Pillow',             'B0DREAM003', 'https://www.amazon.in/dp/B0DREAM003', 1299, 2);
  end if;

  -- Blossom Matte Lipstick Collection
  select id into brand_id_v from public.brands where name = 'Blossom & Co' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'Blossom Matte Lipstick Collection') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('Blossom Matte Lipstick Collection', brand_id_v, 'meesho',
      'Review our new 12-shade matte lipstick range on Meesho. Honest feedback + a selfie with the shade.',
      400, 60, 'live', now_ts - interval '7 days', now_ts + interval '14 days',
      '["One selfie wearing the shade (can blur face)","Mention finish, longevity, and transfer","4+ star review for payout"]'::jsonb,
      'Beauty')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, 'Matte Lipstick — Rose Nude',   'BLS001', 'https://www.meesho.com/p/BLS001', 249, 0),
      (campaign_id_v, 'Matte Lipstick — Brick Red',   'BLS002', 'https://www.meesho.com/p/BLS002', 249, 1),
      (campaign_id_v, 'Matte Lipstick — Berry Wine',  'BLS003', 'https://www.meesho.com/p/BLS003', 249, 2),
      (campaign_id_v, 'Matte Lipstick Trio Pack',     'BLS004', 'https://www.meesho.com/p/BLS004', 649, 3);
  end if;

  -- PureBase Salicylic Acid Cleanser
  select id into brand_id_v from public.brands where name = 'PureBase' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'PureBase Salicylic Acid Cleanser') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('PureBase Salicylic Acid Cleanser', brand_id_v, 'amazon_in',
      'Our dermat-tested cleanser is up for review. Share your honest 2-week experience.',
      550, 35, 'live', now_ts - interval '2 days', now_ts + interval '18 days',
      '["Use for 14 days before reviewing","Mention your skin type","Before/after photos appreciated (not required)"]'::jsonb,
      'Skincare')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, '2% Salicylic Acid Cleanser 100ml', 'B0PURE001', 'https://www.amazon.in/dp/B0PURE001', 349, 0),
      (campaign_id_v, '10% Niacinamide Serum',            'B0PURE002', 'https://www.amazon.in/dp/B0PURE002', 499, 1),
      (campaign_id_v, '1% Retinol Night Cream',           'B0PURE003', 'https://www.amazon.in/dp/B0PURE003', 799, 2);
  end if;

  -- SugarKiss Kajal & Eyeliner Combo
  select id into brand_id_v from public.brands where name = 'SugarKiss' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'SugarKiss Kajal & Eyeliner Combo') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('SugarKiss Kajal & Eyeliner Combo', brand_id_v, 'flipkart',
      'Honest reviews wanted for our new smudge-proof kajal range on Flipkart.',
      350, 45, 'live', now_ts - interval '4 days', now_ts + interval '12 days',
      '["Minimum 60-word review","Mention smudge-proof claim verdict","Product photo required"]'::jsonb,
      'Beauty')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, 'Stay-Put Kajal — Jet Black', 'SK001', 'https://www.flipkart.com/p/itmSK001', 199, 0),
      (campaign_id_v, 'Liquid Eyeliner — Black',    'SK002', 'https://www.flipkart.com/p/itmSK002', 249, 1),
      (campaign_id_v, 'Kajal + Liner Duo',          'SK003', 'https://www.flipkart.com/p/itmSK003', 399, 2);
  end if;

  -- Maharaja Beard Oil Launch
  select id into brand_id_v from public.brands where name = 'Maharaja Grooming' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'Maharaja Beard Oil Launch') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('Maharaja Beard Oil Launch', brand_id_v, 'amazon_in',
      'Our new beard oil launch needs 25 honest reviews from men with 2+ week beards.',
      600, 25, 'live', now_ts - interval '6 days', now_ts + interval '10 days',
      '["Use for 2+ weeks","Mention beard length and texture","Share honest fragrance opinion"]'::jsonb,
      'Grooming')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, 'Argan Beard Oil 30ml',       'B0MHRJ001', 'https://www.amazon.in/dp/B0MHRJ001', 449, 0),
      (campaign_id_v, 'Beard Growth Serum',         'B0MHRJ002', 'https://www.amazon.in/dp/B0MHRJ002', 599, 1),
      (campaign_id_v, 'Beard Wash + Oil Combo',     'B0MHRJ003', 'https://www.amazon.in/dp/B0MHRJ003', 799, 2);
  end if;

  -- Honest Kitchen Protein Bar Sampler
  select id into brand_id_v from public.brands where name = 'The Honest Kitchen' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'Honest Kitchen Protein Bar Sampler') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('Honest Kitchen Protein Bar Sampler', brand_id_v, 'amazon_in',
      'Try our 6-pack protein bar sampler. Honest taste + texture feedback needed.',
      300, 80, 'live', now_ts - interval '8 days', now_ts + interval '20 days',
      '["Taste all 6 flavors","Rank your top 3 in the review","Mention if pre/post workout"]'::jsonb,
      'Food')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, 'Protein Bar Variety 6-pack', 'B0HK001', 'https://www.amazon.in/dp/B0HK001', 599, 0),
      (campaign_id_v, 'Peanut Butter Jar 450g',     'B0HK002', 'https://www.amazon.in/dp/B0HK002', 449, 1),
      (campaign_id_v, 'Mixed Nut Butter 250g',      'B0HK003', 'https://www.amazon.in/dp/B0HK003', 399, 2);
  end if;

  -- NestRest Cotton Bedsheet Set
  select id into brand_id_v from public.brands where name = 'NestRest' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'NestRest Cotton Bedsheet Set') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('NestRest Cotton Bedsheet Set', brand_id_v, 'meesho',
      'Review our 300TC cotton bedsheets on Meesho. Honest comfort + quality feedback.',
      450, 50, 'live', now_ts - interval '3 days', now_ts + interval '25 days',
      '["Wash once before reviewing","Mention GSM/feel in review","Photo on your bed appreciated"]'::jsonb,
      'Home')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, 'Queen Bedsheet — Floral',    'NR001', 'https://www.meesho.com/p/NR001', 649, 0),
      (campaign_id_v, 'King Bedsheet — Solid Sage', 'NR002', 'https://www.meesho.com/p/NR002', 749, 1),
      (campaign_id_v, 'Queen Bedsheet — Geometric', 'NR003', 'https://www.meesho.com/p/NR003', 649, 2);
  end if;

  -- SparkFit Resistance Bands
  select id into brand_id_v from public.brands where name = 'SparkFit' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'SparkFit Resistance Bands Set') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('SparkFit Resistance Bands Set', brand_id_v, 'flipkart',
      'Launch campaign for our 5-level resistance bands set. Use for a week, then review.',
      400, 40, 'live', now_ts - interval '1 day', now_ts + interval '14 days',
      '["Use for at least 5 workout sessions","Mention durability and grip","Honest rating + product photo"]'::jsonb,
      'Fitness')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, '5-Level Resistance Band Set', 'SF001', 'https://www.flipkart.com/p/itmSF001', 799, 0),
      (campaign_id_v, 'Yoga Mat 6mm — Navy',         'SF002', 'https://www.flipkart.com/p/itmSF002', 999, 1),
      (campaign_id_v, 'Skipping Rope Pro',           'SF003', 'https://www.flipkart.com/p/itmSF003', 349, 2);
  end if;

  -- HoneyLeaf Hair Oil — COMPLETED
  select id into brand_id_v from public.brands where name = 'HoneyLeaf' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'HoneyLeaf Hair Oil — Completed Batch') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('HoneyLeaf Hair Oil — Completed Batch', brand_id_v, 'amazon_in',
      'This campaign closed last week. Archive view for reference.',
      500, 40, 'completed', now_ts - interval '40 days', now_ts - interval '7 days',
      '["Use for 3 weeks","Honest 80+ word review"]'::jsonb, 'Hair')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, 'Bhringraj Hair Oil 100ml', 'B0HL001', 'https://www.amazon.in/dp/B0HL001', 399, 0),
      (campaign_id_v, 'Amla Hair Oil 200ml',      'B0HL002', 'https://www.amazon.in/dp/B0HL002', 449, 1);
  end if;

  -- SoundWave Earbuds — PAUSED
  select id into brand_id_v from public.brands where name = 'SoundWave' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'SoundWave Earbuds — Paused') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('SoundWave Earbuds — Paused', brand_id_v, 'flipkart',
      'Paused while we prepare new inventory. Will reopen soon.',
      900, 30, 'paused', now_ts - interval '10 days', now_ts + interval '20 days',
      '["7-day usage","Pros/cons in review"]'::jsonb, 'Electronics')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, 'TWS Earbuds Pro — Black', 'SNDW-TWS01', 'https://www.flipkart.com/p/SNDW-TWS01', 1699, 0),
      (campaign_id_v, 'TWS Earbuds Pro — White', 'SNDW-TWS02', 'https://www.flipkart.com/p/SNDW-TWS02', 1699, 1);
  end if;

  -- Blossom Foundation — DRAFT
  select id into brand_id_v from public.brands where name = 'Blossom & Co' limit 1;
  if brand_id_v is not null and not exists (select 1 from public.campaigns where title = 'Blossom Foundation Shade Expansion') then
    insert into public.campaigns (title, brand_id, marketplace, description, reward_amount, total_slots, status, start_date, end_date, requirements, category)
    values ('Blossom Foundation Shade Expansion', brand_id_v, 'meesho',
      'Draft campaign — launching next week across 12 shade expansion.',
      500, 60, 'draft', now_ts + interval '2 days', now_ts + interval '30 days',
      '["Photo wearing foundation","Mention skin type + tone"]'::jsonb, 'Beauty')
    returning id into campaign_id_v;

    insert into public.products (campaign_id, name, asin_or_id, marketplace_url, price, position) values
      (campaign_id_v, 'Matte Foundation 30ml', 'BLS-F01', 'https://www.meesho.com/p/BLS-F01', 499, 0);
  end if;

end $$;

-- =============================================================================
-- Optional: if a demo reviewer exists (profiles.email like '%@demo.in'), seed
-- sample applications + notifications so the reviewer UI has data to render.
-- =============================================================================
do $$
declare
  demo_user_id uuid;
  camp record;
  prod record;
begin
  select id into demo_user_id from public.profiles where email like '%@demo.in' limit 1;
  if demo_user_id is null then
    raise notice 'No demo reviewer profile found — skipping sample applications.';
    return;
  end if;

  -- Insert one demo notification
  insert into public.notifications (user_id, type, title, message, link)
  values (demo_user_id, 'welcome', 'Welcome to ReviewHive!',
    'Browse live campaigns and apply to start earning. Payouts hit your UPI within 48 hours.', '/#/campaigns')
  on conflict do nothing;

  -- Seed a paid application on HoneyLeaf if none exists for this user
  select c.* into camp from public.campaigns c where c.title = 'HoneyLeaf Vitamin C Serum Launch' limit 1;
  if camp.id is not null and not exists (
    select 1 from public.applications where user_id = demo_user_id and campaign_id = camp.id
  ) then
    select p.* into prod from public.products p where p.campaign_id = camp.id order by position limit 1;
    insert into public.applications (
      campaign_id, user_id, product_id, status, order_id,
      review_link, review_text, submitted_at, verified_at, paid_at, payout_utr
    )
    values (
      camp.id, demo_user_id, prod.id, 'paid',
      '171-1234567-0012345',
      'https://www.amazon.in/review/R123DEMO',
      'Absolutely loved this product. The quality is top-notch and it arrived in perfect packaging. Have been using it for over a week now and can confidently recommend it.',
      now() - interval '2 days',
      now() - interval '1 day',
      now() - interval '12 hours',
      'HDFC123456'
    );
  end if;
end $$;
