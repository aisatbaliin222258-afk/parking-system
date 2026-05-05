const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    idNumber: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    phoneNumber: Number,
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    }
    
   
});
   
module.exports = mongoose.model("User",userSchema);

