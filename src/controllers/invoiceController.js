const db = require('../config/db');

function generateInvoiceNo() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = String(now.getTime()).slice(-6);

  return `INV-${datePart}-${timePart}`;
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result.toISOString().slice(0, 10);
}

function getBaseExpiredDate(currentExpiredAt, paidAt) {
  if (!currentExpiredAt) {
    return paidAt;
  }

  const currentExpiredDate = new Date(currentExpiredAt);
  const paidDate = new Date(paidAt);

  if (currentExpiredDate > paidDate) {
    return currentExpiredDate;
  }

  return paidDate;
}

function calculateExpiredAt(classType, creditAmount, currentExpiredAt, paidAt) {
  if (classType === 'trial') {
    return addMonths(paidAt, 1);
  }

  const monthToAdd = Math.floor(Number(creditAmount) / 4);
  const baseDate = getBaseExpiredDate(currentExpiredAt, paidAt);

  return addMonths(baseDate, monthToAdd);
}

function normalizeClassType(classType) {
  return classType === 'trial' ? 'trial' : 'reguler';
}

exports.getInvoices = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        i.id AS invoice_id,
        i.invoice_no,
        i.invoice_date,
        i.status,
        i.grand_total,
        i.paid_at,

        ii.id AS invoice_item_id,
        ii.student_id,
        s.full_name AS student_name,
        ii.level_id,
        l.level_name,
        ii.class_type,
        ii.credit_amount,
        ii.price_per_credit,
        ii.subtotal,

        sl.remaining_credit,
        sl.latest_expired_at

      FROM invoices i
      JOIN invoice_items ii ON ii.invoice_id = i.id
      JOIN students s ON s.id = ii.student_id
      JOIN levels l ON l.id = ii.level_id
      LEFT JOIN student_levels sl 
        ON sl.student_id = ii.student_id 
        AND sl.level_id = ii.level_id

      WHERE i.deleted_at IS NULL
      ORDER BY i.id DESC, ii.id ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('GET INVOICES ERROR:', error);
    res.status(500).json({
      message: 'Gagal mengambil data invoice'
    });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const [invoiceRows] = await db.query(
      `
      SELECT *
      FROM invoices
      WHERE id = ?
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [id]
    );

    if (invoiceRows.length === 0) {
      return res.status(404).json({
        message: 'Invoice tidak ditemukan'
      });
    }

    const invoice = invoiceRows[0];

    const [items] = await db.query(
      `
      SELECT
        ii.id,
        ii.invoice_id,
        ii.student_id,
        s.full_name AS student_name,
        ii.level_id,
        l.level_name,
        ii.class_type,
        ii.credit_amount,
        ii.price_per_credit,
        ii.subtotal
      FROM invoice_items ii
      JOIN students s ON s.id = ii.student_id
      JOIN levels l ON l.id = ii.level_id
      WHERE ii.invoice_id = ?
      ORDER BY ii.id ASC
      `,
      [id]
    );

    invoice.items = items;

    res.json(invoice);
  } catch (error) {
    console.error('GET INVOICE DETAIL ERROR:', error);
    res.status(500).json({
      message: 'Gagal mengambil detail invoice'
    });
  }
};

exports.createInvoice = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      invoice_date,
      items
    } = req.body;

    if (!invoice_date) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Tanggal invoice wajib diisi'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Minimal harus ada 1 item pembelian'
      });
    }

    let grandTotal = 0;
    const normalizedItems = [];

    for (const item of items) {
      const studentId = Number(item.student_id);
      const levelId = Number(item.level_id);
      const classType = normalizeClassType(item.class_type);
      let creditAmount = Number(item.credit_amount);

      if (!studentId || !levelId) {
        await connection.rollback();
        return res.status(400).json({
          message: 'Student dan level wajib dipilih'
        });
      }

      const [studentRows] = await connection.query(
        `
        SELECT id
        FROM students
        WHERE id = ?
        AND deleted_at IS NULL
        LIMIT 1
        `,
        [studentId]
      );

      if (studentRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          message: 'Data siswa tidak ditemukan'
        });
      }

      const [levelRows] = await connection.query(
        `
        SELECT id, level_name, price
        FROM levels
        WHERE id = ?
        AND is_active = TRUE
        LIMIT 1
        `,
        [levelId]
      );

      if (levelRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          message: 'Data level tidak ditemukan'
        });
      }

      const level = levelRows[0];

      let pricePerCredit = Number(level.price);
      let subtotal = 0;

      if (classType === 'trial') {
        creditAmount = 1;
        pricePerCredit = 0;
        subtotal = 0;

        const [existingTrialRows] = await connection.query(
          `
          SELECT cp.id
          FROM credit_purchases cp
          WHERE cp.student_id = ?
          AND cp.level_id = ?
          AND cp.class_type = 'trial'
          LIMIT 1
          `,
          [studentId, levelId]
        );

        if (existingTrialRows.length > 0) {
          await connection.rollback();
          return res.status(400).json({
            message: `Siswa ini sudah pernah trial untuk level ${level.level_name}`
          });
        }

        const [pendingTrialRows] = await connection.query(
          `
          SELECT ii.id
          FROM invoice_items ii
          JOIN invoices i ON i.id = ii.invoice_id
          WHERE ii.student_id = ?
          AND ii.level_id = ?
          AND ii.class_type = 'trial'
          AND i.deleted_at IS NULL
          AND i.status != 'lunas'
          LIMIT 1
          `,
          [studentId, levelId]
        );

        if (pendingTrialRows.length > 0) {
          await connection.rollback();
          return res.status(400).json({
            message: `Sudah ada invoice trial yang belum selesai untuk level ${level.level_name}`
          });
        }
      }

      if (classType === 'reguler') {
        if (!creditAmount || creditAmount < 4 || creditAmount % 4 !== 0) {
          await connection.rollback();
          return res.status(400).json({
            message: 'Pembelian reguler minimal 4 kredit dan harus kelipatan 4'
          });
        }

        subtotal = pricePerCredit * creditAmount;
      }

      grandTotal += subtotal;

      normalizedItems.push({
        student_id: studentId,
        level_id: levelId,
        class_type: classType,
        credit_amount: creditAmount,
        price_per_credit: pricePerCredit,
        subtotal
      });
    }

    const invoiceNo = generateInvoiceNo();

    const [invoiceResult] = await connection.query(
      `
      INSERT INTO invoices
      (
        invoice_no,
        invoice_date,
        status,
        grand_total,
        created_by
      )
      VALUES (?, ?, 'pending', ?, ?)
      `,
      [
        invoiceNo,
        invoice_date,
        grandTotal,
        req.user.id
      ]
    );

    const invoiceId = invoiceResult.insertId;

    for (const item of normalizedItems) {
      await connection.query(
        `
        INSERT INTO invoice_items
        (
          invoice_id,
          student_id,
          level_id,
          class_type,
          credit_amount,
          price_per_credit,
          subtotal
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          invoiceId,
          item.student_id,
          item.level_id,
          item.class_type,
          item.credit_amount,
          item.price_per_credit,
          item.subtotal
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: 'Invoice berhasil dibuat',
      invoice_id: invoiceId,
      invoice_no: invoiceNo,
      grand_total: grandTotal
    });
    
  } catch (error) {
    await connection.rollback();

    console.error('CREATE INVOICE ERROR:', error);
    console.error('SQL MESSAGE:', error.sqlMessage);

    res.status(500).json({
      message: 'Gagal membuat invoice',
      error: error.sqlMessage || error.message
    });
  } finally {
    connection.release();
  }
};

