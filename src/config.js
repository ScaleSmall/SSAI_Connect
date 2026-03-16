// App-specific config only. Platform metadata lives in ssai-shared.
import { SUPABASE_URL } from './supabase';

export const OAUTH_STATUS_URL = `${SUPABASE_URL}/functions/v1/oauth-status`;
export const CONNECTOR_STATUS_URL = `${SUPABASE_URL}/functions/v1/connect-connector`;
