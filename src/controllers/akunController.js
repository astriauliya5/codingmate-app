const db = require('../config/db');
const bcrypt = require('bcrypt');

exports.getAkunMentor = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        id,
        username,
        full_name,
        email,
        phone,
        address,
        role,
        created_at,
        updated_at
      FROM users
      WHERE role = 'mentor'
      AND deleted_at IS NULL
      ORDER BY id DESC
    `);

    const data = rows.map(row => ({
      ...row,
      password_display: '********'
    }));

    res.json(data);
  } catch (error) {
    console.error('GET AKUN MENTOR ERROR:', error);
    res.status(500).json({
      message: 'Gagal mengambil data akun mentor'
    });
  }
};

exports.getAkunMentorById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT
        id,
        username,
        full_name,
        email,
        phone,
        address,
        role,
        created_at,
        updated_at
      FROM users
      WHERE id = ?
      AND role = 'mentor'
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Data akun mentor tidak ditemukan'
      });
    }

    res.json({
      ...rows[0],
      password_display: '********'
    });
  } catch (error) {
    console.error('GET DETAIL AKUN MENTOR ERROR:', error);
    res.status(500).json({
      message: 'Gagal mengambil detail akun mentor'
    });
  }
};

exports.createAkunMentor = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      full_name,
      phone,
      address
    } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({
        message: 'Username, email, password, dan nama lengkap wajib diisi'
      });
    }

    const [existingRows] = await db.query(
      `
      SELECT id
      FROM users
      WHERE (username = ? OR email = ?)
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [username, email]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({
        message: 'Username atau email sudah digunakan'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `
      INSERT INTO users
      (
        username,
        email,
        password,
        full_name,
        phone,
        address,
        role
      )
      VALUES (?, ?, ?, ?, ?, ?, 'mentor')
      `,
      [
        username,
        email,
        hashedPassword,
        full_name,
        phone || null,
        address || null
      ]
    );

    res.status(201).json({
      message: 'Akun mentor berhasil ditambahkan',
      id: result.insertId
    });
  } catch (error) {
    console.error('CREATE AKUN MENTOR ERROR:', error);
    res.status(500).json({
      message: 'Gagal menambahkan akun mentor'
    });
  }
};

exports.updateAkunMentor = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      username,
      email,
      full_name,
      phone,
      address,
      new_password
    } = req.body;

    const [akunRows] = await db.query(
      `
      SELECT id
      FROM users
      WHERE id = ?
      AND role = 'mentor'
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [id]
    );

    if (akunRows.length === 0) {
      return res.status(404).json({
        message: 'Data akun mentor tidak ditemukan'
      });
    }

    if (!username || !email || !full_name) {
      return res.status(400).json({
        message: 'Username, email, dan nama lengkap wajib diisi'
      });
    }

    const [duplicateRows] = await db.query(
      `
      SELECT id
      FROM users
      WHERE (username = ? OR email = ?)
      AND id != ?
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [username, email, id]
    );

    if (duplicateRows.length > 0) {
      return res.status(400).json({
        message: 'Username atau email sudah digunakan akun lain'
      });
    }

    if (new_password && new_password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(new_password, 10);

      await db.query(
        `
        UPDATE users
        SET
          username = ?,
          email = ?,
          full_name = ?,
          phone = ?,
          address = ?,
          password = ?
        WHERE id = ?
        AND role = 'mentor'
        `,
        [
          username,
          email,
          full_name,
          phone || null,
          address || null,
          hashedPassword,
          id
        ]
      );
    } else {
      await db.query(
        `
        UPDATE users
        SET
          username = ?,
          email = ?,
          full_name = ?,
          phone = ?,
          address = ?
        WHERE id = ?
        AND role = 'mentor'
        `,
        [
          username,
          email,
          full_name,
          phone || null,
          address || null,
          id
        ]
      );
    }

    res.json({
      message: 'Data akun mentor berhasil diperbarui'
    });
  } catch (error) {
    console.error('UPDATE AKUN MENTOR ERROR:', error);
    res.status(500).json({
      message: 'Gagal memperbarui data akun mentor'
    });
  }
};

exports.deleteAkunMentor = async (req, res) => {
  try {
    const { id } = req.params;

    // Cek akun mentor ada atau tidak
    const [mentorRows] = await db.query(
      `
      SELECT id, username, email, full_name
      FROM users
      WHERE id = ?
      AND role = 'mentor'
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [id]
    );

    if (mentorRows.length === 0) {
      return res.status(404).json({
        message: 'Akun mentor tidak ditemukan'
      });
    }

    // Cek apakah mentor masih punya jadwal rutin aktif
    const [activeScheduleRows] = await db.query(
      `
      SELECT id
      FROM routine_schedules
      WHERE mentor_id = ?
      AND status = 'active'
      LIMIT 1
      `,
      [id]
    );

    if (activeScheduleRows.length > 0) {
      return res.status(400).json({
        message: 'Akun mentor tidak dapat dihapus karena masih memiliki jadwal rutin aktif'
      });
    }

    // Cek apakah mentor masih terhubung sebagai mentor siswa-level
    const [studentLevelRows] = await db.query(
      `
      SELECT id
      FROM student_levels
      WHERE mentor_id = ?
      LIMIT 1
      `,
      [id]
    );

    if (studentLevelRows.length > 0) {
      return res.status(400).json({
        message: 'Akun mentor tidak dapat dihapus karena masih terhubung dengan level siswa'
      });
    }

    // hard delete mentor
    await db.query(
      `
      UPDATE users
      SET 
        deleted_at = NOW(),
        username = CONCAT(username, '_deleted_', id),
        email = CONCAT('deleted_', id, '_', email)
      WHERE id = ?
      AND role = 'mentor'
      `,
      [id]
    );

    res.json({
      message: 'Akun mentor berhasil dihapus'
    });
  } catch (error) {
    console.error('DELETE AKUN MENTOR ERROR:', error);
    console.error('SQL MESSAGE:', error.sqlMessage);

    res.status(500).json({
      message: 'Gagal menghapus akun mentor',
      error: error.sqlMessage || error.message
    });
  }
};