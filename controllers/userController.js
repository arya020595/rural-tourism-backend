
const { Op } = require('sequelize'); // For search queries
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { User, Association } = require('../models');

const DEFAULT_LOGO = '/uploads/default-logo.png';

function getLogoUrl(logoFileName) {
    if (!logoFileName) return DEFAULT_LOGO;

    const filePath = path.join(__dirname, '../uploads/logos', logoFileName);
    if (fs.existsSync(filePath)) {
        return `/uploads/logos/${logoFileName}`;
    }
    return DEFAULT_LOGO;
}

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll();
        const usersWithLogo = users.map(user => ({
            ...user.toJSON(),
            company_logo: getLogoUrl(user.company_logo)
        }));
        res.json(usersWithLogo);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database query error.' });
    }
};

// Get user by ID
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: ['user_id', 'company_logo', 'user_email', 'username', 'full_name'],
            include: [
                {
                    model: Association,
                    as: "association",
                    required: false,
                }
            ]
        });
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const userWithLogo = {
            ...user.toJSON(),
            // company_logo: getLogoUrl(user.company_logo)
        };

        res.json(userWithLogo);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database query error.' });
    }
};

// Create a new user
exports.createUser = async (req, res) => {
    const { username, user_email, full_name, password, securityQ1, securityQ2, business_name, associationId } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Convert file to Base64 if uploaded
        let logoBase64 = null;
        if (req.file) {
            const filePath = req.file.path; // multer saved file
            const fileData = fs.readFileSync(filePath);
            logoBase64 = `data:${req.file.mimetype};base64,${fileData.toString('base64')}`;
        }

        const newUser = await User.create({
            username,
            user_email,
            full_name,
            password: hashedPassword,
            securityQ1: securityQ1 || null,
            securityQ2: securityQ2 || null,
            business_name: business_name || null,
            company_logo: logoBase64, // store Base64 here
            associationId,
        });

        res.status(201).json(newUser);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database query error.' });
    }
};

// exports.createUser = async (req, res) => {
//     const { username, user_email, full_name, password, securityQ1, securityQ2, business_name } = req.body;

//     try {
//         // Check if username/email already exists
//         if (await User.findOne({ where: { username } })) {
//             return res.status(400).json({ error: 'Username is already taken!' });
//         }
//         if (await User.findOne({ where: { user_email } })) {
//             return res.status(400).json({ error: 'Email is already taken!' });
//         }

//         // Hash the password
//         const hashedPassword = await bcrypt.hash(password, 10);

//         // Set logo filename or default
//         const logoPath = req.file ? req.file.filename : '';

//         // Create user
//         const newUser = await User.create({
//             username,
//             user_email,
//             full_name,
//             password: hashedPassword,
//             securityQ1: securityQ1 || null,
//             securityQ2: securityQ2 || null,
//             business_name: business_name || null,
//             company_logo: logoPath
//         });

//         // Return user with logo URL
//         const userWithLogo = {
//             ...newUser.toJSON(),
//             company_logo: getLogoUrl(newUser.company_logo)
//         };

//         res.status(201).json(userWithLogo);

//     } catch (err) {
//         console.error('Error creating user:', err);
//         res.status(500).json({ error: 'Database query error.' });
//     }
// };

// Update user
exports.updateUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        if (req.body.password) {
            req.body.password = await bcrypt.hash(req.body.password, 10);
        }

        // Convert uploaded file to Base64
        if (req.file) {
            req.body.company_logo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        await user.update(req.body);

        res.json(user);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database query error.' });
    }
};


// exports.updateUser = async (req, res) => {
//     try {
//         const user = await User.findByPk(req.params.id);
//         if (!user) return res.status(404).json({ message: 'User not found.' });

//         // Optionally update password if provided
//         if (req.body.password) {
//             req.body.password = await bcrypt.hash(req.body.password, 10);
//         }

//         await user.update(req.body);

//         const updatedUser = {
//             ...user.toJSON(),
//             company_logo: getLogoUrl(user.company_logo)
//         };

//         res.json(updatedUser);
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: 'Database query error.' });
//     }
// };

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        await user.destroy();
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database query error.' });
    }
};

// Search users by name
exports.searchUsers = async (req, res) => {
    const { name } = req.query;
    try {
        const users = await User.findAll({
            where: {
                full_name: { [Op.like]: `%${name}%` }
            }
        });
        const usersWithLogo = users.map(user => ({
            ...user.toJSON(),
            company_logo: getLogoUrl(user.company_logo)
        }));
        res.json(usersWithLogo);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database query error.' });
    }
};

// Reset password
exports.resetPassword = async (req, res) => {
    const { username, question, securityAnswer, newPassword } = req.body;

    if (!username || !newPassword) {
        return res.status(400).json({ error: 'Username and new password are required.' });
    }

    try {
        const user = await User.findOne({ where: { username } });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        let columnName = '';
        if (question === 'q1') columnName = 'securityQ1';
        else if (question === 'q2') columnName = 'securityQ2';
        else return res.status(400).json({ error: 'Invalid security question.' });

        if (user[columnName] !== securityAnswer) {
            return res.status(400).json({ error: 'Invalid security answer.' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ success: true, message: 'Password updated successfully.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database query error.' });
    }
};
