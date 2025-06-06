const nodemailer = require('nodemailer');

exports.sendMail = async (email, subject, body) => {
    return new Promise((resolve, reject) => {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: "OAuth2",
                user: process.env.GOOGLE_EMAIL,
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
            }
        });

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject,
            text: body
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(`Error sending email: ${error}`);
                reject(Error('Error sending email.'));
            }

            console.log(`Email sent: ${info.response}`);
            resolve('Password reset OTP send to your email.');
        });
    });
};