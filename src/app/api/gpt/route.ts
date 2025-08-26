import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Mock GPT response for now - replace with actual OpenAI API call
async function askGPT(question: string, context: any): Promise<string> {
  // TODO: Replace with actual OpenAI API call
  // const response = await fetch('https://api.openai.com/v1/chat/completions', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     model: 'gpt-4',
  //     messages: [
  //       {
  //         role: 'system',
  //         content: 'Du är en bokföringsexpert som hjälper småföretag med svenska bokföringsfrågor. Svara på svenska.'
  //       },
  //       {
  //         role: 'user',
  //         content: `Fråga: ${question}\n\nBokföringsdata: ${JSON.stringify(context, null, 2)}`
  //       }
  //     ]
  //   })
  // });
  
  // Mock responses based on question type
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.includes('moms') || lowerQuestion.includes('vat')) {
    const vatToPay = context.vatToPay || 0;
    return `Baserat på din bokföring ska du betala ${new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(vatToPay)} i moms till Skatteverket. Detta beräknas som utgående moms minus ingående moms från dina transaktioner.`;
  }
  
  if (lowerQuestion.includes('resultat') || lowerQuestion.includes('vinst')) {
    const result = context.result || 0;
    return `Ditt resultat är ${new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(result)}. Detta är intäkter minus kostnader.`;
  }
  
  if (lowerQuestion.includes('intäkt') || lowerQuestion.includes('inkomst')) {
    const income = context.incomeSum || 0;
    return `Dina totala intäkter är ${new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(income)}.`;
  }
  
  if (lowerQuestion.includes('kostnad') || lowerQuestion.includes('utgift')) {
    const expense = context.expenseSum || 0;
    return `Dina totala kostnader är ${new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(expense)}.`;
  }
  
  return `Jag kan hjälpa dig med bokföringsfrågor! Ställ frågor om moms, resultat, intäkter, kostnader eller andra bokföringsärenden.`;
}

export async function POST(req: NextRequest) {
  try {
    const { question, context } = await req.json();
    
    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'question required' }, { status: 400 });
    }
    
    const answer = await askGPT(question, context || {});
    
    return NextResponse.json({ 
      answer,
      question,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('GPT API error:', error);
    return NextResponse.json({ 
      error: 'Failed to get answer',
      detail: String(error)
    }, { status: 500 });
  }
}
