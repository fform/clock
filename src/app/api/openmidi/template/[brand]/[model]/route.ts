import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  _request: Request,
  { params }: { params: { brand: string; model: string } },
) {
  try {
    const yamlPath = path.join(
      process.cwd(),
      "data",
      "brands",
      params.brand,
      `${params.model}.yaml`,
    );
    
    if (!fs.existsSync(yamlPath)) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const yamlContent = fs.readFileSync(yamlPath, "utf-8");
    return new NextResponse(yamlContent, {
      headers: {
        "Content-Type": "text/yaml",
      },
    });
  } catch (error) {
    console.error(`Failed to load template for ${params.brand}/${params.model}:`, error);
    return NextResponse.json({ error: "Failed to load template" }, { status: 500 });
  }
}
