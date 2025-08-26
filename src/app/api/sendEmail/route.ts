import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  const { to, subject, text } = body;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer re_acELLSQ4_3gudYcnkecCeHU9rNFs7jP87`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "christina.aspman@aispecialisterna.se",
      to,
      subject,
      text
    })
  });

  const result = await response.json();
  return NextResponse.json(result);
}
