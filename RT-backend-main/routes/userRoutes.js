const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');


// Middleware for error handling
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Route to get all users
router.get('/', async (req, res) => {
    try {
        const users = await User.findAll();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error); // Log the full error
        res.status(500).json({ error: error.message }); // Send back the error message
    }
});

// Route to get a user by ID
router.get('/:id', asyncHandler(userController.getUserById));

// Route to create a new user
router.post('/', asyncHandler(userController.createUser));

// Route to update an existing user
router.put('/:id', asyncHandler(userController.updateUser));

// Route to delete a user
router.delete('/:id', asyncHandler(userController.deleteUser));

// Route to search users by name (optional)
router.get('/search', asyncHandler(userController.searchUsers));


// Login route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(req.body);
    
    try {
        // Find the user by username
        const user = await User.findOne({ where: { username } });

        if (!user) {
            console.log('error user wrong');
            
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const enteredPassword = password.trim();
        // Compare the entered password with the hashed password in the database
        const isValidPassword = await bcrypt.compare(enteredPassword, user.password);
        console.log('Password valid:', isValidPassword);
        // console.log(enteredPassword);
        

        // If the password is not valid, send an error
        if (!isValidPassword) {
            console.log('pass wrong');
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Generate a JWT token (optional)
        const token = jwt.sign({ id: user.user_id }, 'your_jwt_secret', { expiresIn: '1h' });

        // Send the response with the token and user ID
        res.json({
            message: 'Login successful',
            token,       // Optionally send the token back (usually sent in headers or response body)
            id: user.user_id
        });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to handle password reset
router.post('/reset-pass', asyncHandler(userController.resetPassword));



module.exports = router;
