export async function withFallback<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  agentName: string
): Promise<T> {
  try {
    console.log(`[${agentName}] Executing primary provider...`);
    return await primaryFn();
  } catch (primaryError) {
    console.warn(
      `[${agentName}] Primary provider failed. Error: ${(primaryError as Error).message}. Swapping to fallback...`
    );
    
    try {
      console.log(`[${agentName}] Executing fallback provider...`);
      return await fallbackFn();
    } catch (fallbackError) {
      console.error(
        `[${agentName}] Both primary and fallback providers failed. Fallback Error: ${(fallbackError as Error).message}`
      );
      throw new Error(
        `The ${agentName} is temporarily unavailable. Please try again in a moment.`
      );
    }
  }
}
