/**
 * Check localStorage for old/stale customer data
 * Kör detta i DevTools Console (F12)
 */

console.log('='.repeat(60));
console.log('🔍 Checking localStorage for customer data...');
console.log('='.repeat(60));

// 1. Kolla customerStore
const KEY = 'paperflow_customers_v1';
const rawData = localStorage.getItem(KEY);

if (!rawData) {
  console.log('❌ No customer data found in localStorage');
  console.log('   Key checked:', KEY);
} else {
  try {
    const customers = JSON.parse(rawData);
    console.log(`✅ Found ${customers.length} customers in localStorage\n`);

    // Visa alla kunder
    console.log('📋 Customers in cache:');
    console.table(customers.map((c, i) => ({
      '#': i + 1,
      id: c.id || 'N/A',
      companyName: c.companyName || 'N/A',
      email: c.email || 'N/A',
      orgNr: c.orgNr || 'N/A',
      offers: c.offers?.length || 0
    })));

    // Kolla efter problem
    console.log('\n🔍 Checking for issues:\n');

    let issues = 0;

    customers.forEach((c, i) => {
      const problems = [];

      // Problem 1: Saknar företagsnamn
      if (!c.companyName || c.companyName.trim() === '') {
        problems.push('❌ Missing company name');
      }

      // Problem 2: Företagsnamn är placeholder
      if (c.companyName === 'OKÄNT FÖRETAG' ||
          c.companyName === 'Ny kund' ||
          c.companyName === 'Namnlös kund') {
        problems.push(`⚠️  Company name is placeholder: "${c.companyName}"`);
      }

      // Problem 3: Gamla fält-namn (svensk → engelsk)
      if (c.namn || c.orgnr || c.telefon || c.epost) {
        problems.push('⚠️  Has old Swedish field names (namn, orgnr, etc.)');
      }

      // Problem 4: Saknar ID
      if (!c.id) {
        problems.push('❌ Missing ID');
      }

      if (problems.length > 0) {
        issues++;
        console.log(`Customer #${i + 1} (${c.companyName || 'UNNAMED'}):`);
        problems.forEach(p => console.log('  ' + p));
        console.log('');
      }
    });

    if (issues === 0) {
      console.log('✅ No issues found in localStorage!');
    } else {
      console.log(`⚠️  Found ${issues} customer(s) with issues`);
    }

    // Statistik
    console.log('\n📊 Statistics:');
    console.log(`Total customers: ${customers.length}`);
    console.log(`With company name: ${customers.filter(c => c.companyName && c.companyName.trim()).length}`);
    console.log(`Placeholders: ${customers.filter(c => ['OKÄNT FÖRETAG', 'Ny kund', 'Namnlös kund'].includes(c.companyName)).length}`);
    console.log(`With email: ${customers.filter(c => c.email).length}`);
    console.log(`With org.nr: ${customers.filter(c => c.orgNr).length}`);

  } catch (e) {
    console.error('❌ Error parsing localStorage data:', e);
    console.log('Raw data:', rawData.substring(0, 200) + '...');
  }
}

// 2. Kolla andra customer-relaterade keys
console.log('\n' + '='.repeat(60));
console.log('🔍 Checking for other customer-related keys...');
console.log('='.repeat(60) + '\n');

const allKeys = Object.keys(localStorage);
const customerKeys = allKeys.filter(k => k.includes('kund') || k.includes('customer'));

if (customerKeys.length === 0) {
  console.log('No other customer keys found');
} else {
  console.log(`Found ${customerKeys.length} customer-related keys:\n`);
  customerKeys.forEach(key => {
    const value = localStorage.getItem(key);
    const size = value ? (value.length / 1024).toFixed(2) : 0;
    console.log(`  📦 ${key}`);
    console.log(`     Size: ${size} KB`);

    // Visa preview för små objekt
    if (value && value.length < 200) {
      console.log(`     Value: ${value}`);
    }
    console.log('');
  });
}

// 3. Förslag på åtgärder
console.log('='.repeat(60));
console.log('💡 Recommendations:');
console.log('='.repeat(60) + '\n');

if (rawData) {
  const customers = JSON.parse(rawData);
  const hasPlaceholders = customers.some(c =>
    ['OKÄNT FÖRETAG', 'Ny kund', 'Namnlös kund'].includes(c.companyName)
  );

  if (hasPlaceholders) {
    console.log('⚠️  Found placeholder company names in cache');
    console.log('   → This might be old data from before the fix');
    console.log('   → Recommendation: Clear cache and reload from database');
    console.log('\n   To clear:');
    console.log('   localStorage.clear()');
    console.log('   location.reload()');
  } else {
    console.log('✅ Cache looks good!');
    console.log('   All customers have real company names');
  }
} else {
  console.log('ℹ️  No cache found - all data will load fresh from database');
}

console.log('\n' + '='.repeat(60));
console.log('Done! ✓');
console.log('='.repeat(60));
