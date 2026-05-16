-- Optional reference image for campaign banner (product photo / brand asset)
alter table public.campaigns
  add column if not exists reference_image_url text;
