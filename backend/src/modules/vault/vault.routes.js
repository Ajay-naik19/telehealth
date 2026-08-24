const express = require('express');
const router = express.Router();
const vaultController = require('./vault.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { upload } = require('../../config/upload');
const { uploadSchema, fileIdParam } = require('./vault.schema');
const { validate } = require('../../middleware/validation');

router.post('/vault/upload', authenticate, authorize('user'), upload.single('file'), validate(uploadSchema), vaultController.upload);
router.get('/api/vault/user', authenticate, authorize('user'), vaultController.listFiles);
router.get('/vault/file/:id', authenticate, validate(fileIdParam, 'params'), vaultController.accessFile);
router.get('/api/vault/download/:id', authenticate, validate(fileIdParam, 'params'), vaultController.downloadFile);
router.delete('/api/vault/:id', authenticate, authorize('user'), validate(fileIdParam, 'params'), vaultController.deleteFile);

module.exports = router;
