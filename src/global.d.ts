import type messages from "../messages/en.json";
import type { Locale } from "@/i18n/config";

// Type-checks every translation key against the English messages file.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
