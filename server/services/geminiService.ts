import { GoogleGenAI, Type } from "@google/genai";
import type { Artwork, RoundData } from '../../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
        const waitTime = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 200; // Add jitter
        console.warn(`Rate limit error. Retrying in ${waitTime}ms... (Attempt ${attempt}/${maxRetries})`);
        await delay(waitTime);
      } else {
        console.error(`API call failed after ${attempt} attempts or with a non-retryable error.`, error);
        throw error; // Re-throw the error to be caught by the calling function's catch block
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
1.  A creative and descriptive theme for an artwork (e.g., "A library inside a giant tree").
2.  Two simple, concrete, and distinct nouns to act as secret "motifs" (e.g., "Key", "Dragon"). Avoid abstract concepts.

Return a single JSON object with the keys "theme", "motif1", and "motif2".`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            temperature: 1.0,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                theme: { type: Type.STRING, description: "The creative theme for the round." },
                motif1: { type: Type.STRING, description: "The first secret noun motif." },
                motif2: { type: Type.STRING, description: "The second secret noun motif." },
              },
              required: ['theme', 'motif1', 'motif2']
            }
          }
        });

        if (!response.text) {
          throw new Error("AI response text is undefined.");
        }
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    });
  } catch (error) {
    console.error("Error generating round data:", error);
    // Fallback in case of API error
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
        const prompt = `You are playing a game called Hidden Motif. Your role is the 'Dodger'.
Your task is to create a single image generation prompt for the theme: "${theme}".
Crucially, you MUST include the two secret motifs, "${motif1}" and "${motif2}", in your prompt. Your output will be invalid if they are missing.
The motifs should be integrated naturally, not just listed. Be creative.
The final prompt MUST BE UNDER 100 CHARACTERS.
Output ONLY the image generation prompt.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            temperature: 0.9,
          }
        });
        if (!response.text) {
          throw new Error("AI response text is undefined.");
        }
        return response.text;
    });
  } catch (error) {
    console.error("Error generating Dodger prompt:", error);
    return `Error: A beautiful painting of ${theme} with ${motif1} and ${motif2}.`;
  }
};

export const generateArtistPrompt = async (theme: string, motif1: string, motif2: string): Promise<string> => {
  try {
    return await withRetry(async () => {
        const prompt = `You are playing a game called Hidden Motif. Your role is an 'Artist'.
Your task is to create a single image generation prompt for the theme: "${theme}".
Crucially, you must actively AVOID including the two secret motifs: "${motif1}" and "${motif2}".
Do not mention them or anything that could be mistaken for them.
The final prompt MUST BE UNDER 100 CHARACTERS.
Output ONLY the image generation prompt.`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            temperature: 0.8,
          }
        });
        if (!response.text) {
          throw new Error("AI response text is undefined.");
        }
        return response.text;
    });
  } catch (error) {
    console.error("Error generating Artist prompt:", error);
    return `Error: A beautiful painting of ${theme}.`;
  }
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  try {
    return await withRetry(async () => {
        const response = await ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '16:9',
          },
        });
        
        if (response.generatedImages && response.generatedImages.length > 0) {
          const firstImage = response.generatedImages[0];
          if (firstImage.image && firstImage.image.imageBytes) {
            return firstImage.image.imageBytes;
          }
        }
        return null;
    });
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};

export const evaluateArtworks = async (artworks: Artwork[], theme: string): Promise<{ qualityRanking: number[]; originalityRanking: number[]; }> => {
  try {
    return await withRetry(async () => {
        const artworkPrompts = artworks.map(art => ({ id: art.id, prompt: art.prompt }));
        const prompt = `You are an art critic for the game 'Hidden Motif'. The theme for this round is "${theme}".
I will provide a JSON list of artworks, each with an ID and the prompt used to create it.

Your task is to rank the prompts based on **Quality** (most likely to generate a detailed, aesthetic image) and **Originality** (most creative interpretation of the theme).

Return a single JSON object with two keys:
- "qualityRanking": An array of artwork IDs, sorted from highest to lowest quality.
- "originalityRanking": An array of artwork IDs, sorted from most to least original.

Artwork Prompts: ${JSON.stringify(artworkPrompts)}
`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                qualityRanking: {
                  type: Type.ARRAY,
                  description: "Array of artwork IDs sorted from highest to lowest quality.",
                  items: { type: Type.INTEGER }
                },
                originalityRanking: {
                  type: Type.ARRAY,
                  description: "Array of artwork IDs sorted from most to least original.",
                  items: { type: Type.INTEGER }
                },
              },
              required: ['qualityRanking', 'originalityRanking']
            }
          }
        });

        if (!response.text) {
          throw new Error("AI response text is undefined.");
        }
        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);
        
        if (parsedResponse.qualityRanking && parsedResponse.originalityRanking) {
            return parsedResponse;
        } else {
            throw new Error("Invalid response structure from AI evaluation.");
        }
    });
  } catch (error) {
    console.error("Error evaluating artworks:", error);
    const shuffledIds = artworks.map(art => art.id).sort(() => Math.random() - 0.5);
    return { 
        qualityRanking: [...shuffledIds], 
        originalityRanking: [...shuffledIds].sort(() => Math.random() - 0.5),
    };
  }
};