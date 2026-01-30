import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export type DeviceInfo = {
  id: string;
  manufacturer: string;
  model: string;
  hasTemplate: boolean;
};

export async function GET() {
  try {
    const mappingPath = path.join(process.cwd(), "data", "mapping.json");
    const mappingContent = fs.readFileSync(mappingPath, "utf-8");
    const mapping = JSON.parse(mappingContent) as {
      brands: Array<{
        name: string;
        value: string;
        models: Array<{ name: string; value: string }>;
      }>;
    };

    const devices: DeviceInfo[] = [];

    // Convert mapping to flat device list
    for (const brand of mapping.brands) {
      for (const model of brand.models) {
        const deviceId = `${brand.value}-${model.value}`;
        
        // Check if template file exists
        const yamlPath = path.join(
          process.cwd(),
          "data",
          "brands",
          brand.value,
          `${model.value}.yaml`,
        );
        const hasTemplate = fs.existsSync(yamlPath);

        devices.push({
          id: deviceId,
          manufacturer: brand.name,
          model: model.name,
          hasTemplate,
        });
      }
    }

    return NextResponse.json({ devices });
  } catch (error) {
    console.error("Failed to load device list:", error);
    return NextResponse.json({ devices: [] }, { status: 200 });
  }
}
