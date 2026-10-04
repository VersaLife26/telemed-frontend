import { isDoctorId } from "@/lib/consumer/features/doctor-share";
import { shareImageResponse } from "@/components/consumer/profile/doctor-share-image";

/**
 * Public PNG used as the Open Graph image for /doctors/{id}.
 * WhatsApp and similar apps request this URL; it has to keep working after
 * the doctor's signed photo URL has expired.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!isDoctorId(id)) return new Response("Not found", { status: 404 });

  try {
    const image = await shareImageResponse(id);
    image.headers.set("Cache-Control", "public, max-age=300");
    return image;
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
