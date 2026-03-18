import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface NutritionInfo {
  foodName: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  servingSize: string;
}

export async function estimateNutrition(foodDescription: string): Promise<NutritionInfo> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Estimate the nutritional value for the following food: "${foodDescription}". 
    Provide a realistic estimation if exact values are not known.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          foodName: { type: Type.STRING },
          calories: { type: Type.NUMBER, description: "Calories in kcal" },
          protein: { type: Type.NUMBER, description: "Protein in grams" },
          fat: { type: Type.NUMBER, description: "Fat in grams" },
          carbs: { type: Type.NUMBER, description: "Carbohydrates in grams" },
          servingSize: { type: Type.STRING, description: "Estimated serving size" },
        },
        required: ["foodName", "calories", "protein", "fat", "carbs", "servingSize"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}
