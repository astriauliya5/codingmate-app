const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend dari folder public
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/akun', require('./src/routes/akunRoutes'));
app.use('/api/students', require('./src/routes/studentRoutes'));
app.use('/api/levels', require('./src/routes/levelRoutes'));
app.use('/api/invoices', require('./src/routes/invoiceRoutes'));
app.use('/api/schedules', require('./src/routes/scheduleRoutes'));
app.use('/api/empty-schedules', require('./src/routes/emptyScheduleRoutes'));
app.use('/api/summaries', require('./src/routes/summaryRoutes'));

// Halaman awal
app.get('/', (req, res) => {
  res.redirect('/components/login.html');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}/components/login.html`);
});