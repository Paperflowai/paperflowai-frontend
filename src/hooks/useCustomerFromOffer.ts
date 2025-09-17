import { useCallback } from 'react';
import { saveCustomerToLocalStorage, findExistingCustomer, createCustomerFromOffer, Customer } from '@/lib/customerUtils';

export function useCustomerFromOffer() {
  const createOrFindCustomer = useCallback(async (offerData: any, customerData?: any) => {
    try {
      // Först sök efter befintlig kund
      const searchCriteria = {
        companyName: customerData?.companyName || offerData.customerName,
        email: customerData?.email,
        orgNr: customerData?.orgNr,
        phone: customerData?.phone
      };

      const existingCustomer = findExistingCustomer(searchCriteria);

      if (existingCustomer) {
        // Använd befintlig kund och lägg till offerten
        const updatedCustomer = {
          ...existingCustomer,
          offers: [...(existingCustomer.offers || []), offerData]
        };

        const saved = saveCustomerToLocalStorage(updatedCustomer);
        
        return {
          success: saved,
          customer: updatedCustomer,
          customerFound: true,
          message: "Offert tillagd till befintlig kund"
        };
      } else {
        // Skapa ny kund
        const newCustomer = createCustomerFromOffer(offerData, customerData);
        const saved = saveCustomerToLocalStorage(newCustomer);

        return {
          success: saved,
          customer: newCustomer,
          customerFound: false,
          message: "Ny kund och offert skapade automatiskt"
        };
      }
    } catch (error) {
      console.error('Error creating/finding customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  return { createOrFindCustomer };
}
