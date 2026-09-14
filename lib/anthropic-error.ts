import Anthropic from '@anthropic-ai/sdk'

/**
 * Turns an SDK failure into something worth showing the user.
 *
 * These routes used to catch everything and answer "try again shortly", which
 * hid the real cause — an exhausted credit balance says exactly that, and no
 * amount of waiting fixes it. Typed classes are checked most-specific first so
 * a retryable failure (429) stays distinguishable from a terminal one (401/400).
 */
export function describeAnthropicError(
  error: unknown,
  fallback: string,
): { message: string; status: number } {
  // Always leave the full error in the server log; only a summary goes to the client.
  console.error('[anthropic]', error)

  if (error instanceof Anthropic.AuthenticationError) {
    return {
      message: 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local.',
      status: 502,
    }
  }

  if (error instanceof Anthropic.RateLimitError) {
    return { message: 'Rate limited by the Anthropic API. Try again in a moment.', status: 429 }
  }

  if (error instanceof Anthropic.BadRequestError) {
    if (error.message.includes('credit balance')) {
      return {
        message:
          'Your Anthropic account is out of credits. Add credits under Plans & Billing in the Anthropic Console, then try again.',
        status: 502,
      }
    }
    return { message: `The Anthropic API rejected the request: ${error.message}`, status: 502 }
  }

  if (error instanceof Anthropic.APIError) {
    return { message: `Anthropic API error ${error.status ?? ''}: ${error.message}`.trim(), status: 502 }
  }

  // Not an API failure — most likely the model returned something JSON.parse rejected.
  return { message: fallback, status: 502 }
}
