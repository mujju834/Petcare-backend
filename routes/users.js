const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const axios = require('axios');

const { User,Doctor,Appointment, Counter } = require('../models/User'); // Import only the User model
// Set your SECRET_ADMIN_CODE
const SECRET_ADMIN_CODE = 'ADMIN123';

// function to get the Id
async function getNextAppointmentId() {
  const counter = await Counter.findByIdAndUpdate(
    { _id: 'appointmentId' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

router.get('/test', (req, res) => {
  res.send('testing url');
});


router.post('/register', async (req, res) => {
    console.log("Received data from frontend:", req.body);

    try {
        // Extract data from request body
        const { role, username, email, password, name, adminId, phone, city, doctorId } = req.body;

        // Basic validation
        if (!role || !username || !email || !password) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Admin role verification with a secret code
        if (role === 'Admin' && adminId !== SECRET_ADMIN_CODE) {
            return res.status(401).json({ message: 'Invalid Admin Code' });
        }

        // Check for existing email in User collection
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Additional verification for Doctor role
        if (role === 'Doctor') {
            // Check for doctorId in the Doctor collection
            const doctorIdRecord = await Doctor.findOne({ doctorId });
            if (!doctorIdRecord) {
                return res.status(400).json({ message: 'Doctor ID is not registered by Admin' });
            }
        
            // Check for email in the Doctor collection
            const doctorEmailRecord = await Doctor.findOne({ email });
            if (!doctorEmailRecord) {
                return res.status(400).json({ message: 'Email is not registered by Admin for this Doctor-id' });
            }
        
            // Ensure both doctorId and email belong to the same doctor record
            if (doctorIdRecord.email !== email) {
                return res.status(400).json({ message: 'Doctor ID and Email do not match any registered Doctor' });
            }
        }
        

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user with role-specific fields included in the user data
        const userData = {
            username,
            email,
            password: hashedPassword,
            role,
            ...(role === 'Admin' && { name, adminId }),
            ...(role === 'Doctor' && { name, doctorId }),
            ...(role === 'PetParent' && { phone, city }),
        };

        const newUser = new User(userData);

        // Save the new user
        await newUser.save();

        // Respond with success
        res.status(201).json({ message: 'User registered successfully', userId: newUser._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});






router.post('/login', async (req, res) => {
    const { email, password, loginAs } = req.body;
    console.log(email, password, loginAs);

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: "Email not found." });
        }
        

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Incorrect password.' });
        }

        // Normalize role values before comparison
        const normalizedUserRole = user.role.toLowerCase().replace(/\s+/g, '');
        const normalizedLoginAs = loginAs.toLowerCase().replace(/\s+/g, '');

        if (normalizedUserRole === 'admin' || normalizedUserRole === normalizedLoginAs) {
            let welcomeMessage = `Login successful as ${loginAs}. Welcome, ${user.username}!`;
        
            // Customize the message for admin users to reflect their broader access
            if (normalizedUserRole === 'admin') {
                welcomeMessage = `Admin login successful. Welcome, ${user.username}! You have access to all roles.`;
            }
        
            res.status(200).json({ message: welcomeMessage, user });
        } else {
            // Non-admin users attempting to log in through the incorrect role are handled here
            return res.status(401).json({ message: `You are registered as a ${user.role}. Please log in through the correct page.` });
        }
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});



// doctor id generation
router.post('/generate-doctor-id', async (req, res) => {
    const { doctorId, email } = req.body;
  
    try {
      // Check if a doctor with the same ID or email already exists
      const existingDoctorById = await Doctor.findOne({ doctorId: doctorId });
      if (existingDoctorById) {
        return res.status(400).send('Doctor ID already exists.');
      }

      const existingDoctorByEmail = await Doctor.findOne({ email: email });
if (existingDoctorByEmail) {
  return res.status(400).send('Email already in use ');
}

      
  
      // Create a new doctor document and save it to the database
      const newDoctor = new Doctor({ doctorId, email });
      await newDoctor.save();
  
      res.status(201).json({ message: 'Doctor Id generated successfully.', doctor: newDoctor });
    } catch (error) {
      console.error('Error saving doctor information:', error);
      res.status(500).json({ message: 'Error saving doctor information.' });
    }
  });


//   fetch all the available doctors
router.get('/available-doctors', async (req, res) => {
    try {
        const doctors = await User.find({ role: 'Doctor' }); // Assuming 'Doctor' is the role for doctors in your User model
        res.json(doctors);
    } catch (error) {
        console.error('Failed to fetch doctors:', error);
        res.status(500).json({ message: 'Failed to fetch available doctors' });
    }
});


// creating appointment

router.post('/appointments', async (req, res) => {
  try {
    const { doctorId, petType, humanSafety, friendly, petName, age, weight, gender, allergies, userEmail ,  appointmentDate, appointmentTime, } = req.body;

    // Fetch user details based on the provided email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get the next appointment ID
    const appointmentId = await getNextAppointmentId();

    const newAppointment = new Appointment({
      appointmentId, // Set the generated appointment ID here
      doctorId,
      petParentDetails: {
        username: user.username,
        email: user.email,
        phone: user.phone,
        city: user.city
      },
      petDetails: {
        petType,
        humanSafety,
        friendly,
        petName,
        age,
        weight,
        gender,
        allergies
      },
      appointmentDate, // New field
      appointmentTime, // New field
      status: 'Pending'
    });

    // Save the new appointment
    const savedAppointment = await newAppointment.save();

    res.status(201).json({
      message: 'Appointment successfully created. The doctor will confirm the appointment!',
      appointment: savedAppointment
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ message: 'Failed to create appointment' });
  }
});



  

// getting appointments
router.get('/get-appointments', async (req, res) => {
  try {
    // Fetch all appointments from the database
    const appointments = await Appointment.find();

    // If there are no appointments, return a 404 status with a message
    if (!appointments || appointments.length === 0) {
      return res.status(404).json({ message: 'No appointments found' });
    }

    // If appointments are found, return them
    res.status(200).json({ appointments });
  } catch (error) {
    console.error('Error retrieving appointments:', error);
    res.status(500).json({ message: 'Failed to retrieve appointments' });
  }
});


// updating pet info
router.get('/appointments-by-pet', async (req, res) => {
  const { petName } = req.query; // Get pet name from query parameters

  try {
    // Use a case-insensitive search to find appointments by pet name
    const appointments = await Appointment.find({
      "petDetails.petName": { $regex: petName, $options: 'i' }
    });

    if (!appointments.length) {
      return res.status(404).json({ message: 'No appointments found for the given pet name' });
    }

    res.json(appointments);
  } catch (error) {
    console.error('Error retrieving appointments by pet name:', error);
    res.status(500).json({ message: 'Failed to retrieve appointments' });
  }
});

// Update pet details in an appointment
router.put('/update-pet-info-by-name/:petName', async (req, res) => {
  const { petName } = req.params; // Get petName from URL
  const updatedPetDetails = req.body; // Get updated pet details from request body

  try {
    // Find appointments that have a pet with the given name
    const appointments = await Appointment.find({ "petDetails.petName": petName });

    if (!appointments || appointments.length === 0) {
      return res.status(404).json({ message: 'No appointments found with the given pet name' });
    }

    // Iterate over the found appointments and update the pet details
    appointments.forEach(async (appointment) => {
      appointment.petDetails = { ...appointment.petDetails, ...updatedPetDetails };
      await appointment.save();
    });

    res.json({
      message: 'Pet details updated successfully for all appointments with the given pet name',
      updatedCount: appointments.length
    });
  } catch (error) {
    console.error('Error updating pet info by pet name:', error);
    res.status(500).json({ message: 'Failed to update pet info' });
  }
});



// Confirm appointment endpoint
router.patch('/appointments/:appointmentId/confirm', async (req, res) => {
  try {
    // Assuming Appointment is your Mongoose model and appointmentId is a unique identifier for your appointments
    const updatedAppointment = await Appointment.findOneAndUpdate(
      { appointmentId: req.params.appointmentId }, 
      { status: 'Approved' },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.status(200).json({
      message: 'Appointment confirmed successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error confirming appointment:', error);
    res.status(500).json({ message: 'Failed to confirm appointment' });
  }
});

// Deny appointment endpoint
router.patch('/appointments/:appointmentId/deny', async (req, res) => {
  try {
    // Assuming Appointment is your Mongoose model and appointmentId is a unique identifier for your appointments
    const updatedAppointment = await Appointment.findOneAndUpdate(
      { appointmentId: req.params.appointmentId },
      { status: 'Denied' },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.status(200).json({
      message: 'Appointment denied successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error denying appointment:', error);
    res.status(500).json({ message: 'Failed to deny appointment' });
  }
});


// Endpoint to get appointment details by appointmentId
router.get('/appointments/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params; // Extract appointmentId from the URL parameters

  try {
    // Fetch the specific appointment from the database using the appointmentId
    const appointment = await Appointment.findOne({ appointmentId });

    // If the appointment is not found, return a 404 status with a message
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // If the appointment is found, return it
    res.status(200).json(appointment);
  } catch (error) {
    console.error('Error retrieving the appointment:', error);
    res.status(500).json({ message: 'Failed to retrieve the appointment' });
  }
});


// Endpoint to save prescription by appointmentId
router.post('/appointments/:appointmentId/prescription', async (req, res) => {
  const { appointmentId } = req.params;
  const { prescription } = req.body;

  try {
    // Check if the appointment exists before attempting to update
    const appointmentExists = await Appointment.exists({ appointmentId });
    if (!appointmentExists) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Update the appointment with the prescription
    const updatedAppointment = await Appointment.findOneAndUpdate(
      { appointmentId },
      { $set: { 'petDetails.prescription': prescription } },
      { new: true }
    );

    res.json({ message: 'Prescription saved successfully', updatedAppointment });
  } catch (error) {
    console.error('Error saving prescription:', error);
    res.status(500).json({ message: 'Server error while updating prescription' });
  }
});



// fetching pet history
router.get('/fetch-pethistory', async (req, res) => {
  const { doctorId } = req.query; // Retrieve doctorId from query parameters

  try {
    let query = {};
    if (doctorId) {
      query.doctorId = doctorId; // Add doctorId to the query if provided
    }

    // Fetch appointments based on the query, which might include doctorId
    const appointments = await Appointment.find(query);

    if (!appointments || appointments.length === 0) {
      return res.status(404).json({ message: 'No appointments found' });
    }

    // Filter appointments to include only those with a non-empty prescription
    const appointmentsWithPrescription = appointments.filter(appointment => 
      appointment.petDetails.prescription);

    res.status(200).json({ appointments: appointmentsWithPrescription });
  } catch (error) {
    console.error('Error retrieving appointments:', error);
    res.status(500).json({ message: 'Failed to retrieve appointments' });
  }
});


// pet details by petname
router.get('/pets/:petName', async (req, res) => {
  const { petName } = req.params;

  try {
    // Find all appointments with a pet matching the given name.
    // Adjust the query according to your schema design.
    const appointments = await Appointment.find({ "petDetails.petName": petName });

    if (appointments.length === 0) {
      return res.status(404).json({ message: 'No pets found with the given name' });
    }

    // Extracting pet details from appointments
    const petDetails = appointments.map(appointment => appointment.petDetails);

    res.status(200).json(petDetails);
  } catch (error) {
    console.error('Error fetching pets by name:', error);
    res.status(500).json({ message: 'Failed to fetch pets' });
  }
});


// update petname by name
router.put('/pets/:petName/update', async (req, res) => {
  const { petName } = req.params;
  const updatedDetails = req.body;

  try {
    // Construct an update object that only includes the fields provided in the request body
    const update = {};
    Object.keys(updatedDetails).forEach(key => {
      if (updatedDetails[key] !== undefined) { // Check if a field is actually being updated
        update[`petDetails.${key}`] = updatedDetails[key];
      }
    });

    const result = await Appointment.updateMany(
      { "petDetails.petName": petName },
      { $set: update } // Update only the provided fields
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'No pets found with the given name to update' });
    }

    res.status(200).json({ message: 'Pet details updated successfully', updatedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error updating pet details:', error);
    res.status(500).json({ message: 'Failed to update pet details' });
  }
});



// getting all the users
router.get('/users', async (req, res) => {
  try {
    // Fetch all users except those with the role 'Admin'
    const users = await User.find({ role: { $ne: 'Admin' } });

    if (!users.length) {
      return res.status(404).json({ message: 'No users found' });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error('Error retrieving users:', error);
    res.status(500).json({ message: 'Failed to retrieve users' });
  }
});


// update user 
// Assuming 'router' is an instance of express.Router()
// and 'User' is your Mongoose user model

router.put('/users/:userId', async (req, res) => {
  const { userId } = req.params; // Get the dynamic _id from the URL
  const updatedData = req.body; // Get the updated user data from the request body

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully', updatedUser });
  } catch (error) {
    console.error('Failed to update user:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});


// delete user
// Assuming 'router' is an instance of express.Router()
// and 'User' is your Mongoose user model

router.delete('/users/:userId', async (req, res) => {
  const { userId } = req.params; // Get the dynamic _id from the URL

  try {
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});


// getting appointments details by email
router.get('/get-appointments-byemail', async (req, res) => {
  const userEmail = req.query.email; // Retrieve the email from query parameters

  try {
    let query = {};
    if (userEmail) {
      // Adjust this path if your schema structure for email within petParentDetails is different
      query['petParentDetails.email'] = userEmail;
    }

    const appointments = await Appointment.find(query); // Use the query object to filter appointments

    if (appointments.length === 0) {
      return res.status(404).json({ message: 'No appointments found for the provided email' });
    }

    res.status(200).json(appointments); // Return the filtered appointments
  } catch (error) {
    console.error('Error retrieving appointments:', error);
    res.status(500).json({ message: 'Failed to retrieve appointments' });
  }
});


// appointment by doctor
// Server-side: Route to get appointments by doctorId
router.get('/appointments/by-doctor', async (req, res) => {
  const doctorId = req.query.doctorId; // Get the doctorId from the query string

  if (!doctorId) {
    return res.status(400).json({ message: 'Doctor ID is required' });
  }

  try {
    const appointments = await Appointment.find({ doctorId: doctorId });

    if (appointments.length === 0) {
      return res.status(404).json({ message: 'No appointments found for this doctor' });
    }

    res.status(200).json(appointments);
  } catch (error) {
    console.error('Error retrieving appointments:', error);
    res.status(500).json({ message: 'Failed to retrieve appointments' });
  }
});



// getting appointments by doctorid
router.get('/appointments/by-doctor/:doctorId', async (req, res) => {
  const { doctorId } = req.params;  // Extracting doctorId from URL parameters

  try {
    const appointments = await Appointment.find({ doctorId: doctorId });  // Query the database for appointments with the specified doctorId

    if (appointments.length === 0) {
      return res.status(404).json({ message: 'No appointments found for this doctor.' });
    }

    res.status(200).json(appointments);  // Sending the found appointments as the response
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Failed to retrieve appointments' });
  }
});



module.exports = router;
