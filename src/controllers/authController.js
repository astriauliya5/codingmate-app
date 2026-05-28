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