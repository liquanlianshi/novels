import { GoogleGenAI } from "@google/genai";
import { NovelMetadata } from '../types';

// Initialize the client. We assume process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SEARCH_MODEL = 'gemini-2.5-flash';
const CONTENT_MODEL = 'gemini-2.5-flash';

export const searchNovelMetadata = async (query: string): Promise<NovelMetadata | null> => {
  try {
    const prompt = `Find detailed metadata for the novel '${query}'. 
      I need the exact title, author, a brief description, and a list of the first 20 chapter titles.
      Use Google Search to ensure accuracy if you are unsure.
      
      IMPORTANT LANGUAGE RULE:
      - If the search query '${query}' is in Chinese (contains Chinese characters), the returned 'title', 'author', 'description', and 'chapters' MUST be in Chinese.
      - Do NOT translate the results into English if the query is in another language.
      - Maintain the original language of the work if possible.

      Respond with a VALID JSON object (and nothing else) using this structure:
      {
        "title": "Official Title",
        "author": "Author Name",
        "description": "Short synopsis",
        "totalChaptersEstimate": 1000,
        "chapters": ["Chapter 1: Name", "Chapter 2: Name", ...]
      }`;

    const response = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // responseSchema and responseMimeType are NOT compatible with googleSearch tool
        temperature: 0.1,
      },
    });

    // Extract sources from grounding metadata
    const sources: string[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      response.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          sources.push(chunk.web.uri);
        }
      });
    }

    if (response.text) {
      let jsonStr = response.text.trim();
      // Remove markdown code blocks if present
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonStr = match[1];
      }
      
      const metadata = JSON.parse(jsonStr) as NovelMetadata;
      metadata.sources = [...new Set(sources)]; // Remove duplicates
      return metadata;
    }
    return null;
  } catch (error) {
    console.error("Gemini search error:", error);
    return null;
  }
};

export const fetchChapterContent = async (novelTitle: string, chapterTitle: string): Promise<string> => {
  try {
    const prompt = `
      You are a web crawler and archiver.
      Task: Retrieve or reconstruct the full text content of '${chapterTitle}' from the novel '${novelTitle}'.
      
      Guidelines:
      1. Use Google Search to find the actual content of the chapter.
      2. If direct text is found, output it verbatim.
      3. If only summaries are found, write a detailed retelling that captures the full narrative flow of the chapter as closely as possible to the original.
      4. Format the output in clean Markdown.
      5. Start with a header: "# ${chapterTitle}".
      6. Do NOT include any intro or outro text (like "Here is the chapter"). Just the story content.

      IMPORTANT LANGUAGE RULE:
      - The output content MUST match the language of the novel title '${novelTitle}'. 
      - If '${novelTitle}' is in Chinese, the retrieved content MUST be in Chinese.
      - Do NOT translate the original text into English.
    `;

    const response = await ai.models.generateContent({
      model: CONTENT_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3, // Slightly higher for better narrative flow if reconstruction is needed
      },
    });

    // Extract sources for the chapter
    const sources: string[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      response.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          sources.push(chunk.web.uri);
        }
      });
    }

    let content = response.text || "Error: No content generated.";
    
    // Append sources to the content
    if (sources.length > 0) {
      const uniqueSources = [...new Set(sources)];
      content += `\n\n---\n**Sources:**\n${uniqueSources.map(s => `- <${s}>`).join('\n')}`;
    }

    return content;
  } catch (error) {
    console.error(`Gemini fetch error for ${chapterTitle}:`, error);
    return `Error retrieving content for ${chapterTitle}. \n\nSystem Error: ${error}`;
  }
};