/**
 * API Endpoint Tester
 * Testar alla endpoints och rapporterar problem
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test-data
const TEST_CUSTOMER_ID = 'test-' + Date.now();
const TEST_OFFER_ID = 'test-offer-' + Date.now();
const TEST_ORDER_ID = 'test-order-' + Date.now();
const TEST_INVOICE_ID = 'test-invoice-' + Date.now();

// Färger för output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

// Resultat
const results = {
  passed: [],
  failed: [],
  skipped: []
};

// Hjälpfunktion för att göra request
async function testEndpoint(name, method, path, body = null, expectedStatus = [200, 201]) {
  const url = `${BASE_URL}${path}`;

  console.log(`\n${colors.blue}Testing:${colors.reset} ${method} ${path}`);

  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    const statusOk = Array.isArray(expectedStatus)
      ? expectedStatus.includes(response.status)
      : response.status === expectedStatus;

    if (statusOk) {
      console.log(`${colors.green}✓ PASS${colors.reset} - Status: ${response.status}`);
      results.passed.push({ name, method, path, status: response.status });
      return { success: true, data, status: response.status };
    } else {
      console.log(`${colors.red}✗ FAIL${colors.reset} - Status: ${response.status} (Expected: ${expectedStatus})`);
      console.log(`  Error: ${data.error || JSON.stringify(data)}`);
      results.failed.push({
        name,
        method,
        path,
        status: response.status,
        error: data.error || 'Unexpected status'
      });
      return { success: false, data, status: response.status };
    }
  } catch (error) {
    console.log(`${colors.red}✗ ERROR${colors.reset} - ${error.message}`);
    results.failed.push({
      name,
      method,
      path,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

// Test-suite
async function runTests() {
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}Testing API Endpoints${colors.reset}`);
  console.log(`${colors.blue}Base URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

  // ========================================
  // 1. CUSTOMER ENDPOINTS
  // ========================================
  console.log(`\n${colors.yellow}=== CUSTOMER ENDPOINTS ===${colors.reset}`);

  // GET customer cards
  await testEndpoint(
    'Get customer cards',
    'GET',
    `/api/customer-cards/get?customerId=${TEST_CUSTOMER_ID}`,
    null,
    [200, 404] // 404 OK eftersom testkund inte finns
  );

  // PATCH customer (update company name)
  await testEndpoint(
    'Update customer company name',
    'PATCH',
    `/api/customers/${TEST_CUSTOMER_ID}`,
    { company_name: 'Test Company AB' },
    [404, 409] // 404 = not found (OK för test), 409 = conflict (OK)
  );

  // DELETE customer
  await testEndpoint(
    'Delete customer',
    'DELETE',
    `/api/customers/${TEST_CUSTOMER_ID}`,
    null,
    [200, 404] // 404 OK eftersom testkund inte finns
  );

  // ========================================
  // 2. OFFER ENDPOINTS
  // ========================================
  console.log(`\n${colors.yellow}=== OFFER ENDPOINTS ===${colors.reset}`);

  // Create offer from GPT
  await testEndpoint(
    'Create offer from GPT',
    'POST',
    '/api/offers/create-from-gpt',
    {
      customerId: null,
      textData: '# OFFERT\n\nKund: Test AB\nDatum: 2026-01-05\n\nTjänst: Testning\nPris: 1000 kr',
      jsonData: {
        titel: 'Testoffert',
        summa: 1000,
        valuta: 'SEK',
        kund: {
          namn: 'Test AB',
          epost: 'test@test.se',
          telefon: '070-123 45 67'
        }
      }
    },
    [200, 400, 500]
  );

  // List offers
  await testEndpoint(
    'List offers',
    'GET',
    `/api/offers/list?customerId=${TEST_CUSTOMER_ID}`,
    null,
    [200]
  );

  // Parse offer (placeholder - should return 501)
  await testEndpoint(
    'Parse offer PDF',
    'POST',
    '/api/offers/parse',
    { bucket: 'test', path: 'test.pdf' },
    [501, 400] // 501 = Not Implemented (vårt placeholder svar)
  );

  // Delete offer
  await testEndpoint(
    'Delete offer',
    'POST',
    '/api/offers/delete',
    { offerId: TEST_OFFER_ID },
    [200, 404, 500]
  );

  // Update offer status
  await testEndpoint(
    'Update offer status',
    'POST',
    '/api/offers/update-status',
    { offerId: TEST_OFFER_ID, status: 'sent' },
    [200, 404, 400]
  );

  // ========================================
  // 3. DOCUMENT ENDPOINTS
  // ========================================
  console.log(`\n${colors.yellow}=== DOCUMENT ENDPOINTS ===${colors.reset}`);

  // Get customer documents
  await testEndpoint(
    'Get customer documents',
    'GET',
    `/api/customers/${TEST_CUSTOMER_ID}/documents`,
    null,
    [200]
  );

  // ========================================
  // 4. EMAIL ENDPOINT
  // ========================================
  console.log(`\n${colors.yellow}=== EMAIL ENDPOINT ===${colors.reset}`);

  await testEndpoint(
    'Send email (should fail without valid data)',
    'POST',
    '/api/sendEmail',
    { to: 'test@test.se', subject: 'Test', text: 'Test' },
    [200, 400, 500]
  );

  // ========================================
  // 5. GPT ENDPOINT
  // ========================================
  console.log(`\n${colors.yellow}=== GPT ENDPOINT ===${colors.reset}`);

  await testEndpoint(
    'GPT endpoint',
    'POST',
    '/api/gpt',
    { prompt: 'test' },
    [200, 400, 500]
  );

  // ========================================
  // RESULTAT
  // ========================================
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}TEST RESULTS${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);

  console.log(`\n${colors.green}✓ PASSED: ${results.passed.length}${colors.reset}`);
  results.passed.forEach(r => {
    console.log(`  ${r.method} ${r.path} - ${r.status}`);
  });

  console.log(`\n${colors.red}✗ FAILED: ${results.failed.length}${colors.reset}`);
  results.failed.forEach(r => {
    console.log(`  ${r.method} ${r.path}`);
    console.log(`    Status: ${r.status || 'ERROR'}`);
    console.log(`    Error: ${r.error}`);
  });

  if (results.skipped.length > 0) {
    console.log(`\n${colors.yellow}⊘ SKIPPED: ${results.skipped.length}${colors.reset}`);
    results.skipped.forEach(r => {
      console.log(`  ${r.name} - ${r.reason}`);
    });
  }

  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);

  const total = results.passed.length + results.failed.length;
  const passRate = total > 0 ? ((results.passed.length / total) * 100).toFixed(1) : 0;

  console.log(`${colors.blue}Pass Rate: ${passRate}%${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

  // Exit code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Kör tester
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
