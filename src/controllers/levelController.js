const db = require('../config/db');

exports.getLevels = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        id,
        level_name,
        price,
        is_active,
        created_at,
        updated_at
      FROM levels
      WHERE is_active = TRUE
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('GET LEVELS ERROR:', error);
    res.status(500).json({
      message: 'Gagal mengambil data level'
    });
  }
};

exports.getLevelById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT
        id,
        level_name,
        price,
        is_active,
        created_at,
        updated_at
      FROM levels
      WHERE id = ?
      AND is_active = TRUE
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Data level tidak ditemukan'
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('GET LEVEL DETAIL ERROR:', error);
    res.status(500).json({
      message: 'Gagal mengambil detail level'
    });
  }
};

exports.createLevel = async (req, res) => {
  try {
    const { level_name, price } = req.body;

    if (!level_name || price === undefined || price === null || price === '') {
      return res.status(400).json({
        message: 'Nama level dan harga wajib diisi'
      });
    }

    const numericPrice = Number(price);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        message: 'Harga level tidak valid'
      });
    }

    const [existingRows] = await db.query(
      `
      SELECT id
      FROM levels
      WHERE level_name = ?
      AND is_active = TRUE
      LIMIT 1
      `,
      [level_name]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({
        message: 'Nama level sudah digunakan'
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO levels (level_name, price)
      VALUES (?, ?)
      `,
      [level_name, numericPrice]
    );

    res.status(201).json({
      message: 'Level berhasil ditambahkan',
      id: result.insertId
    });
  } catch (error) {
    console.error('CREATE LEVEL ERROR:', error);
    res.status(500).json({
      message: 'Gagal menambahkan data level'
    });
  }
};

exports.updateLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const { level_name, price } = req.body;

    if (!level_name || price === undefined || price === null || price === '') {
      return res.status(400).json({
        message: 'Nama level dan harga wajib diisi'
      });
    }

    const numericPrice = Number(price);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        message: 'Harga level tidak valid'
      });
    }

    const [levelRows] = await db.query(
      `
      SELECT id
      FROM levels
      WHERE id = ?
      AND is_active = TRUE
      LIMIT 1
      `,
      [id]
    );

    if (levelRows.length === 0) {
      return res.status(404).json({
        message: 'Data level tidak ditemukan'
      });
    }

    const [duplicateRows] = await db.query(
      `
      SELECT id
      FROM levels
      WHERE level_name = ?
      AND id != ?
      AND is_active = TRUE
      LIMIT 1
      `,
      [level_name, id]
    );

    if (duplicateRows.length > 0) {
      return res.status(400).json({
        message: 'Nama level sudah digunakan level lain'
      });
    }

    await db.query(
      `
      UPDATE levels
      SET level_name = ?, price = ?
      WHERE id = ?
      `,
      [level_name, numericPrice, id]
    );

    res.json({
      message: 'Data level berhasil diperbarui'
    });
  } catch (error) {
    console.error('UPDATE LEVEL ERROR:', error);
    res.status(500).json({
      message: 'Gagal memperbarui data level'
    });
  }
};

exports.deleteLevel = async (req, res) => {
  try {
    const { id } = req.params;

    const [levelRows] = await db.query(
      `
      SELECT id
      FROM levels
      WHERE id = ?
      AND is_active = TRUE
      LIMIT 1
      `,
      [id]
    );

    if (levelRows.length === 0) {
      return res.status(404).json({
        message: 'Data level tidak ditemukan'
      });
    }

    // soft delete supaya histori invoice, summary, jadwal tidak rusak
    await db.query(
      `
      UPDATE levels
      SET is_active = FALSE
      WHERE id = ?
      `,
      [id]
    );

    res.json({
      message: 'Data level berhasil dihapus'
    });
  } catch (error) {
    console.error('DELETE LEVEL ERROR:', error);
    res.status(500).json({
      message: 'Gagal menghapus data level'
    });
  }
};