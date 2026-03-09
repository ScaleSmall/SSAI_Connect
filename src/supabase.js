import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oyyfpkpzalhxztpcdjgq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eWZwa3B6YWxoeHp0cGNkamdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2MDI1OTMsImV4cCI6MjA1NzE3ODU5M30.zU9KP263uxuHgk3CvS1NlRPEoZyQALUqo4Dl9L0fZ6Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export { SUPABASE_URL };
