const bcrypt = require('bcrypt');
const db = require('../src/config/db');

async function hashUsers() {
  try {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const mentorPassword = await bcrypt.hash('mentor123', 10);

    await db.query(
      `
      UPDATE users
      SET password = ?
      WHERE username = 'admin'
      `,
      [adminPassword]
    );

    await db.query(
      `
      UPDATE users
      SET password = ?
      WHERE username = 'mentor1'
      `,
      [mentorPassword]
    );

    console.log('Password admin dan mentor berhasil di-hash.');
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

hashUsers();