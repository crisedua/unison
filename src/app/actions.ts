"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { ACTIVE_BRAND_COOKIE, getReadyContext } from "@/lib/context";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function switchBrand(brandId: string) {
  const ctx = await getReadyContext();
  if (!ctx?.brands.some((brand) => brand.id === brandId)) return { ok: false as const };
  (await cookies()).set(ACTIVE_BRAND_COOKIE, brandId, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: true,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
