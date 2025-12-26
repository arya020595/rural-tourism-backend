const User = require('../models/userModel'); // Import the User model
const { Op } = require('sequelize'); // Sequelize operators for querying

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// Get user by ID
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// Create a new user
// exports.createUser = async (req, res) => {
//     console.log(req.body);
    
//     try {
//         const newUser = await User.create(req.body);
//         res.status(201).json(newUser);
//     } catch (err) {
//         console.error('Error creating activity:', err);
//         res.status(500).json({ error: 'Database query error.' });
//     }
// };

const bcrypt = require('bcrypt'); // Import bcrypt

// Create a new user
exports.createUser = async (req, res) => {
    // console.log(req.body);
    const { username } = req.body;
    const { user_email } = req.body;
    // console.log(req.body)
    try {
        // Get the plain-text password from the request body
        const { password } = req.body;

        // Check if the username already exists in the database
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            // If the username is taken, send an error response
            return res.status(400).json({ error: 'Username is already taken!' });
        }

        // check email taken or not
        const existingEmail = await User.findOne({ where: { user_email } });
        if (existingEmail) {
            // If the username is taken, send an error response
            return res.status(400).json({ error: 'Email is already taken!' });
        }

        // Generate a salt and hash the password
        const saltRounds = 10; // Define the number of salt rounds (higher is more secure but slower)
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Replace the plain password in the request body with the hashed password
        req.body.password = hashedPassword;

        // Now, create the new user with the hashed password
        const newUser = await User.create(req.body);

        // Send the new user data (without the raw password) in the response
        res.status(201).json(newUser);
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ error: 'Database query error.' });
    }
};

// Update an existing user
exports.updateUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        await user.update(req.body);
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// Delete a user
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        await user.destroy();
        res.status(204).send(); // No content
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// Search users by name (optional)
exports.searchUsers = async (req, res) => {
    const { name } = req.query; // Get the search term from query parameters
    try {
        const users = await User.findAll({
            where: {
                name: {
                    [Op.like]: `%${name}%` // Using Sequelize to search for names
                }
            }
        });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Database query error.' });
    }
};

// Controller function to reset password
exports.resetPassword = async (req, res) => {
    const { username, question, securityAnswer, newPassword } = req.body;  // Expecting username and new password in request body
    // console.log(req.body);
    // Validate input
    if (!username || !newPassword) {
      return res.status(400).send({ error: 'Username and new password are required.' });
    }
  
    try {

      let columnName = '';
      if (question === 'q1') {
        columnName = 'securityQ1';
        } else if (question === 'q2') {
        columnName = 'securityQ2';
        } else {
        return res.status(400).send({ error: 'Invalid security question' });
        }

        // console.log(securityAnswer);
      // Step 1: Find the user by username
      const user = await User.findOne({ where: { username } });
      const answer = await User.findOne({
        where: {
          [columnName]: securityAnswer,  // Dynamically checks the correct column based on securityQuestion
          username: user.username,  
        },
      });
    //   const q1 = await User.findOne({ where: { securityQ1: securityQ1 } });
    //   const q2 = await User.findOne({ where: { securityQ2: securityQ1 } });
  
    // Build the dynamic column name based on the question selected by the user
        
        
  
      // If user not found, return error
      if (!user || !answer) {
        return res.status(404).send({ error: 'User not found/invalid security answer' });
      }

    

  
      // Step 2: Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      // Step 3: Update the password with the new hashed password
      user.password = hashedPassword;
  
      // Step 4: Save the updated user record
      await user.save();
  
      // Step 5: Return success response
      res.send({ success: true, message: 'Password has been successfully updated.' });
    } catch (error) {
      console.error(error);
      res.status(500).send({ error: 'Something went wrong. Please try again later.' });
    }
  };
  
