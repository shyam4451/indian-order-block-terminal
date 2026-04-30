import { runUoMultiTimeframeScan } from "./lib/uoScanner.mjs";

export async function handler(event) {
  try {
    const payload = await runUoMultiTimeframeScan(event.queryStringParameters || {}, process.env);
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      body: JSON.stringify(payload)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      body: JSON.stringify({
        error: "Scan failed",
        message: error.message
      })
    };
  }
}
