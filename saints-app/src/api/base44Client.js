import { createClient } from '@base44/sdk';

export const base44 = createClient({
  appId: '6a33bb3aaecad5de2f0e0911',
  serverUrl: 'https://base44.app',
  requiresAuth: false,
});
