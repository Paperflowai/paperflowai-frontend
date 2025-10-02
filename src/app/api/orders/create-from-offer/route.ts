export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { buildDocument } from '@/lib/pdf/buildDocument';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-key
);

// Validering av indata
interface OrderRequest {
  customerId: string;
  offerPath: string;
  bucket: string;
}

function validateOrderRequest(data: any): OrderRequest {
  if (!data) {
    throw new Error('Request body is required');
  }
  
  if (!data.customerId || typeof data.customerId !== 'string') {
    throw new Error('customerId is required and must be a string');
  }
  
  if (!data.offerPath || typeof data.offerPath !== 'string') {
    throw new Error('offerPath is required and must be a string');
  }
  
  if (!data.bucket || typeof data.bucket !== 'string') {
    throw new Error('bucket is required and must be a string');
  }
  
  return data as OrderRequest;
}

// Hjälpfunktion för att logga fel
function logError(context: string, error: any) {
  console.error(`[${context}] Error:`, {
    name: error?.name || 'Unknown',
    message: error?.message || 'No message',
    stack: error?.stack || 'No stack trace'
  });
}

// Hjälpfunktion för att returnera fel
function errorResponse(context: string, message: string, status = 500) {
  return Response.json(
    { ok: false, where: context, message },
    { status }
  );
}

export async function POST(req: Request) {
  try {
    // 1) Validera indata
    const rawData = await req.json();
    console.log('[createOrder] Input keys:', Object.keys(rawData));
    
    const { customerId, offerPath, bucket } = validateOrderRequest(rawData);
    
    // 2) Hämta offertdata från Storage för att extrahera riktig data
    console.log('[createOrder] Downloading offer from:', `${bucket}/${offerPath}`);
    const dl = await admin.storage.from(bucket).download(offerPath);
    
    if (dl.error) {
      logError('downloadOffer', dl.error);
      return errorResponse('downloadOffer', `Failed to download offer: ${dl.error.message}`, 404);
    }
    
    if (!dl.data) {
      return errorResponse('downloadOffer', 'Offer file not found', 404);
    }

    // 3) Hämta kunddata från databasen för komplett orderdata
    console.log('[createOrder] Fetching customer data for:', customerId);
    const { data: customer, error: customerError } = await admin
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError) {
      logError('fetchCustomer', customerError);
      return errorResponse('fetchCustomer', `Failed to fetch customer: ${customerError.message}`, 404);
    }

    if (!customer) {
      return errorResponse('fetchCustomer', 'Customer not found', 404);
    }

    // 4) Förbered orderdata med riktig kundinformation
    const orderData = {
      customerId,
      title: 'Orderbekräftelse',
      amount: customer.amount || 0,
      currency: customer.currency || 'SEK',
      needsPrint: false,
      data: {
        customerName: customer.companyName || customer.name || 'Okänd kund',
        customerAddress: customer.address || '',
        customerPhone: customer.phone || '',
        customerEmail: customer.email || '',
        orderNumber: `ORD-${Date.now()}`,
        orderDate: new Date().toLocaleDateString('sv-SE'),
        source: 'order-from-offer',
        offerPath
      }
    };

    console.log('[createOrder] Order data prepared:', Object.keys(orderData.data));

    // 5) Generera ORDERBEKRÄFTELSE från gemensam mall
    console.log('[createOrder] Generating PDF with orderConfirmation variant');
    const pdfBytes = await buildDocument(orderData, 'orderConfirmation');

    // 6) Ladda upp till Storage
    const destPath = `orders/${customerId}/${Date.now()}-order.pdf`;
    console.log('[createOrder] Uploading to:', destPath);
    
    const uploadResult = await admin.storage.from(bucket).upload(destPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: true
    });

    if (uploadResult.error) {
      logError('uploadOrder', uploadResult.error);
      return errorResponse('uploadOrder', `Failed to upload order PDF: ${uploadResult.error.message}`, 500);
    }

    // 7) Spara rad i documents tabellen (isolera DB-felet)
    console.log('[createOrder] Inserting into documents table');
    const { error: docError } = await admin
      .from('documents')
      .insert({
        customer_id: customerId,
        doc_type: 'order',
        storage_path: destPath,
        filename: `order-${customerId}-${Date.now()}.pdf`,
        version: 1,
        created_at: new Date().toISOString()
      });

    if (docError) {
      logError('insertDocument', docError);
      // Fortsätt ändå - PDF är redan uppladdad
      console.warn('[createOrder] Document insert failed but continuing:', docError.message);
    }

    // 8) Skapa signed URL för förhandsvisning
    console.log('[createOrder] Creating signed URL');
    const { data: signedUrl, error: urlError } = await admin.storage
      .from(bucket)
      .createSignedUrl(destPath, 60 * 60); // 1 timme

    if (urlError) {
      logError('createSignedUrl', urlError);
      return errorResponse('createSignedUrl', `Failed to create signed URL: ${urlError.message}`, 500);
    }

    if (!signedUrl?.signedUrl) {
      return errorResponse('createSignedUrl', 'No signed URL returned', 500);
    }

    console.log('[createOrder] Success - order created');
    return Response.json({ 
      ok: true, 
      url: signedUrl.signedUrl,
      orderId: `order-${customerId}-${Date.now()}`
    });

  } catch (error: any) {
    logError('createOrder', error);
    return errorResponse('createOrder', error.message, 500);
  }
}
