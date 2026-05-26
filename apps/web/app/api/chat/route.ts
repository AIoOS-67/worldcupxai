import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: Request) {
  const { message } = (await req.json()) as { message?: string };
  // Placeholder: the real implementation will call Google Cloud Agent Builder,
  // which fans out to Elastic Agent Builder over MCP.
  const reply =
    typeof message === "string" && message.length > 0
      ? `Got it — "${message.slice(0, 120)}". The real agent is coming online. Try asking about Argentina's group stage.`
      : "Tell me which team you support, your budget, and where you fly from.";
  return NextResponse.json({ reply });
}
