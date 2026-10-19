import { AgentResponse } from '../dispatcher';
import prisma from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { withFallback } from '../utils/withFallback';

cloudinary.config(true);

export async function runImageAgent(prompt: string, userId: string): Promise<AgentResponse> {
  let providerUsed = "pollinations-turbo";

  try {
    // Wrap image buffer fetching in withFallback
    const imageBuffer = await withFallback(
      async () => {
        console.log(`[ImageAgent] Generating via Pollinations.ai (turbo): "${prompt}"`);
        const seed = Math.floor(Math.random() * 1_000_000);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&seed=${seed}&width=768&height=768&model=turbo`;

        const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
        if (!res.ok) throw new Error(`Pollinations Turbo returned ${res.status}`);
        providerUsed = "pollinations-turbo";
        return await res.arrayBuffer();
      },
      async () => {
        console.log(`[ImageAgent] Falling back to standard Pollinations...`);
        const seed = Math.floor(Math.random() * 1_000_000);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&seed=${seed}&width=768&height=768`;

        const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
        if (!res.ok) throw new Error(`Standard Pollinations returned ${res.status}`);
        providerUsed = "pollinations-standard";
        return await res.arrayBuffer();
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
  } catch (error) {
    console.error(`[ImageAgent] Generation failed:`, error);
    return {
      agentType: "image_generation",
      content: `⚠️ Image generation failed: ${(error as Error).message}`,
      status: "error",
    };
  }
}
