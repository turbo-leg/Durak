import path from 'path';
import dotenv from 'dotenv';

// Load before room/config modules capture process-wide limits at import time.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();
