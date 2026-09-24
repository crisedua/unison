"use client";

import dynamic from "next/dynamic";

// Client-only: the finder restores the session's results from sessionStorage on its first render.
export const ProspectFinder = dynamic(() => import("./prospect-finder").then((m) => m.ProspectFinder), {
  ssr: false,
});
