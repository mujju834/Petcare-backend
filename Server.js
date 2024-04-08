// server.js: This is the main file where the Express server is set up and MongoDB is connected.

const express = require('express');
const mongoose = require('mongoose');
const userRoutes = require('./routes/users');
require('dotenv').config();


const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;
console.log('Mongo URI:', process.env.MONGO_URIS);

const MONGO_URI = process.env.MONGO_URIS;



app.use(cors());
app.use(express.json());
app.use('/users', userRoutes);

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB hello');
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch((error) => {
    console.error('Error Connecting to MongoDB:', error);
});