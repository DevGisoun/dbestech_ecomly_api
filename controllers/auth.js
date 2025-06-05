const { validationResult } = require("express-validator");
const { User } = require("../models/user");
const bcrypt = require("bcryptjs");

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
        return res.status(500).json({ type: e.name, message: e.message });
    }
};

exports.login = async function (req, res) {
    return res.status(200).json({ 'name': 'DevGisoun', 'age': 26 });
};

exports.forgotPassword = async function (req, res) {};

exports.verifyPasswordResetOTP = async function (req, res) {};

exports.resetPassword = async function (req, res) {};