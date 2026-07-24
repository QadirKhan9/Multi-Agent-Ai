import { AgentResponse } from '../dispatcher';
import prisma from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { withFallback } from '../utils/withFallback';

cloudinary.config(true);

export async function runImageAgent(prompt: string, userId: string): Promise<AgentResponse> {
  let providerUsed = "pollinations";

  // Wrap image buffer fetching in withFallback
  const imageBuffer = await withFallback(
    async () => {
      console.log(`[ImageAgent] Generating via Pollinations.ai: "${prompt}"`);
      const seed = Math.floor(Math.random() * 1_000_000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&seed=${seed}&width=768&height=768&model=flux`;

      const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`Pollinations returned ${res.status}`);
      providerUsed = "pollinations";
      return await res.arrayBuffer();
    },
    async () => {
      const hfApiKey = process.env.HUGGINGFACE_API_KEY;
      if (!hfApiKey) throw new Error("HUGGINGFACE_API_KEY is not set");
      console.log(`[ImageAgent] Falling back to Hugging Face...`);

      const hfRes = await fetch(
        "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
        {
          headers: { Authorization: `Bearer ${hfApiKey}`, "Content-Type": "application/json" },
          method: "POST",
          body: JSON.stringify({ inputs: prompt }),
          signal: AbortSignal.timeout(60000),
        }
      );

      if (!hfRes.ok) throw new Error(`Hugging Face returned ${hfRes.status}`);
      providerUsed = "huggingface";
      return await hfRes.arrayBuffer();
    },
    'Image Generation Agent'
  );

  // Upload to Cloudinary
  let imageUrl = "";
  try {
    console.log(`[ImageAgent] Uploading to Cloudinary (provider: ${providerUsed})...`);
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const dataURI = `data:image/jpeg;base64,${base64}`;

    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      folder: "synthox-ai",
      resource_type: "image",
    });

    imageUrl = uploadResult.secure_url;
    console.log(`[ImageAgent] Cloudinary upload success: ${imageUrl}`);
  } catch (uploadError) {
    console.error(`[ImageAgent] Cloudinary upload failed:`, uploadError);
    return {
      agentType: "image_generation",
      content: `⚠️ Image was generated but failed to upload to storage: ${(uploadError as Error).message}`,
      status: "error",
    };
  }

  // Save to Database
  try {
    await prisma.generatedFile.create({
      data: { userId, type: "image", url: imageUrl },
    });
    console.log(`[ImageAgent] Saved to DB.`);
  } catch (dbError) {
    console.error(`[ImageAgent] DB save failed (non-fatal):`, dbError);
  }

  return {
    agentType: "image_generation",
    content: `🎨 Here's your generated image for: **"${prompt}"**`,
    imageUrl,
    status: "success",
  };
}
