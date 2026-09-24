"use client";

import { useTranslations } from "next-intl";
import { FUNNEL_STAGES, type CampaignBrief } from "@/lib/campaigns/schema";

/** The whole marketing plan as one Markdown document, in the interface language. */
export function useBriefMarkdown() {
  const t = useTranslations("campaigns.brief");
  const tChannels = useTranslations("campaigns.channels");

  return (brief: CampaignBrief): string => {
    const out: string[] = [`# ${brief.title}`, brief.summary, `**${t("successMeasure")}:** ${brief.success_measure}`];

    out.push(`## ${t("audiences")}`, ...brief.audiences.map((a) => `- **${a.segment}:** ${a.message}`));

    if (brief.strategy) {
      out.push(`## ${t("strategy")}`, `**${t("positioning")}:** ${brief.strategy.positioning}`, `### ${t("funnel")}`);
      for (const stage of FUNNEL_STAGES) {
        for (const step of brief.strategy.funnel.filter((s) => s.stage === stage)) {
          out.push(
            `#### ${t(`funnelStages.${stage}`)}`,
            step.goal,
            `- ${step.channels.map((c) => tChannels(c)).join(", ")}`,
            `- ${t("tactics")}: ${step.tactics}`,
          );
        }
      }
      if (brief.tracking?.length) {
        out.push(`### ${t("tracking")}`, ...brief.tracking.map((step, i) => `${i + 1}. ${step}`));
      }
    }

    if (brief.channel_plans?.length) {
      out.push(`## ${t("channelPlans")}`);
      for (const plan of brief.channel_plans) {
        out.push(
          `### ${tChannels(plan.channel)} (${plan.budget_share_percent > 0 ? t("budgetShare", { percent: plan.budget_share_percent }) : t("organic")})`,
          plan.role,
          `- **${t("targeting")}:** ${plan.targeting}`,
          `- **${t("setup")}:** ${plan.setup}`,
          `- **${t("formats")}:** ${plan.formats}`,
          `- **${t("cadence")}:** ${plan.cadence}`,
          `- **${t("kpi")}:** ${plan.kpi}`,
        );
      }
    }

    if (brief.email_program) {
      const email = brief.email_program;
      out.push(
        `## ${t("email")}`,
        `**${t("listBuilding")}:** ${email.list_building}`,
        `**${t("segments")}:**`,
        ...email.segments.map((s) => `- ${s}`),
        `### ${t("sequence")}`,
      );
      for (const e of [...email.sequence].sort((a, b) => a.send_day - b.send_day)) {
        out.push(
          `#### ${t("sendDay", { day: e.send_day })}: ${e.subject}`,
          `*${e.segment} · ${e.purpose}*`,
          `${t("previewText")}: ${e.preview_text}`,
          e.body,
          `**${t("cta")}:** ${e.cta}`,
        );
      }
      if (email.automations.length) {
        out.push(`### ${t("automations")}`, ...email.automations.map((a) => `- **${a.trigger}:** ${a.action}`));
      }
    }

    out.push(`## ${t("angles")}`);
    for (const angle of brief.angles) {
      out.push(`### ${angle.name}`, angle.insight, `> ${angle.opening_line}`);
    }

    const test = brief.ab_test;
    out.push(
      `## ${t("abTest")}`,
      `- **${t("variant", { name: "A" })}:** ${test.variant_a.headline} (${test.variant_a.angle}). ${test.variant_a.message}`,
      `- **${t("variant", { name: "B" })}:** ${test.variant_b.headline} (${test.variant_b.angle}). ${test.variant_b.message}`,
      `- **${t("hypothesis")}:** ${test.hypothesis}`,
      `- **${t("metric")}:** ${test.metric}`,
      `- **${t("testLength")}:** ${test.duration_days}`,
      `- **${t("audienceAndBudget")}:** ${test.audience_and_budget}`,
      `- **${t("decisionRule")}:** ${test.decision_rule}`,
    );

    out.push(`## ${t("launchPlan")}`, ...brief.launch_plan.map((s) => `- **${s.when}** · ${tChannels(s.channel)}: ${s.action}`));

    out.push(`## ${t("assets")}`);
    for (const asset of brief.channel_assets) {
      out.push(`### ${tChannels(asset.channel)}: ${asset.title}`, asset.copy);
    }

    return out.join("\n\n") + "\n";
  };
}
