/**
 * DuckDuckGo Instant Answer API client.
 *
 * Uses DuckDuckGo's official, free, no-key JSON endpoint
 * (https://api.duckduckgo.com) to return direct answers, abstracts
 * (Wikipedia-style summaries), definitions, and related topics for a query.
 *
 * No API key, no cost, no telemetry — same privacy posture as the rest of the
 * node (requests go only to DuckDuckGo).
 */

import axios from 'axios';
import { BROWSER_USER_AGENT } from './constants';

export interface RelatedTopic {
  text: string;
  url: string;
}

export interface InstantAnswerResult {
  heading: string;
  abstract: string;
  abstractSource: string;
  abstractURL: string;
  answer: string;
  answerType: string;
  definition: string;
  definitionSource: string;
  definitionURL: string;
  image: string;
  /** DuckDuckGo answer type: A=article, D=disambiguation, C=category, N=name, E=exclusive, ''=none. */
  type: string;
  relatedTopics: RelatedTopic[];
  /** Present only when the request failed. */
  error?: string;
}

export interface InstantAnswerOptions {
  timeout?: number;
}

const DEFAULT_TIMEOUT = 8000;

function emptyResult(): InstantAnswerResult {
  return {
    heading: '', abstract: '', abstractSource: '', abstractURL: '',
    answer: '', answerType: '', definition: '', definitionSource: '',
    definitionURL: '', image: '', type: '', relatedTopics: [],
  };
}

/**
 * Flatten DuckDuckGo's RelatedTopics, which may contain both flat topics
 * ({ Text, FirstURL }) and grouped categories ({ Name, Topics: [...] }).
 */
function flattenRelatedTopics(raw: unknown): RelatedTopic[] {
  if (!Array.isArray(raw)) return [];
  const out: RelatedTopic[] = [];
  for (const item of raw as any[]) {
    if (item && typeof item.Text === 'string') {
      out.push({ text: item.Text, url: typeof item.FirstURL === 'string' ? item.FirstURL : '' });
    } else if (item && Array.isArray(item.Topics)) {
      for (const sub of item.Topics) {
        if (sub && typeof sub.Text === 'string') {
          out.push({ text: sub.Text, url: typeof sub.FirstURL === 'string' ? sub.FirstURL : '' });
        }
      }
    }
  }
  return out;
}

/** Normalise a DuckDuckGo image path to an absolute URL. */
function absoluteImage(image: unknown): string {
  if (typeof image !== 'string' || image === '') return '';
  return image.startsWith('http') ? image : `https://duckduckgo.com${image}`;
}

/**
 * Query the DuckDuckGo Instant Answer API. Never throws: failures are reported
 * via the `error` field.
 */
export async function getInstantAnswer(
  query: string,
  options: InstantAnswerOptions = {},
): Promise<InstantAnswerResult> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return { ...emptyResult(), error: 'No query provided' };
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      no_html: '1',
      skip_disambig: '1',
      t: 'n8n-nodes-duckduckgo-search',
    });

    const response = await axios.get(`https://api.duckduckgo.com/?${params.toString()}`, {
      timeout,
      responseType: 'json',
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'application/json',
      },
    });

    const d: any = response.data || {};
    return {
      heading: d.Heading || '',
      abstract: d.AbstractText || '',
      abstractSource: d.AbstractSource || '',
      abstractURL: d.AbstractURL || '',
      answer: typeof d.Answer === 'string' ? d.Answer : (d.Answer ? JSON.stringify(d.Answer) : ''),
      answerType: d.AnswerType || '',
      definition: d.Definition || '',
      definitionSource: d.DefinitionSource || '',
      definitionURL: d.DefinitionURL || '',
      image: absoluteImage(d.Image),
      type: d.Type || '',
      relatedTopics: flattenRelatedTopics(d.RelatedTopics),
    };
  } catch (error: any) {
    let message: string;
    if (error?.code === 'ECONNABORTED') {
      message = `Timed out after ${timeout}ms`;
    } else if (error?.response?.status) {
      message = `HTTP ${error.response.status}`;
    } else if (error?.code) {
      message = String(error.code);
    } else {
      message = error instanceof Error ? error.message : 'Unknown error';
    }
    return { ...emptyResult(), error: message };
  }
}
