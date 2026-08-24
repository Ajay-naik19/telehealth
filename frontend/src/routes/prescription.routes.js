const express = require('express');
const router = express.Router();
const prescriptionService = require('../services/prescription.service');
const { authenticate } = require('../middleware/auth');

router.get("/api/prescription/download/:roomId", authenticate, async (req, res) => {
    try {
        const prescriptionData = await prescriptionService.getPrescriptionData(
            req.params.roomId,
            req.user.id,
            req.user.role
        );

        const pdfBuffer = await prescriptionService.generatePDF(prescriptionData);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="Prescription_${req.params.roomId}_${Date.now()}.pdf"`
        );
        res.send(pdfBuffer);

    } catch (err) {
        console.error(err);

        if (err.message.includes('not found')) {
            return res.status(404).json({
                message: err.message,
                error: err.message,
                roomId: req.params.roomId
            });
        }

        res.status(500).json({
            message: err.message || 'Error generating prescription',
            error: err.message || 'Error generating prescription'
        });
    }
});

module.exports = router;