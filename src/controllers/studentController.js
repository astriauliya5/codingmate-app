const db = require('../config/db');

exports.getStudents = async (req, res) => {
  try {
    let query = `
      SELECT DISTINCT
        s.id,
        s.full_name,
        s.nickname,
        s.parent_name,
        s.born_date,
        s.age,
        s.joined_date,
        s.duration,
        s.initial_class,
        s.current_class,
        s.phone,
        s.city,
        s.school,
        s.address,
        s.email,
        s.gmaps,
        s.photo
      FROM students s
    `;

    const params = [];

    if (req.user.role === 'mentor') {
      query += `
        JOIN student_levels sl ON sl.student_id = s.id
        WHERE s.deleted_at IS NULL
        AND sl.mentor_id = ?
      `;
      params.push(req.user.id);
    } else {
      query += `
        WHERE s.deleted_at IS NULL
      `;
    }

    query += `
      ORDER BY s.id DESC
    `;

    const [rows] = await db.query(query, params);

    res.json(rows);
  } catch (error) {
    console.error('GET STUDENTS ERROR:', error);
    res.status(500).json({
      message: 'Gagal mengambil data siswa'
    });
  }
};

exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    let query = `
      SELECT DISTINCT
        s.id,
        s.full_name,
        s.nickname,
        s.parent_name,
        s.born_date,
        s.age,
        s.joined_date,
        s.duration,
        s.initial_class,
        s.current_class,
        s.phone,
        s.city,
        s.school,
        s.address,
        s.email,
        s.gmaps,
        s.photo
      FROM students s
    `;

    const params = [id];

    if (req.user.role === 'mentor') {
      query += `
        JOIN student_levels sl ON sl.student_id = s.id
        WHERE s.id = ?
        AND s.deleted_at IS NULL
        AND sl.mentor_id = ?
      `;
      params.push(req.user.id);
    } else {
      query += `
        WHERE s.id = ?
        AND s.deleted_at IS NULL
      `;
    }

    const [rows] = await db.query(query, params);

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Data siswa tidak ditemukan'
      });
    }

    const student = rows[0];

    const [levels] = await db.query(
      `
      SELECT 
        sl.id,
        sl.student_id,
        sl.level_id,
        sl.mentor_id,
        l.level_name,
        u.full_name AS mentor_name,
        sl.remaining_credit,
        sl.latest_expired_at
      FROM student_levels sl
      JOIN levels l ON sl.level_id = l.id
      LEFT JOIN users u ON sl.mentor_id = u.id
      WHERE sl.student_id = ?
      ORDER BY l.level_name ASC
      `,
      [id]
    );

    student.levels = levels;

    res.json(student);
  } catch (error) {
    console.error('GET STUDENT DETAIL ERROR:', error);
    res.status(500).json({
      message: 'Gagal mengambil detail siswa'
    });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const {
      full_name,
      nickname,
      parent_name,
      born_date,
      age,
      joined_date,
      duration,
      initial_class,
      current_class,
      phone,
      city,
      school,
      address,
      email,
      gmaps,
      photo
    } = req.body;

    if (!full_name) {
      return res.status(400).json({
        message: 'full_name wajib diisi'
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO students
      (
        full_name,
        nickname,
        parent_name,
        born_date,
        age,
        joined_date,
        duration,
        initial_class,
        current_class,
        phone,
        city,
        school,
        address,
        email,
        gmaps,
        photo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        full_name,
        nickname || null,
        parent_name || null,
        born_date || null,
        age || null,
        joined_date || null,
        duration || null,
        initial_class || null,
        current_class || null,
        phone || null,
        city || null,
        school || null,
        address || null,
        email || null,
        gmaps || null,
        photo || null
      ]
    );

    res.status(201).json({
      message: 'Data siswa berhasil ditambahkan',
      id: result.insertId
    });
  } catch (error) {
    console.error('CREATE STUDENT ERROR:', error);
    res.status(500).json({
      message: 'Gagal menambahkan data siswa'
    });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT id FROM students WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Data siswa tidak ditemukan'
      });
    }

    await db.query(
      `UPDATE students SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );

    res.json({
      message: 'Data siswa berhasil dihapus'
    });
  } catch (error) {
    console.error('DELETE STUDENT ERROR:', error);
    res.status(500).json({
      message: 'Gagal menghapus data siswa'
    });
  }
};