const db = require('../models/database');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { destroyUploadedImage, isManagedImage } = require('../config/storage');

exports.getProfile = async (req, res) => {
    try {
        const user = await db.select('tbl_users', 'id, username, email, first_name, last_name, role_id, profile_image', 'id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
        const offset = (page - 1) * limit;
        const [users, totalRows] = await Promise.all([
            db.queryAll(`
            SELECT
                u.id,
                u.username,
                u.email,
                u.first_name,
                u.last_name,
                u.role_id,
                u.status,
                u.profile_image,
                u.created_at,
                r.role_name
            FROM tbl_users u
            JOIN tbl_roles r ON r.id = u.role_id
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]),
            db.queryAll('SELECT COUNT(*) AS count FROM tbl_users'),
        ]);
        res.json({
            success: true,
            data: users,
            pagination: {
                currentPage: page,
                limit,
                totalRecords: totalRows[0]?.count || 0,
                totalPages: Math.ceil((totalRows[0]?.count || 0) / limit),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getRoles = async (req, res) => {
    try {
        const roles = await db.getRoles();
        res.json({ success: true, data: roles });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { username, email, password, first_name, last_name, role_id, profile_image } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: 'Username, email, and password are required' });
        }
        if (!validator.isEmail(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existing = await db.select('tbl_users', 'id', 'email = ? OR username = ?', [email, username]);
        if (existing) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.beginTransaction();
        const result = await db.insert('tbl_users', {
            username,
            email,
            password: hashedPassword,
            first_name,
            last_name,
            role_id,
            profile_image: profile_image || null,
            status: 'active'
        });
        await db.commit();

        res.status(201).json({ success: true, data: { id: result.insert_id } });
    } catch (error) {
        try { await db.rollback(); } catch (e) { }
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, first_name, last_name, role_id, status, password, profile_image } = req.body;

        if (email && !validator.isEmail(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }
        if (password && password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const updateData = {};
        if (username !== undefined) updateData.username = username;
        if (email !== undefined) updateData.email = email;
        if (first_name !== undefined) updateData.first_name = first_name;
        if (last_name !== undefined) updateData.last_name = last_name;
        if (role_id !== undefined) updateData.role_id = role_id;
        if (status !== undefined) updateData.status = status;
        if (profile_image !== undefined) updateData.profile_image = profile_image;
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const oldUser = await db.select('tbl_users', 'profile_image', 'id = ?', [id]);
        if (!oldUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let oldUploadedImage = null;
        await db.beginTransaction();
        // Delete the old uploaded image if it is being replaced
        if (profile_image) {
            if (oldUser && oldUser.profile_image &&
                oldUser.profile_image !== profile_image &&
                isManagedImage(oldUser.profile_image)) {
                oldUploadedImage = oldUser.profile_image;
            }
        }

        await db.update('tbl_users', updateData, 'id = ?', [id]);
        await db.commit();

        if (oldUploadedImage) {
            destroyUploadedImage(oldUploadedImage);
        }

        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        try { await db.rollback(); } catch (e) { }
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await db.select('tbl_users', 'profile_image', 'id = ?', [id]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const imageToDelete = isManagedImage(user.profile_image)
            ? user.profile_image
            : null;

        await db.beginTransaction();
        await db.delete('tbl_users', 'id = ?', [id]);
        await db.commit();

        if (imageToDelete) {
            destroyUploadedImage(imageToDelete);
        }

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        try { await db.rollback(); } catch (e) { }
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createRole = async (req, res) => {
    try {
        const { role_name, description } = req.body;
        if (!role_name) {
            return res.status(400).json({ success: false, message: 'Role name is required' });
        }

        const result = await db.insert('tbl_roles', { role_name, description });
        res.status(201).json({ success: true, data: { id: result.insert_id, role_name } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_name, description } = req.body;

        await db.update('tbl_roles', { role_name, description }, 'id = ?', [id]);
        res.json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if users are assigned to this role
        const assignedUsers = await db.selectAll('tbl_users', 'id', 'role_id = ?', [id]);
        if (assignedUsers.length > 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete role assigned to users' });
        }

        await db.delete('tbl_roles', 'id = ?', [id]);
        res.json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
