/**
 * Worker-thread entry point for page-text extraction. It runs here, not on
 * the main thread, so runExtraction in pageContent.ts can stop a page that
 * takes too long or needs too much memory to parse.
 */

import { parentPort, workerData } from 'worker_threads';
import { extractFromHtml } from './pageContent';

const { html, maxLength } = workerData as { html: string; maxLength: number };
parentPort?.postMessage(extractFromHtml(html, maxLength));
