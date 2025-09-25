import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const m = pathname.match(/^\/kund\/([^\/?#]+)/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    const keep = 'kund1';
    const isTesty = /(^(test|demo|kundkort)-|test|demo|kundkort)/i.test(slug);
    if (slug !== keep && isTesty) {
      return new NextResponse('Not Found', { status: 404 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/kund/:path*'] };



