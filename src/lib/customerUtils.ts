// Utility functions for customer management

export interface Customer {
  id: string;
  companyName: string;
  orgNr?: string;
  contactPerson?: string;
  role?: string;
  phone?: string;
  email?: string;
  address?: string;
  zip?: string;
  city?: string;
  country?: string;
  contactDate?: string;
  notes?: string;
  customerNumber: string;
  offers?: any[];
}

export function saveCustomerToLocalStorage(customer: Customer): boolean {
  try {
    // Hämta befintliga kunder från localStorage
    const existingCustomers = JSON.parse(
      localStorage.getItem('paperflow_customers_v1') || '[]'
    );

    // Kontrollera om kund redan finns
    const existingIndex = existingCustomers.findIndex(
      (c: any) => String(c.id) === String(customer.id)
    );

    if (existingIndex !== -1) {
      // Uppdatera befintlig kund
      existingCustomers[existingIndex] = {
        ...existingCustomers[existingIndex],
        ...customer
      };
    } else {
      // Lägg till ny kund
      existingCustomers.push(customer);
    }

    // Spara tillbaka till localStorage
    localStorage.setItem('paperflow_customers_v1', JSON.stringify(existingCustomers));

    // Spara också i den gamla strukturen för kompatibilitet
    localStorage.setItem(`kund_${customer.id}`, JSON.stringify({
      companyName: customer.companyName,
      orgNr: customer.orgNr,
      contactPerson: customer.contactPerson,
      role: customer.role,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      zip: customer.zip,
      city: customer.city,
      country: customer.country,
      contactDate: customer.contactDate,
      notes: customer.notes,
      customerNumber: customer.customerNumber
    }));

    return true;
  } catch (error) {
    console.error('Error saving customer to localStorage:', error);
    return false;
  }
}

export function findExistingCustomer(searchCriteria: {
  companyName?: string;
  email?: string;
  orgNr?: string;
  phone?: string;
}): Customer | null {
  try {
    const existingCustomers = JSON.parse(
      localStorage.getItem('paperflow_customers_v1') || '[]'
    );

    // Sök efter matchande kund
    const foundCustomer = existingCustomers.find((customer: Customer) => {
      if (searchCriteria.companyName && 
          customer.companyName?.toLowerCase().includes(searchCriteria.companyName.toLowerCase())) {
        return true;
      }
      if (searchCriteria.email && customer.email === searchCriteria.email) {
        return true;
      }
      if (searchCriteria.orgNr && customer.orgNr === searchCriteria.orgNr) {
        return true;
      }
      if (searchCriteria.phone && customer.phone === searchCriteria.phone) {
        return true;
      }
      return false;
    });

    return foundCustomer || null;
  } catch (error) {
    console.error('Error searching for customer:', error);
    return null;
  }
}

export function createCustomerFromOffer(offerData: any, customerData?: any): Customer {
  const customerId = Date.now().toString();
  const customerNumber = `K-${Math.floor(Math.random() * 9000000) + 1000000}`;
  const today = new Date().toISOString().split('T')[0];

  // Hantera ny struktur med JSON och text
  let dataJson, kund;
  
  if (offerData.json && offerData.text) {
    // Ny struktur: offerData.json och offerData.text
    dataJson = offerData.json;
    kund = dataJson.kund || {};
  } else {
    // Gammal struktur: offerData.dataJson eller offerData.data
    dataJson = offerData.dataJson || offerData.data || {};
    kund = dataJson.kund || {};
  }
  
  return {
    id: customerId,
    companyName: customerData?.companyName || kund.namn || offerData.customerName || "",
    orgNr: customerData?.orgNr || kund.orgnr || "",
    contactPerson: customerData?.contactPerson || kund.kontaktperson || "",
    role: customerData?.role || kund.befattning || "",
    phone: customerData?.phone || kund.telefon || "",
    email: customerData?.email || kund.epost || "",
    address: customerData?.address || kund.adress || "",
    zip: customerData?.zip || kund.postnummer || "",
    city: customerData?.city || kund.ort || "",
    country: customerData?.country || kund.land || "Sverige",
    contactDate: customerData?.contactDate || dataJson.datum || today,
    notes: customerData?.notes || "",
    customerNumber: customerData?.customerNumber || dataJson.offertnummer || customerNumber,
    offers: [offerData]
  };
}

// Funktion för att spara offert i Supabase
export async function saveOfferToSupabase(offerData: any, customerId: string): Promise<boolean> {
  try {
    // Hantera ny struktur med JSON och text
    if (offerData.json && offerData.text) {
      // Ny struktur: använd GPT-specifik API
      const response = await fetch('/api/offers/create-from-gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId,
          jsonData: offerData.json,
          textData: offerData.text
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('GPT-offert sparad i Supabase:', result);
        return true;
      } else {
        console.error('Fel vid sparande av GPT-offert i Supabase:', await response.text());
        return false;
      }
    } else {
      // Gammal struktur: använd vanliga API:et
      const dataJson = offerData.dataJson || offerData.data || {};
      const kund = dataJson.kund || {};
      const title = offerData.title || dataJson.titel || "GPT-genererad offert";
      const amount = offerData.total || dataJson.summa || 0;
      const currency = offerData.currency || dataJson.valuta || "SEK";
      
      const response = await fetch('/api/offers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId,
          title: title,
          amount: amount,
          currency: currency,
          needsPrint: false,
          dataJson: JSON.stringify(dataJson)
        })
      });

      if (response.ok) {
        console.log('Offert sparad i Supabase:', await response.json());
        return true;
      } else {
        console.error('Fel vid sparande i Supabase:', await response.text());
        return false;
      }
    }
  } catch (error) {
    console.error('Error saving offer to Supabase:', error);
    return false;
  }
}
