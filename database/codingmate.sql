CREATE DATABASE IF NOT EXISTS codingmate;
USE codingmate;

-- =========================================================
-- 1. USERS
-- Akun admin dan mentor jadi satu tabel.
-- Mentor login bisa pakai username/password atau email/password.
-- =========================================================

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  role ENUM('admin', 'mentor') NOT NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- =========================================================
-- 2. STUDENTS
-- Satu siswa punya 1 mentor aktif.
-- current_class = kelas sekolah siswa, misal 1 SD / 2 SMP.
-- BUKAN level kursus.
-- =========================================================

CREATE TABLE students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mentor_id INT NOT NULL,

  full_name VARCHAR(150) NOT NULL,
  nickname VARCHAR(100),
  parent_name VARCHAR(150),
  born_date DATE,
  age INT,
  joined_date DATE,
  duration VARCHAR(100),

  initial_class VARCHAR(100),
  current_class VARCHAR(100),

  phone VARCHAR(50),
  city VARCHAR(100),
  school VARCHAR(150),
  address TEXT,
  email VARCHAR(150),
  gmaps TEXT,
  photo VARCHAR(255),

  deleted_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_students_mentor
    FOREIGN KEY (mentor_id) REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;


-- =========================================================
-- 3. LEVELS
-- Master data level dan harga.
-- =========================================================

CREATE TABLE levels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level_name VARCHAR(150) NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


-- =========================================================
-- 4. STUDENT_LEVELS
-- Menyimpan level yang dimiliki siswa.
-- remaining_credit = total sisa kredit aktif siswa pada level itu.
-- latest_expired_at = tanggal expired terbaru untuk tampilan ringkas.
-- =========================================================

CREATE TABLE student_levels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  level_id INT NOT NULL,

  remaining_credit INT NOT NULL DEFAULT 0,
  latest_expired_at DATE NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_student_levels_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_student_levels_level
    FOREIGN KEY (level_id) REFERENCES levels(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT uq_student_level UNIQUE (student_id, level_id)
) ENGINE=InnoDB;


-- =========================================================
-- 5. INVOICES
-- 1 invoice bisa punya banyak item.
-- Jika status sudah lunas:
-- - tidak boleh dihapus
-- - tidak boleh diubah status lagi
-- Logic lock ini nanti di controller backend.
-- =========================================================

CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(50) NOT NULL UNIQUE,

  invoice_date DATE NOT NULL,
  status ENUM('pending', 'invoice belum dikirim', 'lunas') NOT NULL DEFAULT 'pending',

  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,

  paid_at DATETIME NULL,
  deleted_at DATETIME NULL,

  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_invoices_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;


-- =========================================================
-- 6. INVOICE_ITEMS
-- Isi invoice.
-- Minimal pembelian credit = 4.
-- Credit baru akan benar-benar masuk setelah invoice status menjadi lunas.
-- =========================================================

CREATE TABLE invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  student_id INT NOT NULL,
  level_id INT NOT NULL,

  credit_amount INT NOT NULL,
  price_per_credit DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_invoice_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_invoice_items_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_invoice_items_level
    FOREIGN KEY (level_id) REFERENCES levels(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT chk_invoice_items_min_credit CHECK (credit_amount >= 4)
) ENGINE=InnoDB;


-- =========================================================
-- 7. CREDIT_PURCHASES
-- Riwayat kredit yang benar-benar sudah aktif setelah invoice lunas.
-- Dibuat dari invoice_items saat status invoice berubah menjadi lunas.
-- remaining_credit di sini dipakai agar expired per batch tetap aman.
-- =========================================================

