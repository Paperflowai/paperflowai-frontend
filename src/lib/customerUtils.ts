// src/lib/customerUtils.ts
import { Customer } from "@/types/offert";

export function formatCustomerName(customer) {
  if (customer.companyName) {
    return customer.companyName;
  }
  if (customer.firstName && customer.lastName) {
    return `${customer.firstName} ${customer.lastName}`;
  }
  if (customer.firstName) {
    return customer.firstName;
  }
  return "Okänd kund";
}

export function formatCustomerAddress(customer) {
  const parts = [
    customer.streetAddress,
    customer.postalCode,
    customer.city
  ].filter(Boolean);
  
  return parts.join(", ");
}

export function formatCustomerContact(customer) {
  if (customer.email) {
    return customer.email;
  }
  if (customer.phone) {
    return customer.phone;
  }
  return "";
}

export function getCustomerInitials(customer) {
  if (customer.companyName) {
    return customer.companyName.substring(0, 2).toUpperCase();
  }
  if (customer.firstName && customer.lastName) {
    return (customer.firstName[0] + customer.lastName[0]).toUpperCase();
  }
  if (customer.firstName) {
    return customer.firstName.substring(0, 2).toUpperCase();
  }
  return "??";
}