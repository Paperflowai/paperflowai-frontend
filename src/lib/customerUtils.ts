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

  return {
    id: customerId,
    companyName: customerData?.companyName || offerData.customerName || "",
    orgNr: customerData?.orgNr || "",
    contactPerson: customerData?.contactPerson || "",
    role: customerData?.role || "",
    phone: customerData?.phone || "",
    email: customerData?.email || "",
    address: customerData?.address || "",
    zip: customerData?.zip || "",
    city: customerData?.city || "",
    country: customerData?.country || "Sverige",
    contactDate: today,
    notes: customerData?.notes || "",
    customerNumber: customerNumber,
    offers: [offerData]
  };
}