CREATE TABLE credit_purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  invoice_item_id INT NOT NULL,
  student_id INT NOT NULL,
  level_id INT NOT NULL,
  student_level_id INT NOT NULL,

  credit_amount INT NOT NULL,
  remaining_credit INT NOT NULL,

  paid_at DATETIME NOT NULL,
  expired_at DATE NOT NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_credit_purchases_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_credit_purchases_invoice_item
    FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_credit_purchases_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_credit_purchases_level
    FOREIGN KEY (level_id) REFERENCES levels(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_credit_purchases_student_level
    FOREIGN KEY (student_level_id) REFERENCES student_levels(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT uq_credit_purchase_invoice_item UNIQUE (invoice_item_id)
) ENGINE=InnoDB;


-- =========================================================
-- 8. ROUTINE_SCHEDULES
-- Jadwal rutin mingguan.
-- day_of_week:
-- 0 = Senin
-- 1 = Selasa
-- 2 = Rabu
-- 3 = Kamis
-- 4 = Jumat
-- 5 = Sabtu
-- 6 = Minggu, kalau nanti diperlukan
-- =========================================================

CREATE TABLE routine_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  mentor_id INT NOT NULL,
  level_id INT NOT NULL,

  day_of_week TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_routine_schedules_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_routine_schedules_mentor
    FOREIGN KEY (mentor_id) REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_routine_schedules_level
    FOREIGN KEY (level_id) REFERENCES levels(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT chk_routine_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT chk_routine_time CHECK (start_time < end_time)
) ENGINE=InnoDB;


-- =========================================================
-- 9. SCHEDULE_EXCEPTIONS
-- Untuk tukar 1 jadwal.
-- Tidak mengubah jadwal rutin.
-- Hanya berlaku pada 1 tanggal/pertemuan tertentu.
-- =========================================================

CREATE TABLE schedule_exceptions (
  id INT AUTO_INCREMENT PRIMARY KEY,

  routine_schedule_id INT NULL,
  student_id INT NOT NULL,
  mentor_id INT NOT NULL,
  level_id INT NOT NULL,

  original_date DATE NOT NULL,
  original_start_time TIME NOT NULL,
  original_end_time TIME NOT NULL,

  new_date DATE NOT NULL,
  new_start_time TIME NOT NULL,
  new_end_time TIME NOT NULL,

  reason TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_schedule_exceptions_routine
    FOREIGN KEY (routine_schedule_id) REFERENCES routine_schedules(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_schedule_exceptions_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_schedule_exceptions_mentor
    FOREIGN KEY (mentor_id) REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_schedule_exceptions_level
    FOREIGN KEY (level_id) REFERENCES levels(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT chk_exception_original_time CHECK (original_start_time < original_end_time),
  CONSTRAINT chk_exception_new_time CHECK (new_start_time < new_end_time)
) ENGINE=InnoDB;


-- =========================================================
-- 10. EMPTY_SCHEDULES
-- Jadwal kosong mentor.
-- Artinya mentor bersedia mengajar pada slot tersebut.
-- Dipakai admin sebagai referensi saat tukar jadwal.
-- =========================================================

CREATE TABLE empty_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mentor_id INT NOT NULL,

  available_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_empty_schedules_mentor
    FOREIGN KEY (mentor_id) REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT chk_empty_schedule_time CHECK (start_time < end_time),

  CONSTRAINT uq_empty_schedule UNIQUE (mentor_id, available_date, start_time, end_time)
) ENGINE=InnoDB;


-- =========================================================
-- 11. SUMMARIES
-- Dibuat mentor.
-- Status awal pending.
-- Admin approve/centang -> status terkirim.
-- Saat approve:
-- - remaining_credit pada student_levels berkurang 1
-- - credit_purchases batch paling lama juga berkurang 1
-- =========================================================

CREATE TABLE summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  mentor_id INT NOT NULL,
  level_id INT NOT NULL,

  class_date DATE NOT NULL,
  class_type VARCHAR(50),
  keterangan VARCHAR(150),
  summary_text TEXT NOT NULL,

  status ENUM('pending', 'terkirim') NOT NULL DEFAULT 'pending',

  approved_by INT NULL,
  approved_at DATETIME NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_summaries_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_summaries_mentor
    FOREIGN KEY (mentor_id) REFERENCES users(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_summaries_level
    FOREIGN KEY (level_id) REFERENCES levels(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_summaries_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;


-- =========================================================
-- 12. INDEX TAMBAHAN
-- Biar query lebih cepat.
-- =========================================================

CREATE INDEX idx_students_mentor_id ON students(mentor_id);
CREATE INDEX idx_student_levels_student_id ON student_levels(student_id);
CREATE INDEX idx_student_levels_level_id ON student_levels(level_id);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_student_id ON invoice_items(student_id);
CREATE INDEX idx_invoice_items_level_id ON invoice_items(level_id);

CREATE INDEX idx_credit_purchases_student_level ON credit_purchases(student_id, level_id);
CREATE INDEX idx_credit_purchases_expired_at ON credit_purchases(expired_at);

CREATE INDEX idx_routine_schedules_student ON routine_schedules(student_id);
CREATE INDEX idx_routine_schedules_mentor ON routine_schedules(mentor_id);
CREATE INDEX idx_routine_schedules_day ON routine_schedules(day_of_week);

CREATE INDEX idx_empty_schedules_mentor_date ON empty_schedules(mentor_id, available_date);

CREATE INDEX idx_summaries_student ON summaries(student_id);
CREATE INDEX idx_summaries_mentor ON summaries(mentor_id);
CREATE INDEX idx_summaries_level ON summaries(level_id);
CREATE INDEX idx_summaries_status ON summaries(status);