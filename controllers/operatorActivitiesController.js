const OperatorActivity = require('../models/operatorActivitiesModel');  // updated import
const RtUser = require('../models/userModel');

// 1️⃣ Get all operator activities
exports.getAllOperatorActivities = async (req, res) => {
    try {
        const activities = await OperatorActivity.findAll();
        res.json(activities);
    } catch (err) {
        console.error('Error fetching operator activities:', err);
        res.status(500).json({ error: err.message });
    }
};

// 2️⃣ Get operator activity by ID

// ✅ Get operators by activity_id and include business_name from rt_user
exports.getOperatorsByActivityId = async (req, res) => {
  const { activity_id } = req.params;

  try {
    const operators = await OperatorActivity.findAll({
      where: { activity_id },
      include: [
        {
          model: RtUser,
          as: 'rt_user',
          attributes: ['user_id', 'business_name']
        }
      ]
    });

    if (!operators || operators.length === 0) {
      return res.status(404).json({ error: 'No operators found for this activity.' });
    }

    const result = operators.map(op => {
      let servicesList = [];
      try {
        servicesList = JSON.parse(op.services_provided || '[]');
      } catch (err) {
        servicesList = [];
      }

      return {
        ...op.dataValues,
         rt_user_id: op.rt_user ? op.rt_user.user_id : null,
        business_name: op.rt_user ? op.rt_user.business_name : 'Not Provided',
        services_provided_list: servicesList
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching operators with business names:', err);
    res.status(500).json({ error: err.message });
  }
};

// exports.getOperatorsByActivityId = async (req, res) => {
//   const { activity_id } = req.params;

//   try {
//     const operators = await OperatorActivity.findAll({
//       where: { activity_id },
//       include: [
//         {
//           model: RtUser,
//           as: 'rt_user',
//           attributes: ['business_name']
//         }
//       ]
//     });

//     if (!operators || operators.length === 0) {
//       return res.status(404).json({ error: 'No operators found for this activity.' });
//     }

//     const result = operators.map(op => ({
//       ...op.dataValues,
//       business_name: op.rt_user ? op.rt_user.business_name : 'Not Provided'
//     }));

//     res.json(result);
//   } catch (err) {
//     console.error('Error fetching operators with business names:', err);
//     res.status(500).json({ error: err.message });
//   }
// };


// ✅ Get single operator activity by operator ID
exports.getOperatorActivityById = async (req, res) => {
  const { id } = req.params;

  try {
    const operator = await OperatorActivity.findOne({
      where: { id },
      include: [
        {
          model: RtUser,
          as: 'rt_user',
          attributes: ['business_name']
        }
      ]
    });

    if (!operator) {
      return res.status(404).json({ error: 'Operator activity not found.' });
    }

    let servicesList = [];
    try {
      servicesList = JSON.parse(operator.services_provided || '[]');
    } catch (err) {
      servicesList = [];
    }

    res.json({
      ...operator.dataValues,
      business_name: operator.rt_user ? operator.rt_user.business_name : 'Not Provided',
      services_provided_list: servicesList
    });
  } catch (err) {
    console.error('Error fetching operator activity by ID:', err);
    res.status(500).json({ error: err.message });
  }
};

// exports.getOperatorActivityById = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const operator = await OperatorActivity.findOne({
//       where: { id },
//       include: [
//         {
//           model: RtUser,
//           as: 'rt_user',
//           attributes: ['business_name']
//         }
//       ]
//     });

//     if (!operator) {
//       return res.status(404).json({ error: 'Operator activity not found.' });
//     }

//     res.json({
//       ...operator.dataValues,
//       business_name: operator.rt_user ? operator.rt_user.business_name : 'Not Provided'
//     });
//   } catch (err) {
//     console.error('Error fetching operator activity by ID:', err);
//     res.status(500).json({ error: err.message });
//   }
// };



// exports.getOperatorsByActivityId = async (req, res) => {
//     const { activity_id } = req.params;

//     try {
//         // 1️⃣ Fetch operator activities
//         const operators = await OperatorActivity.findAll({ where: { activity_id } });

//         if (!operators.length) {
//             return res.status(404).json({ error: 'No operators found for this activity.' });
//         }

//         // 2️⃣ Get all user IDs from operators
//         const userIds = operators.map(op => op.rt_user_id);

//         // 3️⃣ Fetch users
//         const users = await RtUser.findAll({
//             where: { user_id: userIds },
//             attributes: ['user_id', 'business_name']
//         });

//         // 4️⃣ Merge business_name into operators
//         const result = operators.map(op => {
//             const user = users.find(u => u.user_id === op.rt_user_id);
//             return { ...op.dataValues, business_name: user?.business_name || 'Not Provided' };
//         });

//         res.json(result);

//     } catch (err) {
//         console.error('Error fetching operators:', err);
//         res.status(500).json({ error: err.message });
//     }
// };

// exports.getOperatorActivityById = async (req, res) => {
//     const { id } = req.params;
//     try {
//         const activity = await OperatorActivity.findOne({ where: { id } });

//         if (!activity) {
//             return res.status(404).json({ error: 'Operator activity not found.' });
//         }

//         res.json(activity);
//     } catch (err) {
//         console.error('Error fetching operator activity by ID:', err);
//         res.status(500).json({ error: err.message });
//     }
// };

// 3️⃣ Create a new operator activity
exports.createOperatorActivity = async (req, res) => {
    try {
        const newActivity = await OperatorActivity.create(req.body);
        res.status(201).json(newActivity);
    } catch (err) {
        console.error('Error creating operator activity:', err);
        res.status(500).json({ error: err.message });
    }
};

// 4️⃣ Update an existing operator activity
exports.updateOperatorActivity = async (req, res) => {
    const { id } = req.params;

    try {
        const activity = await OperatorActivity.findOne({ where: { id } });

        if (!activity) {
            return res.status(404).json({ error: 'Operator activity not found.' });
        }

        // Update only provided fields
        const updatableFields = [
            'description', 'address', 'district', 'image', 'operator_logo',
            'services_provided', 'price_per_pax', 'activity_id', 'rt_user_id'
        ];

        updatableFields.forEach(field => {
            if (req.body[field] !== undefined) activity[field] = req.body[field];
        });

        await activity.save();
        res.json(activity);
    } catch (err) {
        console.error('Error updating operator activity:', err);
        res.status(500).json({ error: err.message });
    }
};

// 5️⃣ Delete an operator activity
exports.deleteOperatorActivity = async (req, res) => {
    const { id } = req.params;

    try {
        const activity = await OperatorActivity.findOne({ where: { id } });

        if (!activity) {
            return res.status(404).json({ error: 'Operator activity not found.' });
        }

        await activity.destroy();
        res.json({ message: 'Operator activity deleted successfully.' });
    } catch (err) {
        console.error('Error deleting operator activity:', err);
        res.status(500).json({ error: err.message });
    }
};

// 6️⃣ Get all operator activities by user
exports.getAllOperatorActivitiesByUser = async (req, res) => {
    const { rt_user_id } = req.params;

    try {
        const activities = await OperatorActivity.findAll({ where: { rt_user_id } });

        if (!activities || activities.length === 0) {
            return res.status(404).json({ error: 'No activities found for this user.' });
        }

        res.json(activities);
    } catch (err) {
        console.error('Error fetching activities by user:', err);
        res.status(500).json({ error: err.message });
    }
};

// 7️⃣ Get all operator activities by activity ID
// exports.getOperatorsByActivityId = async (req, res) => {
//     const { activity_id } = req.params;  // or req.query if you want query param

//     try {
//         const activities = await OperatorActivity.findAll({ where: { activity_id } });

//         if (!activities || activities.length === 0) {
//             return res.status(404).json({ error: 'No operators found for this activity.' });
//         }

//         res.json(activities);
//     } catch (err) {
//         console.error('Error fetching operators by activity ID:', err);
//         res.status(500).json({ error: err.message });
//     }
// };