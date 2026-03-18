import { GoogleGenAI, Type } from "@google/genai";

export interface NutritionInfo {
  foodName: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  servingSize: string;
}

export async function estimateNutrition(foodDescription: string): Promise<NutritionInfo> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("找不到 Gemini API Key，請在 Secrets 面板中設定。");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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

    if (!response.text) {
      throw new Error("AI 回傳內容為空");
    }

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
