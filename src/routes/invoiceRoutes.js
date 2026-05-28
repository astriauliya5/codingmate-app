const express = require('express');
const router = express.Router();

const {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoiceStatus,
  deleteInvoice
} = require('../controllers/invoiceController');

const { verifyToken, allowRoles } = require('../middleware/authMiddleware');

router.get('/', verifyToken, allowRoles('admin'), getInvoices);
router.get('/:id', verifyToken, allowRoles('admin'), getInvoiceById);
router.post('/', verifyToken, allowRoles('admin'), createInvoice);
router.patch('/:id/status', verifyToken, allowRoles('admin'), updateInvoiceStatus);
router.delete('/:id', verifyToken, allowRoles('admin'), deleteInvoice);

module.exports = router;