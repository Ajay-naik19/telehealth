const vaultService = require('./vault.service');
const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');

exports.upload = async (req, res) => {
    try {
        vaultService.validateFileUpload(req.file);

        const result = await vaultService.uploadFile(
            req.user.id, req.file, req.body.recordType || 'general'
        );

        return sendResponse(res, 200, 'File uploaded successfully!', { fileId: result.id });
    } catch (err) {
        console.error(err);
        return sendResponse(res, 400, err.message || 'File upload failed', null);
    }
};

exports.listFiles = catchAsync(async (req, res) => {
    const files = await vaultService.getUserFiles(req.user.id);
    return sendResponse(res, 200, 'Files fetched successfully', files);
});

exports.accessFile = async (req, res) => {
    try {
        const file = await vaultService.checkFileAccess(req.params.id, req.user.id, req.user.role);
        return sendResponse(res, 200, 'File metadata fetched successfully', {
            file: {
                id: file.id,
                fileName: file.file_name,
                fileType: file.file_type,
                fileSize: file.file_size,
                url: file.file_path
            }
        });
    } catch (err) {
        console.error(err);
        if (err.message.includes('not found')) return sendResponse(res, 404, 'File not found', null);
        if (err.message.includes('Access denied')) return sendResponse(res, 403, 'Access denied', null);
        return sendResponse(res, 500, 'Download failed', null);
    }
};

exports.downloadFile = catchAsync(async (req, res) => {
    const file = await vaultService.checkFileAccess(req.params.id, req.user.id, req.user.role);
    const fileData = await vaultService.downloadFile(file);

    res.setHeader('Content-Type', fileData.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.setHeader('Content-Length', fileData.fileSize);
    res.send(fileData.buffer);
});

exports.deleteFile = async (req, res) => {
    try {
        await vaultService.deleteFile(req.params.id, req.user.id);
        return sendResponse(res, 200, 'Record deleted successfully', null);
    } catch (err) {
        console.error('Delete file error:', err);
        if (err.message.includes('not found')) {
            return sendResponse(res, 404, 'Record not found', null);
        }
        return sendResponse(res, 500, err.message || 'Failed to delete record', null);
    }
};
