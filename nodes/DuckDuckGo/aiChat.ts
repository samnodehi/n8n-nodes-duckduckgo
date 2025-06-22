/**
 * AI Chat functionality for DuckDuckGo
 * Provides private access to various AI models
 */

import { IExecuteFunctions } from 'n8n-workflow';
import { AIModel, IDuckDuckGoAIChatResponse } from './types';
import { createLogEntry, LogLevel } from './utils';

/**
 * Interface for AI chat request
 */
interface AIChatRequest {
  message: string;
  model: AIModel;
  conversationId?: string;
}

/**
 * Sends a message to DuckDuckGo AI Chat
 *
 * @param this - The execute functions context
 * @param request - The chat request
 * @returns Promise with the AI response
 */
export async function sendAIChat(
  this: IExecuteFunctions,
  request: AIChatRequest
): Promise<IDuckDuckGoAIChatResponse> {
  const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;

  if (debugMode) {
    const logEntry = createLogEntry(
      LogLevel.INFO,
      `Sending AI chat request to model: ${request.model}`,
      'aiChat',
      { model: request.model, hasConversationId: !!request.conversationId }
    );
    console.log(JSON.stringify(logEntry));
  }

  try {
    // Simulate AI chat request (actual implementation would require DuckDuckGo API access)
    // For now, we'll return a mock response
    // In production, this would make actual API calls to duck.ai

    const response: IDuckDuckGoAIChatResponse = {
      message: `This is a simulated response from ${request.model}. In production, this would connect to DuckDuckGo's AI Chat API.`,
      model: request.model,
      conversationId: request.conversationId || generateConversationId(),
      timestamp: Date.now(),
    };

    if (debugMode) {
      const logEntry = createLogEntry(
        LogLevel.INFO,
        'AI chat response received',
        'aiChat',
        { model: request.model, conversationId: response.conversationId }
      );
      console.log(JSON.stringify(logEntry));
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (debugMode) {
      const logEntry = createLogEntry(
        LogLevel.ERROR,
        `AI chat error: ${errorMessage}`,
        'aiChat',
        { model: request.model },
        error instanceof Error ? error : new Error(errorMessage)
      );
      console.error(JSON.stringify(logEntry));
    }

    throw new Error(`AI Chat failed: ${errorMessage}`);
  }
}

/**
 * Generates a unique conversation ID
 *
 * @returns A unique conversation ID
 */
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validates if the selected model is available
 *
 * @param model - The AI model to validate
 * @returns true if the model is available
 */
export function isModelAvailable(model: string): model is AIModel {
  return Object.values(AIModel).includes(model as AIModel);
}

/**
 * Gets model display name
 *
 * @param model - The AI model
 * @returns Human-readable model name
 */
export function getModelDisplayName(model: AIModel): string {
  const modelNames: Record<AIModel, string> = {
    [AIModel.GPT35Turbo]: 'GPT-3.5 Turbo',
    [AIModel.Claude3Haiku]: 'Claude 3 Haiku',
    [AIModel.Llama370B]: 'Llama 3 70B',
    [AIModel.Mixtral8x7B]: 'Mixtral 8x7B',
  };

  return modelNames[model] || model;
}
