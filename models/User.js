const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');


// Base User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    required: true,
    enum: ['Admin', 'Doctor', 'PetParent'],
  },
  // Common fields for all roles
  name: String,  // Optional field, could be used by Admin and Doctor
  adminId: String,  // Specific to Admin
  doctorId: String,  // Specific to Doctor
  phone: String,  // Specific to PetParent
  city: String,  // Specific to PetParent
});

// doctor schmema for admin generating ID
const doctorSchema = new mongoose.Schema({
  doctorId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  }
});

const appointmentSchema = new mongoose.Schema({
  appointmentDate: {
    type: Date,
    required: true
  },
  appointmentTime: {
    type: String,
    required: true
  },
  appointmentId: {
    type: String,
    required: true,
    unique: true // Ensure that each appointmentId is unique
  },
  doctorId: {
    type: mongoose.Schema.Types.Mixed, // Using Mixed type to accept any value
    required: true
  },
  petParentDetails: {
    username: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    city: { type: String, required: true }
  },
  petDetails: {
    petType: { type: String, required: true },
    friendly: { type: Boolean, set: v => v === '' ? false : v, default: false },
    humanSafety: { type: Boolean, set: v => v === '' ? false : v, default: false },
    // other fields...
    petName: { type: String, required: true },
    age: { type: Number, required: true },
    weight: { type: Number, required: true },
    gender: { type: String, required: true },
    allergies: { type: String, default: '' },
    prescription: { type: String, default: '' }
  },
  status: { type: String, default: 'Pending' }
}, { timestamps: true });

appointmentSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate a 32-character hex string and take the first 6 characters
    this.appointmentId = crypto.randomBytes(16).toString('hex').substring(0, 6);
  }
  next();
});



// counter schema for our appointmentid
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});



// Pre-save hook for password hashing
userSchema.pre('save', async function (next) {
  next();
});

// Model creation
const User = mongoose.model('User', userSchema);
const Doctor = mongoose.model('Doctor', doctorSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const Counter = mongoose.model('Counter', counterSchema);

module.exports = { User,Doctor, Appointment, Counter };








// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');

// // Base fields for Users
// const userFields = {
//   username: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   phoneNumber: String,
//   city: String,
// };

// // Base Schema for Users
// const userSchema = new mongoose.Schema({
//   ...userFields,
//   role: {
//     type: String,
//     enum: ['Admin', 'Doctor', 'PetParent'],
//     required: true
//   },
//   // Add any additional fields that are common across all users here
// });

// // Hash the password before saving a user
// userSchema.pre('save', async function (next) {
//   if (this.isModified('password')) {
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//   }
//   next();
// });

// // Add instance methods as needed, for example for password validation
// userSchema.methods.validatePassword = async function (candidatePassword) {
//   return bcrypt.compare(candidatePassword, this.password);
// };

// // Base Schema for Pets
// const petFields = {
//   petType: { type: String, required: true },
//   humanSafe: Boolean,
//   petName: String,
//   breed: String,
//   age: Number,
//   weight: Number,
//   gender: String,
//   // Add any additional fields that are common across all pets here
// };

// const petSchema = new mongoose.Schema(petFields);

// // Discriminator for Cat
// const catSchema = new mongoose.Schema({
//   isFriendly: Boolean,
//   // Add any additional fields specific to cats here
// });

// // Discriminator for Dog
// const dogSchema = new mongoose.Schema({
//   isFriendly: Boolean,
//   // Add any additional fields specific to dogs here
// });

// // Create models
// const User = mongoose.model('User', userSchema);
// const Pet = mongoose.model('Pet', petSchema);
// const Cat = Pet.discriminator('Cat', catSchema);
// const Dog = Pet.discriminator('Dog', dogSchema);

// // Export models
// module.exports = {
//   User,
//   Pet,
//   Cat,
//   Dog
// };
