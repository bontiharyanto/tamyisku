function retryable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (!message) return true;
  return !/langganan|authenticated|masuk terlebih|tidak ditemukan|nominal|invalid|belum diatur|401|400/.test(message);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(action: () => Promise<T>, attempts = 3) {
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      last = error;
      if (!retryable(error) || attempt === attempts - 1) throw error;
      await wait(400 * (attempt + 1));
    }
  }
  throw last;
}
