const ActivityBooking = require('../models/bookingActivityModel');
const OperatorActivities = require('../models/operatorActivitiesModel');

// Create a new booking
exports.createBooking = async (req, res) => {
    try {
        const {
            tourist_user_id,
            activity_id,
            no_of_pax,
            date,
            contact_name,
            contact_phone,
            nationality,
            total_price,
        } = req.body;

        // Basic validation
        if (!tourist_user_id || !activity_id || !total_price) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // 1️⃣ Fetch operator_id from operator_activities
        const operatorActivity = await OperatorActivities.findOne({
            where: { activity_id }
        });

        if (!operatorActivity) {
            return res.status(404).json({ success: false, message: 'Operator not found for this activity' });
        }

        const operator_id = operatorActivity.rt_user_id; // <-- this is what you want

        // 2️⃣ Create booking including operator_id
        const newBooking = await ActivityBooking.create({
            tourist_user_id,
            activity_id,
            operator_id,          // <-- store operator here
            no_of_pax,
            date,
            contact_name,
            contact_phone,
            nationality,
            total_price
        });

        return res.status(201).json({
            success: true,
            message: 'Booking successfully created',
            data: newBooking
        });

    } catch (error) {
        console.error('Error creating booking:', error);
        return res.status(500).json({ success: false, message: 'Server error while creating booking' });
    }
};
