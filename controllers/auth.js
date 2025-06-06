const { validationResult } = require("express-validator");
const { User } = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const { Token } = require("../models/token");
const mailSender = require("../helpers/email_sender");

exports.register = async function (req, res) {
    // validate the user
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((error) => ({
            field: error.path,
            message: error.msg
        }));
        return res.status(400).json({ errors: errorMessages });
    }

    // tab into the database and create a new USER in the users collection in the database
    try {
        const hash = bcrypt.hashSync("bacon", 10);
        console.info(`hash : ${hash}`);
        let user = new User({
            ...req.body,
            passwordHash: bcrypt.hashSync(req.body.password, 8)
        });

        user = await user.save();

        if (!user) {
            return res.status(500).json({ type: 'Internal Server Error', message: 'Could not create a new user.' });
        }

        return res.status(201).json(user);
    } catch (e) {
        console.error(e);
        if (e.message.includes('email_1 dup key')) {
            return res.status(409).json({ type: 'AuthError', message: 'User with that email already exists.' });
        }

        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.login = async function (req, res) {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        // 사용자 존재 여부 검증.
        if (!user) {
            return res.status(404).json({ type: 'User Not Found', message: 'User not found\nCheck your email and try again.' });
        }

        // 패스워드 일치 여부 검증.
        if (!bcrypt.compareSync(password, user.passwordHash)) {
            return res.status(400).json({ type: 'Incorrect Password', message: 'Incorrect Password.' });
        }

        const accessToken = jwt.sign(
            { id: user.id, isAdmin: user.isAdmin },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '24h' }
        );

        const refreshToken = jwt.sign(
            { id: user.id, isAdmin: user.isAdmin },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '60d' }
        );

        const token = await Token.findOne({ userId: user.id });
        if (token) await token.deleteOne();
        await new Token({ userId: user.id, accessToken, refreshToken }).save();

        user.passwordHash = undefined;
        
        return res.json({ ...user._doc, accessToken });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.verifyToken = async function (req, res) {
    try {
        let accessToken = req.headers.authorization;
        if (!accessToken) return res.json(false);

        accessToken = accessToken.replace('Bearer', '').trim();

        const token = await Token.findOne({ accessToken });
        if (!token) return res.json(false);

        const tokenData = jwt.decode(token.refreshToken);

        const user = await User.findById(tokenData.id);
        if (!user) return res.json(false);

        const isValid = jwt.verify(token.refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (!isValid) return res.json(false);

        return res.json(true);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.forgotPassword = async function (req, res) {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User with that email dose not exist.' });
        }

        // 네 자리의 임의의 정수를 OTP로 사용.
        const otp = Math.floor(1000 + Math.random() * 9000);

        user.resetPasswordOtp = otp;
        user.resetPasswordOtpExpires = Date.now() + (10 * 60 * 1000);

        await user.save();

        const response = await mailSender.sendMail(
            email,
            'Password Reset OTP',
            `Your OTP for password reset is: ${otp}`
        );

        return res.json({ message: response });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.verifyPasswordResetOTP = async function (req, res) {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ type: 'User Not Found', message: 'User not found.' });
        }

        if (user.resetPasswordOtp !== +otp || Date.now() > user.resetPasswordOtpExpires) {
            return res.status(401).json({ message: 'Invalid or expired OTP.' });
        }

        user.resetPasswordOtp = 1;
        user.resetPasswordOtpExpires = undefined;

        await user.save();

        return res.json({ message: 'OTP confirmed successfully.' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.resetPassword = async function (req, res) {
    
};