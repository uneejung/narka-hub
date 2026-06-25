import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iogenimoqzoklogosagg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZ2VuaW1vcXpva2xvZ29zYWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjU5ODAsImV4cCI6MjA5NzkwMTk4MH0.bVsj6-P0cXZ6qfbVulSomlR0e6bRRYx4S8BOIYjh1hw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
