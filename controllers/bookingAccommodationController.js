const AccommodationBooking = require('../models/bookingAccommodationModel');

// Create a new accommodation booking
exports.createAccommodationBooking = async (req, res) => {
    try {
        const {
            tourist_user_id,
            accommodation_id,
            operator_id,
            accommodation_name,
            operator_name,
            location,
            start_date,
            end_date,
            number_of_nights,
            no_of_rooms,
            total_price,
            no_of_pax
        } = req.body;

        // Basic validation
        if (!tourist_user_id || !accommodation_id || !total_price) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const newBooking = await AccommodationBooking.create({
            tourist_user_id,
            accommodation_id,
            operator_id,
            accommodation_name,
            operator_name,
            location,
            start_date,
            end_date,
            number_of_nights,
            no_of_rooms,
            total_price,
            no_of_pax
            // status defaults to 'pending' from model
        });

        return res.status(201).json({
            success: true,
            message: 'Accommodation booking successfully created',
            data: newBooking
        });
    } catch (error) {
        console.error('Error creating accommodation booking:', error);
        return res.status(500).json({ success: false, message: 'Server error while creating booking' });
    }
};

// Get an accommodation booking by ID
exports.getAccommodationBookingById = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await AccommodationBooking.findByPk(id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        return res.json({ success: true, data: booking });
    } catch (error) {
        console.error('Error fetching accommodation booking by ID:', error);
        return res.status(500).json({ success: false, message: 'Server error while fetching booking' });
    }
};

// Get all accommodation bookings for a specific tourist user
exports.getAccommodationBookingsByUser = async (req, res) => {
    try {
        const { tourist_user_id } = req.params;
        const bookings = await AccommodationBooking.findAll({ where: { tourist_user_id } });

        if (bookings.length === 0) {
            return res.status(404).json({ success: false, message: 'No bookings found for this user' });
        }

        return res.json({ success: true, data: bookings });
    } catch (error) {
        console.error('Error fetching accommodation bookings for user:', error);
        return res.status(500).json({ success: false, message: 'Server error while fetching bookings' });
    }
};
