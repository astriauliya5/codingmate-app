const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        message: 'Username/email dan password wajib diisi'
      });
    }

    const [rows] = await db.query(
      `
      SELECT *
      FROM users
      WHERE (username = ? OR email = ?)
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [login, login]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: 'Akun tidak ditemukan'
      });
    }

    const user = rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Password salah'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

    const redirectUrl =
      user.role === 'admin'
        ? '/admin/jadwal-siswa/jadwal-siswa.html'
        : '/mentor/jadwal-siswa/jadwal-siswa.html';

    res.json({
      message: 'Login berhasil',
      token,
      redirectUrl,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    res.status(500).json({
      message: 'Terjadi kesalahan saat login'
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        id,
        username,
        email,
        full_name,
        phone,
        address,
        role
      FROM users
      WHERE id = ?
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'User tidak ditemukan'
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('GET ME ERROR:', error);
    res.status(500).json({
      message: 'Gagal mengambil data user'
    });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      username,
      full_name,
      email,
      phone,
      address
    } = req.body;

    if (!username || !full_name || !email) {
      return res.status(400).json({
        message: 'Username, nama lengkap, dan email wajib diisi'
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
      [username, email, userId]
    );

    if (duplicateRows.length > 0) {
      return res.status(400).json({
        message: 'Username atau email sudah digunakan akun lain'
      });
    }

    await db.query(
      `
      UPDATE users
      SET
        username = ?,
        full_name = ?,
        email = ?,
        phone = ?,
        address = ?
      WHERE id = ?
      `,
      [
        username,
        full_name,
        email,
        phone || null,
        address || null,
        userId
      ]
    );

    const [updatedRows] = await db.query(
      `
      SELECT
        id,
        username,
        email,
        full_name,
        phone,
        address,
        role
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    res.json({
      message: 'Informasi akun berhasil diperbarui',
      user: updatedRows[0]
    });
  } catch (error) {
    console.error('UPDATE ME ERROR:', error);

    res.status(500).json({
      message: 'Gagal memperbarui informasi akun',
      error: error.sqlMessage || error.message
    });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      old_password,
      new_password,
      confirm_password
    } = req.body;

    if (!old_password || !new_password || !confirm_password) {
      return res.status(400).json({
        message: 'Semua kolom password wajib diisi'
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({
        message: 'Password baru dan konfirmasi password tidak sama'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        message: 'Password baru minimal 6 karakter'
      });
    }

    const [userRows] = await db.query(
      `
      SELECT id, password
      FROM users
      WHERE id = ?
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        message: 'User tidak ditemukan'
      });
    }

    const user = userRows[0];

    const isOldPasswordValid = await bcrypt.compare(old_password, user.password);

    if (!isOldPasswordValid) {
      return res.status(400).json({
        message: 'Password lama tidak sesuai'
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await db.query(
      `
      UPDATE users
      SET password = ?
      WHERE id = ?
      `,
      [hashedPassword, userId]
    );

    res.json({
      message: 'Password berhasil diperbarui'
    });
  } catch (error) {
    console.error('UPDATE PASSWORD ERROR:', error);

    res.status(500).json({
      message: 'Gagal memperbarui password',
      error: error.sqlMessage || error.message
    });
  }
};