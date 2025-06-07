const { User } = require("../models/user");

exports.getUsers = async (_, res) => {
    try {
        // 모든 User 객체의 name email id isAdmin 필드 조회.
        const users = await User.find().select('name email id isAdmin');
        if (!users) {
            return res.status(404).json({ message: 'Users Not Found' });
        }

        return res.json(users);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        // passwordHash, resetPasswordOtp, resetPasswordOtpExpires 필드를 제외한 단일 User 객체 조회.
        const user = await User.findById(req.params.id).select('-passwordHash -resetPasswordOtp -resetPasswordOtpExpires');
        if (!user) {
            return res.status(404).json({ message: 'User Not Found' });
        }

        return res.json(user);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, phone },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ message: 'User Not Found' });
        }

        user.passwordHash = undefined;

        return res.json(user);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};