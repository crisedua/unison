import type { BrainValues } from "@/lib/brain/facts";
import type { CampaignGoal, CampaignStatus } from "@/lib/campaigns/schema";
import type { ContentLanguage } from "@/lib/languages";
import type { OpportunityStage } from "@/lib/sales/schema";

export type Brand = BrainValues & {
  id: string;
  workspace_id: string;
  name: string;
  content_language: ContentLanguage;
  updated_at: string;
};

export type BrandSummary = Pick<Brand, "id" | "name" | "content_language">;

export type BrandDocument = {
  id: string;
  kind: "note" | "file";
  title: string;
  content: string;
  file_name: string | null;
  truncated: boolean;
  created_at: string;
};

export type Studio = "content" | "campaign" | "sales" | "results";

export type GenerationRow = {
  id: string;
  studio: Studio;
  title: string;
  input: Record<string, unknown>;
  output: unknown;
  facts_used: string[];
  language: string;
  model: string;
  campaign_id: string | null;
  opportunity_id: string | null;
  created_at: string;
};

export type Campaign = {
  id: string;
  brand_id: string;
  name: string;
  goal: CampaignGoal;
  status: CampaignStatus;
  variant_a: string;
  variant_b: string;
  conversion_label: string;
  metrics: unknown;
  created_at: string;
  updated_at: string;
};

export type Opportunity = {
  id: string;
  brand_id: string;
  company_name: string;
  contact_name: string;
  contact_role: string;
  stage: OpportunityStage;
  created_at: string;
  updated_at: string;
};

export type OpportunityNote = {
  id: string;
  content: string;
  created_at: string;
};

export type DraftRow = {
  id: string;
  generation_id: string | null;
  asset_type: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};
