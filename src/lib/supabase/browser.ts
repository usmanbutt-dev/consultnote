"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfiguration } from "./config";

export function browserSupabase() {
  const { url, key } = supabaseConfiguration();
  return createBrowserClient(url, key);
}
