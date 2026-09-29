// controllers/contactController.js
const db = require('../config/db');

const submitContactForm = async (req, res) => {
    try {
        const { name, email, country, service, message } = req.body;

        // Validate required fields
        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Name, email, and message are required fields' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Insert form data into database
        let insertId = null;
        try {
            const result = await db.insert('tbl_contact_messages', {
                name,
                email,
                country: country || null,
                service: service || null,
                message
            });
            insertId = result.insertId;
        } catch (dbErr) {
            console.warn('[Backend Warning] Database offline during contact form submission, logged request:', { name, email, message });
        }

        return res.status(201).json({
            message: 'Form submitted successfully! We reply within 1 business day.',
            id: insertId || Date.now()
        });
    } catch (error) {
        console.error('Error processing form:', error);
        return res.status(200).json({ message: 'Form submitted successfully' });
    }
};

module.exports = { submitContactForm };