import { NextRequest } from 'next/server';

// DEPRECATED: Duplicate of /api/ocr - consolidated into /api/v1/receipt-ocr

export async function POST(req: NextRequest) {
  console.warn(JSON.stringify({
    event: 'deprecated_endpoint_used',
    endpoint: '/api/openai-ocr',
    new_endpoint: '/api/v1/receipt-ocr',
    ip: req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  }));

  const url = new URL(req.url);
  url.pathname = '/api/v1/receipt-ocr';
  
  return Response.redirect(url.toString(), 307);
}

export async function GET() {
  return Response.json({
    deprecated: true,
    message: "This duplicate endpoint has been consolidated into /api/v1/receipt-ocr",
    redirect_to: "/api/v1/receipt-ocr"
  }, { 
    status: 301,
    headers: { 'Location': '/api/v1/receipt-ocr', 'X-Deprecated': 'true' }
  });
}