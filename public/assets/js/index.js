const faker = require('faker');  // Menggunakan Faker.js
const fs = require('fs'); // Untuk menulis file jika diperlukan

// Fungsi untuk membuat data dummy siswa
const generateDummyData = (count = 20) => {
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({
      fullName: faker.name.findName(),
      nickname: faker.name.firstName(),
      parentName: faker.name.findName(),
      bornaDate: faker.date.past(10).toLocaleDateString('en-GB'),
      age: faker.random.number({ min: 5, max: 18 }),
      joinedDate: faker.date.past(2).toLocaleDateString('en-GB'),
      duration: `${faker.random.number({ min: 1, max: 3 })} years`,
      initialClass: `Class ${faker.random.arrayElement(['A', 'B', 'C', 'D'])}`,
      currentClass: `Class ${faker.random.arrayElement(['A', 'B', 'C', 'D'])}`,
      phone: faker.phone.phoneNumber(),
      city: faker.address.city(),
      school: faker.company.companyName(),
      address: faker.address.streetAddress(),
      email: faker.internet.email(),
    });
  }
  return data;
};

// Generate 20 data siswa dan simpan dalam file JSON
const dummyData = generateDummyData(20);
fs.writeFileSync('dummyData.json', JSON.stringify(dummyData, null, 2));
console.log('Data dummy telah disimpan dalam dummyData.json');