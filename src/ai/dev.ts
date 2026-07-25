import { config } from 'dotenv';
config();

import '@/ai/flows/redact-sensitive-data.ts';
import '@/ai/flows/process-report-flow.ts';
import '@/ai/flows/get-reports-for-verification-flow.ts';
import '@/ai/flows/list-reports-flow.ts';
import '@/ai/flows/download-report-flow.ts';
import '@/ai/flows/verify-reports-flow.ts';
import '@/ai/flows/reject-report-flow.ts';
import '@/ai/flows/user-management-flow.ts';
import '@/ai/flows/login-flow.ts';
import '@/ai/flows/settings-flow.ts';
