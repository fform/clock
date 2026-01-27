import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const mappingPath = path.join(process.cwd(), "data", "mapping.json");
    const mappingContent = fs.readFileSync(mappingPath, "utf-8");
    const mapping = JSON.parse(mappingContent);
    return NextResponse.json(mapping);
  } catch (error) {
    console.error("Failed to load mapping.json:", error);
    return NextResponse.json({ brands: [] }, { status: 200 });
  }
}
