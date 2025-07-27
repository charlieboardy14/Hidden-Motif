import { VertexAI } from '@google-cloud/aiplatform';
import type { Artwork, RoundData } from '../../types.cjs';

const project = process.env.GCP_PROJECT_ID || 'your-gcp-project-id';
const location = 'us-central1';

const vertexAI = new VertexAI({ project, location });
const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const withRetry = async <T>(apiCall: () => Promise<T>): Promise<T> => {
  const maxRetries = 3;
  const initialDelay = 1000;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await apiCall();
    } catch (error: any) {
      attempt++;
      const errorMessage = (error?.message || JSON.stringify(error)).toLowerCase();
      const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('resource_exhausted');

      if (isRateLimitError && attempt < maxRetries) {
        const waitTime = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 200;
        console.warn(`Rate limit error. Retrying in ${waitTime}ms... (Attempt ${attempt}/${maxRetries})`);
        await delay(waitTime);
      } else {
        console.error(`API call failed after ${attempt} attempts or with a non-retryable error.`, error);
        throw error;
      }
    }
  }
  throw new Error("API call failed after all retries.");
};

export const generateRoundData = async (): Promise<RoundData> => {
  try {
    return await withRetry(async () => {
      const prompt = `You are a creative director for a game called 'Hidden Motif'.
Generate a new round for the game. You need to provide:
1. A creative and descriptive theme for an artwork.
2. Two simple, concrete, and distinct nouns to act as secret "motifs".

Return a single JSON object with the keys "theme", "motif1", and "motif2".`;

      const response = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0 },
        tools: [{
          functionDeclarations: [{
            name: "generateRoundData",
            parameters: {
              type: "OBJECT",
              properties: {
                theme: { type: "STRING" },
                motif1: { type: "STRING" },
                motif2: { type: "STRING" },
              },
              required: ['theme', 'motif1', 'motif2']
            }
          }]
        }]
      });

      const call = response.response.candidates[0].content.parts[0].functionCall;
      if (call && call.name === "generateRoundData") {
        return call.args as RoundData;
      }
      throw new Error("Invalid response structure from AI for generateRoundData.");
    });
  } catch (error) {
    console.error("Error generating round data:", error);
    return {
      theme: "A Cyberpunk Megacity During a Rainstorm",
      motif1: "Dragon",
      motif2: "Compass"
    };
  }
};

export const generateDodgerPrompt = async (theme: string, motif1: string, motif2: string): Promise<string> => {
  try {
    return await withRetry(async () => {
      const prompt = `You are the 'Dodger' in Hidden Motif. Create a prompt under 100 characters for the theme "${theme}".
It MUST naturally include both secret motifs: "${motif1}" and "${motif2}".`;

      const response = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9 },
      });

      return response.text?.trim() ?? `A beautiful painting of ${theme} with ${motif1} and ${motif2}.`;
    });
  } catch (error) {
    console.error("Error generating Dodger prompt:", error);
    return `A beautiful painting of ${theme} with ${motif1} and ${motif2}.`;
  }
};

export const generateArtistPrompt = async (theme: string, motif1: string, motif2: string): Promise<string> => {
  try {
    return await withRetry(async () => {
      const prompt = `You are the 'Artist' in Hidden Motif. Create a prompt under 100 characters for the theme "${theme}".
Do NOT mention "${motif1}" or "${motif2}", or anything resembling them.`;

      const response = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8 },
      });

      return response.text?.trim() ?? `A beautiful painting of ${theme}.`;
    });
  } catch (error) {
    console.error("Error generating Artist prompt:", error);
    return `A beautiful painting of ${theme}.`;
  }
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  try {
    return await withRetry(async () => {
      const response = await generativeModel.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: `Generate a 1024x1024 detailed image based on this prompt: "${prompt}"` }]
          }
        ],
        generationConfig: { temperature: 0.9 },
      });

      const parts = response.response.candidates[0].content.parts;
      const imagePart = parts.find(p => p.fileData?.mimeType?.startsWith('image/'));

      if (imagePart && imagePart.fileData?.data) {
        return `data:${imagePart.fileData.mimeType};base64,${imagePart.fileData.data}`;
      }

      throw new Error("No image data returned from Gemini.");
    });
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};

export const evaluateArtworks = async (
  artworks: Artwork[],
  theme: string
): Promise<{ qualityRanking: number[]; originalityRanking: number[]; }> => {
  try {
    return await withRetry(async () => {
      const artworkPrompts = artworks.map(art => ({ id: art.id, prompt: art.prompt }));
      const prompt = `You are an art critic for 'Hidden Motif'. The theme is "${theme}".
Rank the artworks below for:
1. Quality: Aesthetic/detail potential of prompt.
2. Originality: Creative interpretation of the theme.

Return JSON with:
- qualityRanking: [ids descending by quality]
- originalityRanking: [ids descending by creativity]

Artworks: ${JSON.stringify(artworkPrompts)}`;

      const response = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{
          functionDeclarations: [{
            name: "evaluateArtworks",
            parameters: {
              type: "OBJECT",
              properties: {
                qualityRanking: {
                  type: "ARRAY",
                  items: { type: "INTEGER" }
                },
                originalityRanking: {
                  type: "ARRAY",
                  items: { type: "INTEGER" }
                }
              },
              required: ['qualityRanking', 'originalityRanking']
            }
          }]
        }]
      });

      const call = response.response.candidates[0].content.parts[0].functionCall;
      if (call && call.name === "evaluateArtworks") {
        return call.args as { qualityRanking: number[]; originalityRanking: number[]; };
      }
      throw new Error("Invalid structure from evaluateArtworks.");
    });
  } catch (error) {
    console.error("Error evaluating artworks:", error);
    const shuffled = artworks.map(art => art.id).sort(() => Math.random() - 0.5);
    return {
      qualityRanking: [...shuffled],
      originalityRanking: [...shuffled].sort(() => Math.random() - 0.5),
    };
  }
};
