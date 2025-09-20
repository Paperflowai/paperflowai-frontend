import { NextRequest } from 'next/server';

// DEPRECATED: This endpoint has been consolidated into /api/v1/receipt-ocr
// Redirect to new optimized receipt OCR endpoint

export async function POST(req: NextRequest) {
  // Log deprecation warning
  console.warn(JSON.stringify({
    event: 'deprecated_endpoint_used',
    endpoint: '/api/ocr',
    new_endpoint: '/api/v1/receipt-ocr',
    ip: req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
    migration_reason: 'Consolidated OCR architecture for better performance'
  }));

  const url = new URL(req.url);
  url.pathname = '/api/v1/receipt-ocr';
  
  return Response.redirect(url.toString(), 307); // Temporary redirect preserving method
}

export async function GET() {
  return Response.json({
    deprecated: true,
    message: "This endpoint has been moved to /api/v1/receipt-ocr",
    redirect_to: "/api/v1/receipt-ocr",
    migration_benefits: [
      "Faster processing (2-6s vs 10-30s)",
      "Lower cost (free Tesseract vs paid OpenAI)",
      "Better mobile photo handling with OpenCV preprocessing",
      "Structured error messages with actionable tips"
    ],
    documentation: "/api/docs"
  }, { 
    status: 301,
    headers: {
      'Location': '/api/v1/receipt-ocr',
      'X-Deprecated': 'true',
      'X-Sunset': '2024-06-01' // Planned removal date
    }
  });
}