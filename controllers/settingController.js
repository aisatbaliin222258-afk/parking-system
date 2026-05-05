const User = require("../models/User");
const bcrypt = require("bcryptjs");

// GET USER INFO
exports.getUser = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// UPDATE SETTINGS
exports.updateAccount = async (req, res) => {
    try {
        const { userId } = req.params;
        const { firstName, lastName, phoneNumber, idNumber, email } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // If email provided, check uniqueness
        if (email !== undefined && email !== user.email) {
            const exists = await User.findOne({ email });
            if (exists) return res.status(400).json({ message: 'Email already in use' });
            user.email = email;
        }

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
        if (idNumber !== undefined) user.idNumber = idNumber;

        await user.save();

        // Do not return password
        const safeUser = user.toObject();
        delete safeUser.password;

        res.status(200).json({
            message: "Account updated successfully",
            user: safeUser
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

//UPDATE PASSWORD
exports.changePassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const { currentPassword, newPassword } = req.body;

        if (!newPassword) return res.status(400).json({ message: 'New password required' });

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword || '', user.password || '');
        if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });

        const hashed = await bcrypt.hash(newPassword, 10);
        user.password = hashed;

        await user.save();

        res.status(200).json({
            message: "Password updated successfully"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
// DELETE ACCOUNT
exports.deleteAccount = async (req, res) => {
    try {
        const { userId } = req.params;

        const deleted = await User.findByIdAndDelete(userId);

        if (!deleted) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "Account deleted successfully"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};
