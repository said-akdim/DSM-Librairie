import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yvlfvrxzfyhatxeuyluv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2bGZ2cnh6ZnloYXR4ZXV5bHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTUyNjAsImV4cCI6MjA5MDE3MTI2MH0.MfjSptz2nRGW9P4D2yrqP3OxZBKsrxjNdQfnM8_zG8Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);