/**
 * This file provides utilities for generating and comparing embeddings
 * Embeddings allow for semantic search and similarity comparison of text
 */

// Normally, we would use the OpenAI API here, but for now we'll use a mock
// implementation since we don't want to require an API key for this example
export async function getEmbedding(text: string): Promise<number[]> {
  // This is a mock implementation that returns random vectors
  // In a real application, you would call the OpenAI API or another embedding service
  const dimensions = 1536; // OpenAI embeddings are 1536 dimensions
  const embedding = Array.from(
    { length: dimensions },
    () => Math.random() * 2 - 1
  );

  // Normalize the vector for cosine similarity
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0)
  );
  return embedding.map((val) => val / magnitude);
}

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between -1 and 1, where 1 means identical vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same dimensions");
  }

  // Calculate dot product
  const dotProduct = a.reduce((sum, value, i) => sum + value * b[i], 0);

  // Calculate magnitudes
  const magnitudeA = Math.sqrt(
    a.reduce((sum, value) => sum + value * value, 0)
  );
  const magnitudeB = Math.sqrt(
    b.reduce((sum, value) => sum + value * value, 0)
  );

  // Calculate cosine similarity
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Find semantically similar items using embeddings
 */
export async function findSimilarItems<T>(
  query: string,
  items: Array<T>,
  getItemText: (item: T) => string,
  threshold = 0.75, // Similarity threshold between 0 and 1
  maxResults = 5
): Promise<Array<{ item: T; similarity: number }>> {
  // Generate embedding for the query
  const queryEmbedding = await getEmbedding(query);
  const results: Array<{ item: T; similarity: number }> = [];

  // Compare against each item
  for (const item of items) {
    const itemText = getItemText(item);
    const itemEmbedding = await getEmbedding(itemText);
    const similarity = cosineSimilarity(queryEmbedding, itemEmbedding);

    if (similarity >= threshold) {
      results.push({ item, similarity });
    }
  }

  // Sort by similarity (highest first) and limit results
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}
