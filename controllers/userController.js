const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

//REGISTER
exports.registerUser = async (req, res) => {
    try {
        const { firstName, lastName, idNumber, phoneNumber, email, password } = req.body;

        if (!firstName || !lastName || !idNumber || !phoneNumber || !email || !password) {
            return res.status(400).json({ message: "All fields required" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            firstName,
            lastName,
            idNumber,
            phoneNumber,
            email,
            password: hashedPassword
        });

        // issue token on registration
        const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        res.status(201).json({
                message: "User registered",
                token,
                user: {
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName
                }
            });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
//LOGIN
exports.loginUser = async(req, res) =>{
    try{
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ message: "User not found"});

        }

        const isMatch = await bcrypt.compare(password, user.password);

        if(!isMatch) {
            return res.json({message: "Invalid password"});
        }

        // create JWT
        const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        res.json({
            message: "Login successful",
            token,
            user: {
                _id: user._id,
                email: user.email
            }
    });
    }catch (error) {
        res.json({ error: error.message });
    }
};