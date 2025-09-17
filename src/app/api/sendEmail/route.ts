import { NextResponse } from "next/server";

type EmailBody = {
  to: string;
  subject: string;
  text: string;
  offerId?: string;
  customerId?: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EmailBody;
    
    if (!body?.to) return bad("Missing 'to' email address");
    if (!body?.subject) return bad("Missing 'subject'");
    if (!body?.text) return bad("Missing 'text' content");

    // För nu, simulera att mailet skickas
    // I en riktig implementation skulle du använda Resend, SendGrid, eller liknande
    console.log("Email skulle skickas:", {
      to: body.to,
      subject: body.subject,
      text: body.text,
      offerId: body.offerId,
      customerId: body.customerId
    });

    // Simulera en kort delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({ 
      ok: true, 
      message: "Email skickat framgångsrikt",
      sentTo: body.to 
    }, { status: 200 });
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
