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
    const photoPath = req.file ? `/uploads/students/${req.file.filename}` : null;

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
      gmaps
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
        photoPath
      ]
    );

    res.status(201).json({
      message: 'Data siswa berhasil ditambahkan',
      id: result.insertId,
      photo: photoPath
    });
  } catch (error) {
    console.error('CREATE STUDENT ERROR:', error);

    res.status(500).json({
      message: 'Gagal menambahkan data siswa',
      error: error.sqlMessage || error.message
    });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const photoPath = req.file ? `/uploads/students/${req.file.filename}` : null;

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
      gmaps
    } = req.body;

    if (!full_name) {
      return res.status(400).json({
        message: 'Full name wajib diisi'
      });
    }

    const [existingRows] = await db.query(
      `
      SELECT id, photo
      FROM students
      WHERE id = ?
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        message: 'Data siswa tidak ditemukan'
      });
    }

    let updateQuery = `
      UPDATE students
      SET
        full_name = ?,
        nickname = ?,
        parent_name = ?,
        born_date = ?,
        age = ?,
        joined_date = ?,
        duration = ?,
        initial_class = ?,
        current_class = ?,
        phone = ?,
        city = ?,
        school = ?,
        address = ?,
        email = ?,
        gmaps = ?
    `;

    const params = [
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
      gmaps || null
    ];

    if (photoPath) {
      updateQuery += `,
        photo = ?
      `;

      params.push(photoPath);
    }

    updateQuery += `
      WHERE id = ?
    `;

    params.push(id);

    await db.query(updateQuery, params);

    res.json({
      message: 'Data siswa berhasil diperbarui',
      photo: photoPath || existingRows[0].photo || null
    });
  } catch (error) {
    console.error('UPDATE STUDENT ERROR:', error);

    res.status(500).json({
      message: 'Gagal memperbarui data siswa',
      error: error.sqlMessage || error.message
    });
  }
};

exports.deleteStudent = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;

    await connection.beginTransaction();

    const [studentRows] = await connection.query(
      `
      SELECT id, full_name
      FROM students
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (studentRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Data siswa tidak ditemukan'
      });
    }

    /**
     * Urutan delete:
     * 1. schedule_exceptions terkait routine_schedules siswa
     * 2. routine_schedules siswa
     * 3. summaries siswa yang masih pending
     * 4. student_levels siswa
     * 5. siswa
     *
     * Catatan:
     * Summary terkirim sebaiknya tidak dihapus karena sudah mengurangi kredit.
     */

    const [approvedSummaryRows] = await connection.query(
      `
      SELECT id
      FROM summaries
      WHERE student_id = ?
      AND status = 'terkirim'
      LIMIT 1
      `,
      [id]
    );

    if (approvedSummaryRows.length > 0) {
      await connection.rollback();

      return res.status(400).json({
        message: 'Siswa tidak bisa dihapus permanen karena sudah memiliki summary yang disetujui admin'
      });
    }

    await connection.query(
      `
      DELETE se
      FROM schedule_exceptions se
      JOIN routine_schedules rs ON rs.id = se.routine_schedule_id
      WHERE rs.student_id = ?
      `,
      [id]
    );

    await connection.query(
      `
      DELETE FROM routine_schedules
      WHERE student_id = ?
      `,
      [id]
    );

    await connection.query(
      `
      DELETE FROM summaries
      WHERE student_id = ?
      AND status = 'pending'
      `,
      [id]
    );

    await connection.query(
      `
      DELETE FROM student_levels
      WHERE student_id = ?
      `,
      [id]
    );

    /**
     * Kalau schema kamu punya invoice_items.student_id,
     * invoice_items juga perlu dicek. Untuk aman, jangan hapus siswa
     * yang punya invoice/credit purchase.
     */
    const [invoiceItemRows] = await connection.query(
      `
      SELECT id
      FROM invoice_items
      WHERE student_id = ?
      LIMIT 1
      `,
      [id]
    );

    if (invoiceItemRows.length > 0) {
      await connection.rollback();

      return res.status(400).json({
        message: 'Siswa tidak bisa dihapus permanen karena sudah memiliki riwayat invoice/pembelian kredit'
      });
    }

    await connection.query(
      `
      DELETE FROM students
      WHERE id = ?
      `,
      [id]
    );

    await connection.commit();

    res.json({
      message: 'Data siswa berhasil dihapus permanen'
    });
  } catch (error) {
    await connection.rollback();

    console.error('DELETE STUDENT ERROR:', error);

    res.status(500).json({
      message: 'Gagal menghapus data siswa permanen',
      error: error.sqlMessage || error.message
    });
  } finally {
    connection.release();
  }
};

exports.getMentorStudents = async (req, res) => {
  try {
    const mentorId = req.user.id;

    const [rows] = await db.query(
      `
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
      JOIN student_levels sl ON sl.student_id = s.id
      WHERE sl.mentor_id = ?
      AND s.deleted_at IS NULL
      ORDER BY s.full_name ASC
      `,
      [mentorId]
    );

    res.json(rows);
  } catch (error) {
    console.error('GET MENTOR STUDENTS ERROR:', error);

    res.status(500).json({
      message: 'Gagal mengambil data siswa mentor',
      error: error.sqlMessage || error.message
    });
  }
};

exports.getMentorStudentById = async (req, res) => {
  try {
    const mentorId = req.user.id;
    const { id } = req.params;

    const [studentRows] = await db.query(
      `
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
      JOIN student_levels sl ON sl.student_id = s.id
      WHERE s.id = ?
      AND sl.mentor_id = ?
      AND s.deleted_at IS NULL
      LIMIT 1
      `,
      [id, mentorId]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({
        message: 'Data siswa tidak ditemukan atau bukan siswa mentor ini'
      });
    }

    const [levelRows] = await db.query(
      `
      SELECT
        sl.id AS student_level_id,
        sl.level_id,
        l.level_name,
        sl.remaining_credit,
        sl.latest_expired_at
      FROM student_levels sl
      JOIN levels l ON l.id = sl.level_id
      WHERE sl.student_id = ?
      AND sl.mentor_id = ?
      ORDER BY l.level_name ASC
      `,
      [id, mentorId]
    );

    const [recordRows] = await db.query(
      `
      SELECT
        sm.id,
        sm.level_id,
        l.level_name,
        sm.class_date,
        sm.keterangan,
        sm.summary_text,
        sm.status
      FROM summaries sm
      JOIN levels l ON l.id = sm.level_id
      WHERE sm.student_id = ?
      AND sm.mentor_id = ?
      ORDER BY sm.class_date DESC, sm.id DESC
      `,
      [id, mentorId]
    );

    res.json({
      student: studentRows[0],
      levels: levelRows,
      records: recordRows
    });
  } catch (error) {
    console.error('GET MENTOR STUDENT DETAIL ERROR:', error);

    res.status(500).json({
      message: 'Gagal mengambil detail siswa mentor',
      error: error.sqlMessage || error.message
    });
  }
};