exports.updateInvoiceStatus = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { status } = req.body;

    const allowedStatus = ['pending', 'invoice belum dikirim', 'lunas'];

    if (!allowedStatus.includes(status)) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Status invoice tidak valid'
      });
    }

    const [invoiceRows] = await connection.query(
      `
      SELECT *
      FROM invoices
      WHERE id = ?
      AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
      `,
      [id]
    );

    if (invoiceRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: 'Invoice tidak ditemukan'
      });
    }

    const invoice = invoiceRows[0];

    if (invoice.status === 'lunas') {
      await connection.rollback();
      return res.status(400).json({
        message: 'Invoice sudah lunas, status tidak dapat diubah lagi'
      });
    }

    // Kalau status bukan lunas, hanya update status biasa
    if (status !== 'lunas') {
      await connection.query(
        `
        UPDATE invoices
        SET status = ?
        WHERE id = ?
        `,
        [status, id]
      );

      await connection.commit();

      return res.json({
        message: 'Status invoice berhasil diperbarui'
      });
    }

    // Kalau status jadi lunas, baru proses kredit
    const paidAt = new Date();

    const [items] = await connection.query(
      `
      SELECT *
      FROM invoice_items
      WHERE invoice_id = ?
      ORDER BY id ASC
      `,
      [id]
    );

    for (const item of items) {
      if (item.class_type === 'trial') {
        const [existingTrialRows] = await connection.query(
          `
          SELECT id
          FROM credit_purchases
          WHERE student_id = ?
          AND level_id = ?
          AND class_type = 'trial'
          LIMIT 1
          `,
          [item.student_id, item.level_id]
        );

        if (existingTrialRows.length > 0) {
          await connection.rollback();
          return res.status(400).json({
            message: 'Invoice tidak bisa dilunaskan karena siswa sudah pernah trial untuk level tersebut'
          });
        }
      }

      const [studentLevelRows] = await connection.query(
        `
        SELECT 
          id,
          remaining_credit,
          latest_expired_at
        FROM student_levels
        WHERE student_id = ?
        AND level_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [item.student_id, item.level_id]
      );

      let studentLevelId;
      let previousExpiredAt = null;

      if (item.class_type === 'reguler') {
        await connection.query(
          `
          UPDATE routine_schedules
          SET end_date = ?
          WHERE student_id = ?
          AND level_id = ?
          AND class_type = 'reguler'
          AND status = 'active'
          AND (end_date IS NULL OR end_date < ?)
          `,
          [
            expiredAt,
            item.student_id,
            item.level_id,
            expiredAt
          ]
        );
      }

      if (studentLevelRows.length > 0) {
        studentLevelId = studentLevelRows[0].id;
        previousExpiredAt = studentLevelRows[0].latest_expired_at;
      }

      const expiredAt = calculateExpiredAt(
        item.class_type,
        item.credit_amount,
        previousExpiredAt,
        paidAt
      );

      if (studentLevelRows.length === 0) {
        const [studentLevelResult] = await connection.query(
          `
          INSERT INTO student_levels
          (
            student_id,
            level_id,
            mentor_id,
            remaining_credit,
            latest_expired_at
          )
          VALUES (?, ?, NULL, ?, ?)
          `,
          [
            item.student_id,
            item.level_id,
            item.credit_amount,
            expiredAt
          ]
        );

        studentLevelId = studentLevelResult.insertId;
      } else {
        await connection.query(
          `
          UPDATE student_levels
          SET
            remaining_credit = remaining_credit + ?,
            latest_expired_at = ?
          WHERE id = ?
          `,
          [
            item.credit_amount,
            expiredAt,
            studentLevelId
          ]
        );
      }

      await connection.query(
        `
        INSERT INTO credit_purchases
        (
          invoice_id,
          invoice_item_id,
          student_id,
          level_id,
          class_type,
          student_level_id,
          credit_amount,
          remaining_credit,
          paid_at,
          expired_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          item.id,
          item.student_id,
          item.level_id,
          item.class_type,
          studentLevelId,
          item.credit_amount,
          item.credit_amount,
          paidAt,
          expiredAt
        ]
      );
    }

    await connection.query(
      `
      UPDATE invoices
      SET 
        status = 'lunas',
        paid_at = ?
      WHERE id = ?
      `,
      [paidAt, id]
    );

    await connection.commit();

    res.json({
      message: 'Invoice berhasil dilunaskan dan kredit siswa sudah ditambahkan'
    });
  } catch (error) {
    await connection.rollback();

    console.error('UPDATE INVOICE STATUS ERROR:', error);
    console.error('SQL MESSAGE:', error.sqlMessage);

    res.status(500).json({
      message: 'Gagal memperbarui status invoice',
      error: error.sqlMessage || error.message
    });
  } finally {
    connection.release();
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const [invoiceRows] = await db.query(
      `
      SELECT id, status
      FROM invoices
      WHERE id = ?
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [id]
    );

    if (invoiceRows.length === 0) {
      return res.status(404).json({
        message: 'Invoice tidak ditemukan'
      });
    }

    const invoice = invoiceRows[0];

    if (invoice.status === 'lunas') {
      return res.status(400).json({
        message: 'Invoice lunas tidak dapat dihapus'
      });
    }

    await db.query(
      `
      UPDATE invoices
      SET deleted_at = NOW()
      WHERE id = ?
      `,
      [id]
    );

    res.json({
      message: 'Invoice berhasil dihapus'
    });
  } catch (error) {
    console.error('DELETE INVOICE ERROR:', error);

    res.status(500).json({
      message: 'Gagal menghapus invoice',
      error: error.sqlMessage || error.message
    });
  }
};