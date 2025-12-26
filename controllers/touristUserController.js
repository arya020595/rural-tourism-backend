const bcrypt = require('bcrypt');
const TouristUser = require('../models/touristModel');

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Missing username or password' });
  }
  try {
    const user = await TouristUser.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    
    // Compare hashed password using bcrypt.compare
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // Prepare user data to send (exclude sensitive info)
    const userData = {
      tourist_user_id: user.tourist_user_id,
      username: user.username,
      full_name: user.full_name,
      user_email: user.user_email,
      nationality: user.nationality || '',
      contact_no: user.contact_no,
      profileImage: user.profileImage || null, // if you have this field or similar
      role: user.role,
      // add any other user fields you want the frontend to have access to
    };

    res.json({ success: true, message: 'Login successful', user: userData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};



// exports.login = async (req, res) => {
//   const { username, password } = req.body;
//   if (!username || !password) {
//     return res.status(400).json({ success: false, message: 'Missing username or password' });
//   }
//   try {
//     const user = await TouristUser.findOne({ where: { username } });
//     if (!user) {
//       return res.status(401).json({ success: false, message: 'Invalid username or password' });
//     }
    
//     // Compare hashed password using bcrypt.compare
//     const isValidPassword = await bcrypt.compare(password, user.password);
//     if (!isValidPassword) {
//       return res.status(401).json({ success: false, message: 'Invalid username or password' });
//     }

//     // Optional: Generate a JWT token here if needed

//     res.json({ success: true, message: 'Login successful', userId: user.tourist_user_id });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// };



// exports.login = async (req, res) => {
//   const { username, password } = req.body;
//   if (!username || !password) {
//     return res.status(400).json({ success: false, message: 'Missing username or password' });
//   }
//   try {
//     const user = await TouristUser.findOne({ where: { username } });
//     if (!user || user.password !== password) {
//       return res.status(401).json({ success: false, message: 'Invalid username or password' });
//     }
//     res.json({ success: true, message: 'Login successful' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// };


exports.registerTourist = async (req, res) => {
  try {
    const { username, user_email, password, full_name, contact_no, nationality } = req.body;

    if (!username || !user_email || !password || !full_name || !contact_no || !nationality) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Check for duplicates
    const existingUser = await TouristUser.findOne({ where: { username } });
    if (existingUser) return res.status(400).json({ error: 'Username already taken.' });

    const existingEmail = await TouristUser.findOne({ where: { user_email } });
    if (existingEmail) return res.status(400).json({ error: 'Email already registered.' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new tourist
    const newUser = await TouristUser.create({
      username,
      user_email,
      password: hashedPassword,
      full_name,
      contact_no,
      nationality,
      role: 'tourist',
    });

    return res.status(201).json({
      message: 'Tourist account successfully created!',
      user: newUser,
    });
  } catch (error) {
    console.error('Error registering tourist:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
};
