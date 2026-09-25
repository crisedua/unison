-- Visual style for generated images (Reel covers and scenes).
-- Plain text the image prompts use; empty means "let the AI choose".

alter table public.unison_brands
  add column if not exists visual_colors text not null default '',
  add column if not exists visual_look text not null default '',
  add column if not exists visual_avoid text not null default '';
