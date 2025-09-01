// src/app/api/email-forward/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface EmailData {
  from: string;
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64
    contentType: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const emailData: EmailData = await req.json();
    
    // Extract invoice data from email
    const invoiceData = await extractInvoiceFromEmail(emailData);
    
    if (!invoiceData) {
      return NextResponse.json({ 
        error: "Could not extract invoice data from email" 
      }, { status: 400 });
    }
    
    // Return extracted data for frontend to process
    return NextResponse.json({
      success: true,
      invoice: invoiceData
    });
    
  } catch (error) {
    console.error('Email processing error:', error);
    return NextResponse.json({ 
      error: "Failed to process email" 
    }, { status: 500 });
  }
}

async function extractInvoiceFromEmail(emailData: EmailData) {
  const { from, subject, body, attachments } = emailData;
  
  // Try to extract from attachments first (PDFs)
  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      if (attachment.contentType === 'application/pdf') {
        try {
          // Convert base64 to blob and process with OCR
          const pdfBuffer = Buffer.from(attachment.content, 'base64');
          const formData = new FormData();
          const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
          formData.append('file', blob, attachment.filename);
          
          const ocrResponse = await fetch('http://127.0.0.1:5000/ocr', {
            method: 'POST',
            body: formData
          });
          
          if (ocrResponse.ok) {
            const ocrData = await ocrResponse.json();
            const extracted = parseInvoiceText(ocrData.text || '');
            if (extracted.vendor || extracted.amount) {
              return {
                ...extracted,
                source: 'email_pdf',
                originalFile: attachment.content
              };
            }
          }
        } catch (error) {
          console.error('PDF processing error:', error);
        }
      }
    }
  }
  
  // Fallback: extract from email body
  const bodyExtracted = parseInvoiceText(body);
  if (bodyExtracted.vendor || bodyExtracted.amount) {
    return {
      ...bodyExtracted,
      source: 'email_body',
      vendor: bodyExtracted.vendor || extractVendorFromEmail(from)
    };
  }
  
  // Last resort: use sender as vendor
  return {
    vendor: extractVendorFromEmail(from),
    amount: null,
    dueDate: null,
    invoiceNumber: null,
    source: 'email_sender'
  };
}

function parseInvoiceText(text: string) {
  const amountMatch = text.match(/(\d{1,3}(?:\s?\d{3})*(?:[,\.]\d{2})?)\s*kr/i);
  const vendorMatch = text.match(/(?:från|faktura från|leverantör|avsändare)[:]\s*([^\n\r]{1,50})/i) || 
                     text.match(/([A-ZÅÄÖ][a-zåäö\s]+(?:AB|HB|KB|Aktiebolag|Handelsbolag))/);
  const invoiceNumberMatch = text.match(/(?:faktura|invoice|nr|nummer|#)[\s:]*(\d+)/i);
  const dueDateMatch = text.match(/(?:förfaller|due|betala senast|betalning)[\s:]*([\d\-\/\.]{8,10})/i);
  
  let dueDate = null;
  if (dueDateMatch) {
    const dateStr = dueDateMatch[1];
    const parsedDate = new Date(dateStr.replace(/\//g, '-'));
    if (!isNaN(parsedDate.getTime())) {
      dueDate = parsedDate.toISOString().split('T')[0];
    }
  }
  
  return {
    vendor: vendorMatch ? vendorMatch[1].trim() : null,
    amount: amountMatch ? amountMatch[1].replace(/\s/g, '').replace(',', '.') : null,
    invoiceNumber: invoiceNumberMatch ? invoiceNumberMatch[1] : null,
    dueDate
  };
}

function extractVendorFromEmail(fromEmail: string): string {
  // Extract company name from email address
  const domain = fromEmail.split('@')[1];
  if (!domain) return fromEmail;
  
  // Remove common TLDs and convert to readable name
  const name = domain
    .replace(/\.(com|se|org|net|co\.uk)$/, '')
    .replace(/[.-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
    
  return name || fromEmail;
}
