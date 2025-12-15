import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateImageCaption = async (base64Image: string, mimeType: string = "image/jpeg"): Promise<string> => {
  try {
    const client = getClient();
    
    const prompt = `
      Actúa como un fotógrafo profesional y poeta. 
      Analiza esta imagen y escribe una descripción breve, emotiva y artística para un álbum de fotos digital.
      El tono debe ser nostálgico, elegante y cálido. 
      Máximo 2 frases. Responde en Español.
    `;

    const response: GenerateContentResponse = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            text: prompt
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          }
        ]
      }
    });

    return response.text || "No se pudo generar una descripción.";
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
};

export const imageUrlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to base64:", error);
    throw new Error("No se pudo procesar la imagen.");
  }
};